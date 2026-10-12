import { openDB, type IDBPDatabase } from 'idb';
import { z } from 'zod';
import { buildInventory, type InventoryInput, type InventoryType } from '../domain/inventory';
import { validateDataset, numeric, validDate, type State } from '../domain/schemas';
import { buildSale, type SaleInput } from '../domain/sales';
import { validateExpense, expenseWarnings, type ExpenseInput, type Expense } from '../domain/expenses';

const stateEnvelope = z.object({
  schemaVersion: z.literal(1), calculationVersion: z.literal(1), revision: z.number().int().nonnegative().safe(),
  dataset: z.unknown(),
  recordMetadata: z.record(z.string(), z.object({ source: z.enum(['sample', 'manual']), createdAt: z.string().optional(), updatedAt: z.string().optional() })),
  saleCostBasis: z.record(z.string(), z.object({ recipeVersion: z.string(), food: z.string(), packaging: z.string(), items: z.array(z.object({ materialId: z.string(), unit: z.string(), perSale: z.string(), unitCost: z.string(), effectiveDate: z.string() })) })),
  auditComparisons: z.record(z.string(), z.object({balance:numeric.nullable(),difference:numeric.nullable(),issues:z.array(z.string())}).passthrough()),
  policies: z.object({ rounding: z.literal('ROUND_HALF_UP'), foodPackagingOnly: z.literal(true), fee: z.literal('confirmed-amount'), calculation: z.literal('FRD-C1-C7-v1') }),
});
export function validateState(raw: unknown): State {
  const parsed = stateEnvelope.safeParse(raw);
  if (!parsed.success) throw new Error('저장 자료의 형식 또는 버전을 확인할 수 없습니다. 기존 자료는 변경하지 않았습니다.');
  const data = validateDataset(parsed.data.dataset);
  const sales = new Map(data.sales.map(s=>[s.sale_id,s]));
  const materials = new Map(data.materials.map(m=>[m.material_id,m]));
  const events = new Map(data.inventory_events.map(e=>[e.event_id,e]));
  for (const [id,basis] of Object.entries(parsed.data.saleCostBasis)) {
    const sale = sales.get(id);
    if (!sale || basis.recipeVersion !== sale.recipe_version || !basis.items.length) throw new Error('판매 원가 근거의 연결을 확인해 주세요.');
    for (const value of [basis.food,basis.packaging,...basis.items.flatMap(i=>[i.perSale,i.unitCost])]) {
      if (!numeric.safeParse(value).success || Number(value)<0) throw new Error('판매 원가 근거의 숫자를 확인해 주세요.');
    }
    for (const item of basis.items) if (materials.get(item.materialId)?.unit !== item.unit || Number(item.perSale)<=0 || !validDate(item.effectiveDate) || item.effectiveDate>sale.date) throw new Error('판매 원가 근거의 재료·단위·날짜를 확인해 주세요.');
  }
  for (const [id] of Object.entries(parsed.data.auditComparisons)) if (events.get(id)?.event_type !== '실사조정' || events.get(id)?.counted_quantity === undefined) throw new Error('실사 비교값의 연결을 확인해 주세요.');
  const keys = new Set([...data.sales.map(s=>`sales:${s.sale_id}`),...data.expenses.map(e=>`expenses:${e.expense_id}`),...data.inventory_events.map(e=>`inventory_events:${e.event_id}`)]);
  for (const key of Object.keys(parsed.data.recordMetadata)) if (!keys.has(key)) throw new Error('기록 출처의 연결을 확인해 주세요.');
  return raw as State;
}
export class ConflictError extends Error {
  constructor() { super('다른 창에서 자료가 변경되었습니다. 입력은 유지됩니다. 창을 닫고 최신 기록을 다시 확인해 주세요.'); }
}
export class Repository {
  private database?: Promise<IDBPDatabase>;
  constructor(private name = 'prep-cafe-local') {}
  private db() {
    return this.database ??= openDB(this.name, 1, {
      upgrade(db) { db.createObjectStore('state'); },
      blocked() { /* Opening request stays pending; UI uses its own timeout. */ },
      blocking(_current, _blocked, event) { (event.target as IDBDatabase)?.close(); },
    });
  }
  async read(): Promise<State | undefined> {
    const db = await this.db();
    const raw = await db.get('state', 'active');
    return raw === undefined ? undefined : validateState(raw);
  }
  async initialize(loader: () => Promise<unknown>): Promise<State> {
    const existing = await this.read();
    if (existing) return existing;
    const raw = await loader();
    validateDataset(raw);
    const state: State = {
      schemaVersion: 1, calculationVersion: 1, revision: 0, dataset: raw as State['dataset'],
      recordMetadata: {}, saleCostBasis: {}, auditComparisons: {},
      policies: { rounding: 'ROUND_HALF_UP', foodPackagingOnly: true, fee: 'confirmed-amount', calculation: 'FRD-C1-C7-v1' },
    };
    for (const sale of state.dataset.sales) state.recordMetadata[`sales:${sale.sale_id}`] = { source: 'sample' };
    const db = await this.db();
    const tx = db.transaction('state', 'readwrite');
    const concurrent = await tx.store.get('active');
    if (concurrent !== undefined) {
      await tx.done;
      return validateState(concurrent);
    }
    await tx.store.put(state, 'active');
    await tx.done;
    return state;
  }
  async commit(expectedRevision: number, candidate: State, beforePut?: () => void): Promise<State> {
    validateState(candidate);
    const db = await this.db();
    const tx = db.transaction('state', 'readwrite');
    try {
      const current = await tx.store.get('active') as State | undefined;
      if (!current || current.revision !== expectedRevision) throw new ConflictError();
      const next = { ...candidate, revision: current.revision + 1 };
      beforePut?.();
      await tx.store.put(next, 'active');
      await tx.done;
      return next;
    } catch (error) {
      try { tx.abort(); } catch { /* Already aborted/finished. */ }
      await tx.done.catch(() => undefined);
      throw error;
    }
  }
  async saveSale(base: State, input: SaleInput, id?: string): Promise<State> {
    const previous = id ? base.dataset.sales.find(s => s.sale_id === id) : undefined;
    if (id && !previous) throw new Error('해당 판매 기록이 없습니다. 목록을 다시 확인해 주세요.');
    const { sale, basis } = buildSale(input, base.dataset, previous);
    if (base.dataset.sales.some(s => s.sale_id !== id && s.date === sale.date && s.menu_id === sale.menu_id && s.channel === sale.channel)) throw new Error('같은 날짜·메뉴·채널의 판매 기록이 있습니다. 기존 기록의 수정 기능을 사용해 주세요.');
    const next = structuredClone(base);
    if (id) next.dataset.sales[next.dataset.sales.findIndex(s => s.sale_id === id)] = sale;
    else next.dataset.sales.push(sale);
    const now = new Date().toISOString();
    next.recordMetadata[`sales:${sale.sale_id}`] = {
      source: previous ? next.recordMetadata[`sales:${sale.sale_id}`]?.source ?? 'sample' : 'manual',
      createdAt: previous ? next.recordMetadata[`sales:${sale.sale_id}`]?.createdAt : now, updatedAt: now,
    };
    if (basis) next.saleCostBasis[sale.sale_id] = basis;
    return this.commit(base.revision, next);
  }
  async deleteSale(base: State, id: string): Promise<State> {
    if (!base.dataset.sales.some(s => s.sale_id === id)) throw new Error('해당 판매 기록이 없습니다. 목록을 다시 확인해 주세요.');
    const next = structuredClone(base);
    next.dataset.sales = next.dataset.sales.filter(s => s.sale_id !== id);
    delete next.recordMetadata[`sales:${id}`];
    delete next.saleCostBasis[id];
    return this.commit(base.revision, next);
  }
  async saveExpense(base: State, input: ExpenseInput, id?: string, confirmDuplicate = false): Promise<State> {
    const errors = validateExpense(input);
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    const previous = id ? base.dataset.expenses.find(e => e.expense_id === id) : undefined;
    if (id && !previous) throw new Error('해당 비용 기록이 없습니다. 목록을 다시 확인해 주세요.');
    if (expenseWarnings(base.dataset,input,id).duplicate && !confirmDuplicate) throw new Error('같은 날짜·항목·금액의 비용이 있습니다. 별개 비용인지 확인해 주세요.');
    const next = structuredClone(base);
    const expense: Expense = { ...(previous ?? {}), expense_id: id ?? `U-X-${crypto.randomUUID()}`, date: input.date, category: input.category as Expense['category'],
      amount: Number(input.amount), recognition: previous?.recognition ?? '직접 입력 비용' };
    if (id) next.dataset.expenses[next.dataset.expenses.findIndex(e => e.expense_id === id)] = expense;
    else next.dataset.expenses.push(expense);
    const key = `expenses:${expense.expense_id}`, now = new Date().toISOString();
    next.recordMetadata[key] = { source: previous ? next.recordMetadata[key]?.source ?? 'sample' : 'manual', createdAt: previous ? next.recordMetadata[key]?.createdAt : now, updatedAt: now };
    return this.commit(base.revision,next);
  }
  async deleteExpense(base: State, id: string): Promise<State> {
    if (!base.dataset.expenses.some(e => e.expense_id === id)) throw new Error('해당 비용 기록이 없습니다. 목록을 다시 확인해 주세요.');
    const next = structuredClone(base);
    next.dataset.expenses = next.dataset.expenses.filter(e => e.expense_id !== id);
    delete next.recordMetadata[`expenses:${id}`];
    return this.commit(base.revision,next);
  }
  async saveInventory(base: State, input: InventoryInput, type: InventoryType, confirmations = {duplicate:false,overdraw:false}): Promise<State> {
    const candidate = buildInventory(base,input,type);
    if (candidate.duplicate && type === '실사조정') throw new Error('같은 재료·날짜의 실사가 있습니다. 하루 마감 실사는 한 번만 기록합니다.');
    if (candidate.duplicate && !confirmations.duplicate) throw new Error('같은 날짜·재료·유형·수량의 재고 기록이 있습니다. 별개 기록인지 확인해 주세요.');
    if (candidate.overdraw && !confirmations.overdraw) throw new Error('폐기 수량이 기록상 잔량보다 큽니다. 미기록 입고나 수량을 확인해 주세요.');
    const next = structuredClone(base);
    next.dataset.inventory_events.push(candidate.event);
    next.recordMetadata[`inventory_events:${candidate.event.event_id}`] = {source:'manual',createdAt:new Date().toISOString()};
    if (candidate.audit) next.auditComparisons[candidate.event.event_id] = candidate.audit;
    return this.commit(base.revision,next);
  }
  async restore(base: State, payload: State): Promise<State> {
    validateState(payload);
    if (payload.dataset.meta.dataset_id !== base.dataset.meta.dataset_id || payload.dataset.meta.store_name !== base.dataset.meta.store_name) throw new Error('다른 매장의 자료는 복원할 수 없습니다.');
    return this.commit(base.revision,structuredClone(payload));
  }
  async readRestoreCursor(): Promise<{revision:number;state?:State}> {
    const db=await this.db();
    const raw=await db.get('state','active');
    if (!raw || raw.schemaVersion!==1 || raw.calculationVersion!==1 || !Number.isSafeInteger(raw.revision) || raw.revision<0) throw new Error('현재 저장 버전·변경 번호를 확인할 수 없어 안전한 복원이 불가능합니다. 기존 자료를 삭제하지 않았습니다.');
    try { return {revision:raw.revision,state:validateState(raw)}; }
    catch { return {revision:raw.revision}; }
  }
  async restoreRecovery(revision:number,payload:State): Promise<State> {
    validateState(payload);
    if(payload.dataset.meta.store_name!=='프렙 카페'||payload.dataset.meta.dataset_id!=='prep-cafe-operations') throw new Error('다른 매장의 자료는 복원할 수 없습니다.');
    const cursor=await this.readRestoreCursor();
    if(cursor.revision!==revision)throw new ConflictError();
    return this.commit(revision,structuredClone(payload));
  }
  async close() { (await this.database)?.close(); this.database = undefined; }
}
export const repository = new Repository();
export function userError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') return '저장 공간이 부족합니다. 기존 기록은 유지됩니다. 컴퓨터 공간과 브라우저 설정을 확인해 주세요.';
  if (error instanceof DOMException && ['SecurityError', 'InvalidStateError'].includes(error.name)) return '브라우저 저장소에 접근할 수 없습니다. 일반 브라우저 프로필과 저장 설정을 확인해 주세요.';
  return error instanceof Error ? error.message : '처리하지 못했습니다. 기존 기록을 유지했습니다. 다시 시도해 주세요.';
}
