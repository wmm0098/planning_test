import { D, sum, won } from './money';
import { periodBounds, type Period } from './dates';
import { aggregateSales } from './profitability';
import { materialConsumption } from './sales';
import { expenseCategories } from './expenses';
import type { Dataset, State } from './schemas';
import type Decimal from 'decimal.js';

export function wasteRows(data: Dataset, start: string, end: string) {
  return data.inventory_events.filter(e => e.event_type === '폐기' && e.date >= start && e.date <= end).map(event => {
    const price = data.price_history.filter(p => p.material_id === event.material_id && p.effective_date <= event.date).sort((a,b) => b.effective_date.localeCompare(a.effective_date))[0];
    return { event, loss: price ? won(D(event.quantity).abs().times(price.pack_price).div(price.pack_quantity)) : null };
  });
}
export function profitLoss(data: Dataset, period: Period) {
  const {start,end} = periodBounds(period);
  const calendar = new Map(data.calendar.map(c => [c.date,c]));
  const sales = data.sales.filter(s => s.date >= start && s.date <= end);
  const expenses = data.expenses.filter(e => e.date >= start && e.date <= end);
  const waste = wasteRows(data,start,end);
  const calculate = (closed?: boolean) => {
    const includes = (date: string) => closed === undefined || (calendar.get(date)?.record_complete === true) === closed;
    const s = aggregateSales(sales.filter(s => includes(s.date)));
    const e = expenses.filter(e => includes(e.date));
    const w = waste.filter(w => includes(w.event.date));
    const operating = sum(e.map(e => D(e.amount)));
    const wasteLoss = w.some(w => w.loss === null) ? null : sum(w.map(w => w.loss!));
    return { ...s, operating, wasteLoss, profit: s.contribution !== null && wasteLoss !== null ? s.contribution.minus(operating).minus(wasteLoss) : null,
      expenseCount: e.length, wasteCount: w.length, recordCount: s.records + e.length + w.length };
  };
  const dates = [...new Set([...sales,...expenses,...waste.map(w => w.event)].map(r => r.date))].sort();
  const missing: string[] = [], open: string[] = [], outside: string[] = [], inconsistent: string[] = [];
  const saleDates = new Set(sales.map(s => s.date));
  for (let date = start; date <= end;) {
    const c = calendar.get(date);
    if (!c) outside.push(date);
    else if (!c.record_complete) open.push(date);
    else if (c.is_open && !saleDates.has(date)) missing.push(date);
    if (c && !c.is_open && saleDates.has(date)) inconsistent.push(date);
    const next = new Date(`${date}T00:00:00Z`); next.setUTCDate(next.getUTCDate()+1); date = next.toISOString().slice(0,10);
  }
  const issues = [...calculate().issues];
  if (missing.length) issues.push(`마감 영업일 판매 누락 확인: ${missing.join(', ')}`);
  if (inconsistent.length) issues.push(`휴무일 판매 상충: ${inconsistent.join(', ')}`);
  if (waste.some(w => w.loss === null)) issues.push('폐기 가격 누락: 폐기 손실과 매장 손익 계산 불가');
  return { total: calculate(), closed: calculate(true), pending: calculate(false), expenses, waste,
    categories: expenseCategories.map(category => ({category, amount: sum(expenses.filter(e => e.category === category).map(e => D(e.amount)))})),
    start,end,recordStart: dates[0],recordEnd: dates.at(-1),missing,open,outside,inconsistent,issues };
}
export function inventoryAt(state: Pick<State,'dataset'|'saleCostBasis'> & Partial<Pick<State,'auditComparisons'>>, date: string) {
  const data = state.dataset;
  type Movement = { date: string; materialId: string; quantity?: Decimal; bad?: string; event?: Dataset['inventory_events'][number] };
  const movements: Movement[] = [];
  for (const sale of data.sales.filter(s => s.date <= date)) {
    try {
      const items = materialConsumption(sale,data,state.saleCostBasis[sale.sale_id]);
      for (const item of items) {
        if (data.materials.find(m => m.material_id === item.materialId)?.unit !== item.unit) throw new Error('레시피 단위가 다릅니다.');
        movements.push({date:sale.date,materialId:item.materialId,quantity:D(item.quantity).negated()});
      }
    } catch {
      const ids = data.recipes.filter(r => r.menu_id === sale.menu_id).map(r => r.material_id);
      for (const id of new Set(ids.length ? ids : data.materials.map(m => m.material_id))) movements.push({date:sale.date,materialId:id,bad:'판매 레시피·단위 확인 필요'});
    }
  }
  for (const event of data.inventory_events.filter(e => e.date <= date)) movements.push({date:event.date,materialId:event.material_id,quantity:D(event.quantity),event});
  const groups = new Map<string,Movement[]>();
  for (const movement of movements) { const group = groups.get(movement.materialId) ?? []; group.push(movement); groups.set(movement.materialId,group); }
  const rows = data.materials.map(material => {
    const opening = data.opening_inventory.find(o => o.material_id === material.material_id && o.date <= date);
    let balance: Decimal | null = opening ? D(opening.quantity) : null;
    let issues: string[] = opening ? [] : ['초기재고·실측 기준 없음'];
    let latestCount: {date:string; counted: Decimal | null; savedDifference: Decimal | null; currentDifference: Decimal | null} | undefined;
    let lastReceipt: Dataset['inventory_events'][number] | undefined;
    const list = (groups.get(material.material_id) ?? []).filter(m => !opening || m.date >= opening.date).sort((a,b) => a.date.localeCompare(b.date));
    const byDate = new Map<string,Movement[]>();
    for (const item of list) { const items = byDate.get(item.date) ?? []; items.push(item); byDate.set(item.date,items); }
    for (const [day, items] of byDate) {
      const counts = items.filter(m => m.event?.event_type === '실사조정');
      for (const movement of items.filter(m => m.event?.event_type !== '실사조정')) {
        if (movement.bad) { balance = null; issues.push(movement.bad); }
        else if (balance !== null) balance = balance.plus(movement.quantity!);
        if (movement.event?.event_type === '입고') lastReceipt = movement.event;
      }
      if (counts.length > 1) { balance = null; issues.push(`${day} 실측 기준 충돌`); continue; }
      const event = counts[0]?.event;
      if (event) {
        const counted = event.counted_quantity === undefined ? null : D(event.counted_quantity);
        const saved = state.auditComparisons?.[event.event_id] as { difference:string|null } | undefined;
        latestCount = {date:day,counted,savedDifference:saved ? saved.difference === null ? null : D(saved.difference) : D(event.quantity),currentDifference:counted !== null && balance !== null ? counted.minus(balance) : null};
        if (counted !== null) { balance = counted; issues = []; }
        else if (balance !== null) balance = balance.plus(event.quantity);
      }
    }
    if (balance?.isNegative()) issues.push('기록상 음수: 판매·입고·폐기 확인');
    return { material, balance, issues:[...new Set(issues)], latestCount, lastReceipt, supplier:data.suppliers.find(s => s.supplier_id === material.supplier_id)?.name ?? '공급사 확인 필요' };
  });
  const recordDates = [...data.sales,...data.inventory_events,...data.opening_inventory].filter(r => r.date <= date).map(r => r.date).sort();
  const waste = wasteRows(data,`${date.slice(0,7)}-01`,date);
  return {rows,date,lastRecord:recordDates.at(-1),latestCountDate:rows.map(r=>r.latestCount?.date).filter((d):d is string=>!!d).sort().at(-1),
    wasteLoss:waste.some(w=>w.loss===null)?null:sum(waste.map(w=>w.loss!))};
}
