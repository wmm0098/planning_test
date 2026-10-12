import Decimal from 'decimal.js';
import { D, won } from './money';
import { todayKorea } from './dates';
import { validDate, type Dataset, type Sale, type CostBasis } from './schemas';

export type SaleInput = { date: string; menu_id: string; channel: '매장' | '포장'; quantity: string; unit_price: string; discount_amount: string; payment_fee: string };
export type FieldErrors = Partial<Record<keyof SaleInput, string>>;
export function validateSaleInput(input: SaleInput, data: Dataset, today = todayKorea()): FieldErrors {
  const errors: FieldErrors = {};
  if (!validDate(input.date)) errors.date = '유효한 판매 날짜를 선택해 주세요.';
  else if (input.date > today) errors.date = '미래 날짜는 실적 기록으로 저장할 수 없습니다.';
  if (!data.menus.some(m => m.menu_id === input.menu_id)) errors.menu_id = '메뉴를 선택해 주세요.';
  if (!['매장', '포장'].includes(input.channel)) errors.channel = '판매 채널을 선택해 주세요.';
  for (const field of ['quantity', 'unit_price', 'discount_amount', 'payment_fee'] as const) {
    const value = input[field];
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) errors[field] = '0 이상의 정수 금액을 입력해 주세요.';
  }
  if (!errors.quantity && Number(input.quantity) < 1) errors.quantity = '판매수량은 1개 이상의 정수여야 합니다.';
  if (!errors.quantity && !errors.unit_price && !errors.discount_amount && D(input.discount_amount).gt(D(input.quantity).times(input.unit_price))) errors.discount_amount = '할인금액은 할인 전 총액을 넘을 수 없습니다.';
  return errors;
}
export function calculateCost(data: Dataset, date: string, menuId: string, channel: string, version?: string): CostBasis {
  const menu = data.menus.find(m => m.menu_id === menuId);
  if (!menu) throw new Error('메뉴를 선택해 주세요.');
  const recipeVersion = version ?? menu.recipe_version;
  const recipes = data.recipes.filter(r => r.menu_id === menuId && r.recipe_version === recipeVersion && (!r.channel_only || r.channel_only === channel));
  if (!recipes.length) throw new Error('해당 메뉴의 레시피가 없습니다.');
  let food = new Decimal(0), packaging = new Decimal(0);
  const items: CostBasis['items'] = [];
  for (const recipe of recipes) {
    const material = data.materials.find(m => m.material_id === recipe.material_id);
    if (!material || material.unit !== recipe.unit) throw new Error('레시피 재료 또는 단위가 잘못되었습니다.');
    const prices = data.price_history.filter(p => p.material_id === recipe.material_id && p.effective_date <= date).sort((a, b) => b.effective_date.localeCompare(a.effective_date));
    if (!prices.length) throw new Error(`${material.name}: ${date}에 적용할 가격이 없습니다.`);
    if (prices.length > 1 && prices[0].effective_date === prices[1].effective_date) throw new Error(`${material.name}: 적용 가격이 중복되었습니다.`);
    if (D(prices[0].pack_quantity).lte(0)) throw new Error(`${material.name}: 구매용량을 확인해 주세요.`);
    const cost = D(prices[0].pack_price).div(prices[0].pack_quantity);
    const perSale = D(recipe.quantity);
    if (['I10', 'I11'].includes(material.material_id)) packaging = packaging.plus(perSale.times(cost));
    else food = food.plus(perSale.times(cost));
    items.push({ materialId: material.material_id, unit: recipe.unit, perSale: perSale.toString(), unitCost: cost.toString(), effectiveDate: prices[0].effective_date });
  }
  return { recipeVersion, food: food.toString(), packaging: packaging.toString(), items };
}
export type SaleTotals = { net: Decimal; food: Decimal | null; packaging: Decimal | null; fee: Decimal | null; contribution: Decimal | null; issues: string[] };
export function saleTotals(sale: Sale): SaleTotals {
  const net = D(sale.net_sales);
  const food = sale.unit_food_cost_snapshot == null ? null : won(D(sale.unit_food_cost_snapshot).times(sale.quantity));
  const packaging = sale.unit_packaging_cost_snapshot == null ? null : won(D(sale.unit_packaging_cost_snapshot).times(sale.quantity));
  const fee = sale.payment_fee == null ? null : D(sale.payment_fee);
  const issues: string[] = [];
  if (food === null) issues.push('식재료 원가 없음');
  if (packaging === null) issues.push('포장 원가 없음');
  if (fee === null) issues.push('결제수수료 없음');
  if (!D(sale.quantity).times(sale.unit_price).minus(sale.discount_amount).eq(net)) issues.push('기존 기록 값 차이: 순매출 원본 보존');
  return { net, food, packaging, fee, contribution: food !== null && packaging !== null && fee !== null ? net.minus(food).minus(packaging).minus(fee) : null, issues };
}
export function buildSale(input: SaleInput, data: Dataset, previous?: Sale): { sale: Sale; basis?: CostBasis } {
  const errors = validateSaleInput(input, data);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const sameBasis = previous && previous.date === input.date && previous.menu_id === input.menu_id && previous.channel === input.channel;
  const basis = sameBasis ? undefined : calculateCost(data, input.date, input.menu_id, input.channel);
  if (sameBasis && (previous.unit_food_cost_snapshot == null || previous.unit_packaging_cost_snapshot == null)) throw new Error('기존 기록의 원가가 누락되어 수정 결과를 계산할 수 없습니다.');
  const sale: Sale = {
    ...(previous ?? {}), sale_id: previous?.sale_id ?? `U-S-${crypto.randomUUID()}`,
    date: input.date, menu_id: input.menu_id, channel: input.channel,
    quantity: Number(input.quantity), unit_price: Number(input.unit_price), discount_amount: Number(input.discount_amount),
    net_sales: D(input.quantity).times(input.unit_price).minus(input.discount_amount).toString(), payment_fee: Number(input.payment_fee),
    recipe_version: sameBasis ? previous.recipe_version : basis!.recipeVersion,
    unit_food_cost_snapshot: sameBasis ? previous.unit_food_cost_snapshot : basis!.food,
    unit_packaging_cost_snapshot: sameBasis ? previous.unit_packaging_cost_snapshot : basis!.packaging,
  };
  return { sale, basis };
}
export function materialConsumption(sale: Sale, data: Dataset, savedBasis?: CostBasis) {
  const items = savedBasis?.items ?? data.recipes.filter(r => r.menu_id === sale.menu_id && r.recipe_version === sale.recipe_version && (!r.channel_only || r.channel_only === sale.channel)).map(r => ({ materialId: r.material_id, unit: r.unit, perSale: String(r.quantity) }));
  if (!items.length) throw new Error('재료 사용량을 확인할 레시피가 없습니다.');
  return items.map(item => ({ materialId: item.materialId, unit: item.unit, quantity: D(item.perSale).times(sale.quantity).toString() }));
}
