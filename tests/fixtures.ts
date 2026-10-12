import { readFileSync } from 'node:fs';
import type { Dataset } from '../src/domain/schemas';
import type { SaleInput } from '../src/domain/sales';

export const seed = JSON.parse(readFileSync(new URL('../src/data/seed.json', import.meta.url), 'utf-8')) as Dataset;
export const fixture = (): Dataset => ({ ...structuredClone(seed), sales: [], expenses: [], inventory_events: [] });
export const saleInput = (changes: Partial<SaleInput> = {}): SaleInput => ({
  date: '2026-09-19', menu_id: 'M01', channel: '포장', quantity: '10', unit_price: '4000', discount_amount: '1000', payment_fee: '600', ...changes,
});
