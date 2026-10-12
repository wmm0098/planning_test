import Decimal from 'decimal.js';
import type { Numeric } from './schemas';
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export const D = (value: Numeric) => new Decimal(value);
export const won = (value: Decimal) => value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
export const sum = (values: Decimal[]) => values.reduce((a, b) => a.plus(b), new Decimal(0));
export function formatMoney(value: Decimal | Numeric | null): string {
  if (value === null) return '일부 계산 불가';
  const text = new Decimal(value).toFixed(0);
  return `${text.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`;
}
export const rate = (part: Decimal | null, net: Decimal): string => part === null ? '일부 계산 불가' : net.isZero() ? '계산 대상 없음' : `${part.div(net).times(100).toFixed(1)}%`;
