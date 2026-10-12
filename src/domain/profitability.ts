import Decimal from 'decimal.js';
import { D, sum } from './money';
import { inPeriod, type Period } from './dates';
import { saleTotals } from './sales';
import type { Dataset, Sale } from './schemas';

export function aggregateSales(sales: Sale[]) {
  const rows = sales.map(saleTotals);
  const total = (field: 'food' | 'packaging' | 'fee' | 'contribution') => rows.some(r => r[field] === null) ? null : sum(rows.map(r => r[field] as Decimal));
  const food = total('food'), packaging = total('packaging'), fee = total('fee');
  return {
    records: sales.length,
    quantity: sum(sales.map(r => D(r.quantity))), net: sum(rows.map(r => r.net)), food, packaging, fee,
    direct: food !== null && packaging !== null && fee !== null ? food.plus(packaging).plus(fee) : null,
    contribution: total('contribution'), issues: [...new Set(rows.flatMap(r => r.issues))],
    dineIn: sum(sales.filter(s => s.channel === '매장').map(s => D(s.quantity))),
    takeout: sum(sales.filter(s => s.channel === '포장').map(s => D(s.quantity))),
  };
}
export function profitability(data: Dataset, period: Period, category: '전체' | '음료' | '디저트' = '전체') {
  const menus = data.menus.filter(m => category === '전체' || m.category === category).sort((a, b) => a.menu_id.localeCompare(b.menu_id));
  const ids = new Set(menus.map(m => m.menu_id));
  const sales = data.sales.filter(s => ids.has(s.menu_id) && inPeriod(s.date, period));
  return { total: aggregateSales(sales), rows: menus.map(menu => ({ menu, ...aggregateSales(sales.filter(s => s.menu_id === menu.menu_id)) })) };
}
