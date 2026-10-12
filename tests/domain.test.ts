import { describe, expect, it } from 'vitest';
import { fixture, saleInput, seed } from './fixtures';
import { buildSale, calculateCost, materialConsumption, saleTotals, validateSaleInput } from '../src/domain/sales';
import { profitability, aggregateSales } from '../src/domain/profitability';
import { D, rate, won } from '../src/domain/money';
import { inPeriod, periodBounds, periodStatus, todayKorea } from '../src/domain/dates';
import { validateDataset, validDate } from '../src/domain/schemas';

describe('초기자료와 연결 검사', () => {
  it('실제 샘플의 모든 배열을 유효하게 읽고 원본을 변경하지 않는다', () => {
    const before = JSON.stringify(seed);
    const data = validateDataset(seed);
    expect(data.sales).toHaveLength(6112);
    expect(data.materials).toHaveLength(11);
    expect(data.expenses).toHaveLength(3560);
    expect(JSON.stringify(seed)).toBe(before);
  });
  it.each(['id', 'daily', 'unit', 'reference', 'price', 'recipe', 'inventory', 'date'])('잘못된 초기자료 %s를 거절한다', kind => {
    const data = fixture();
    if (kind === 'id') data.menus.push(structuredClone(data.menus[0]));
    if (kind === 'daily') { const { sale } = buildSale(saleInput(), data); data.sales = [sale, { ...sale, sale_id: 'OTHER' }]; }
    if (kind === 'unit') data.recipes[0].unit = 'ml';
    if (kind === 'reference') data.materials[0].supplier_id = 'MISSING';
    if (kind === 'price') data.price_history.push(structuredClone(data.price_history[0]));
    if (kind === 'recipe') data.menus[0].recipe_version = 'R99';
    if (kind === 'inventory') data.opening_inventory[0].material_id = 'MISSING';
    if (kind === 'date') data.calendar[0].date = '2026-02-30';
    expect(() => validateDataset(data)).toThrow();
  });
});

describe('C1–C3 판매·원가·공헌이익', () => {
  it('FRD의 포장 판매 예시와 재료 소진량이 일치한다', () => {
    const { sale, basis } = buildSale(saleInput(), fixture());
    const totals = saleTotals(sale);
    expect([totals.net, totals.food, totals.packaging, totals.fee, totals.contribution].map(v => v?.toString())).toEqual(['39000', '4968', '1664', '600', '31768']);
    expect(materialConsumption(sale, fixture(), basis)).toEqual([
      { materialId: 'I01', unit: 'g', quantity: '200' }, { materialId: 'I10', unit: '개', quantity: '10' },
    ]);
  });
  it('매장 판매는 포장재를 사용하지 않는다', () => {
    const { sale, basis } = buildSale(saleInput({ channel: '매장' }), fixture());
    expect(saleTotals(sale).packaging?.toString()).toBe('0');
    expect(materialConsumption(sale, fixture(), basis)).toHaveLength(1);
  });
  it('미래 가격을 제외하고 판매일 이하 최신 가격을 고른다', () => {
    const data = fixture();
    data.price_history.push({ material_id: 'I01', effective_date: '2026-12-01', pack_price: 999999, pack_quantity: 1000 });
    expect(calculateCost(data, '2025-07-01', 'M01', '매장').food).toBe('460');
    expect(calculateCost(data, '2026-01-01', 'M01', '매장').food).toBe('478.4');
    expect(calculateCost(data, '2026-09-19', 'M01', '매장').food).toBe('496.8');
  });
  it('개당 원가를 먼저 반올림하지 않고 한 줄 최종 금액만 반올림한다', () => {
    const sale = buildSale(saleInput(), fixture()).sale;
    expect(sale.unit_food_cost_snapshot).toBe('496.8');
    expect(saleTotals(sale).food?.toString()).toBe('4968');
    expect(won(D('0.5')).toString()).toBe('1');
    expect(won(D('0.49')).toString()).toBe('0');
  });
  it('수량만 수정하면 당시 개당 원가와 레시피를 유지한다', () => {
    const data = fixture();
    const old = buildSale(saleInput(), data).sale;
    data.price_history.find(p => p.material_id === 'I01' && p.effective_date === '2026-09-01')!.pack_price = 50000;
    const changed = buildSale(saleInput({ quantity: '5' }), data, old).sale;
    expect(changed.sale_id).toBe(old.sale_id);
    expect(changed.unit_food_cost_snapshot).toBe('496.8');
    expect(saleTotals(changed).contribution?.toString()).toBe('15084');
    expect(materialConsumption(changed, data)[0].quantity).toBe('100');
  });
  it('날짜·메뉴·채널 변경 시 해당 조건으로 원가를 다시 산정한다', () => {
    const data = fixture(); const old = buildSale(saleInput(), data).sale;
    expect(buildSale(saleInput({ date: '2025-07-01' }), data, old).sale.unit_food_cost_snapshot).toBe('460');
    expect(buildSale(saleInput({ channel: '매장' }), data, old).sale.unit_packaging_cost_snapshot).toBe('0');
    expect(buildSale(saleInput({ menu_id: 'M02' }), data, old).sale.unit_food_cost_snapshot).toBe('1123.2');
  });
  it.each(['missingPrice', 'zeroPack', 'duplicatePrice', 'missingRecipe', 'wrongUnit'])('불완전 원가 %s를 0으로 만들지 않고 저장을 차단한다', kind => {
    const data = fixture();
    if (kind === 'missingPrice') data.price_history = data.price_history.filter(p => p.material_id !== 'I01');
    if (kind === 'zeroPack') data.price_history.find(p => p.material_id === 'I01' && p.effective_date === '2026-09-01')!.pack_quantity = 0;
    if (kind === 'duplicatePrice') data.price_history.push(structuredClone(data.price_history.find(p => p.material_id === 'I01' && p.effective_date === '2026-09-01')!));
    if (kind === 'missingRecipe') data.recipes = data.recipes.filter(r => r.menu_id !== 'M01');
    if (kind === 'wrongUnit') data.recipes[0].unit = 'ml';
    expect(() => buildSale(saleInput(), data)).toThrow();
  });
  it('과거 순매출의 값 차이를 표시하되 조회만으로 원본을 바꾸지 않는다', () => {
    const sale = buildSale(saleInput(), fixture()).sale; sale.net_sales = 35000;
    expect(saleTotals(sale).net.toString()).toBe('35000');
    expect(saleTotals(sale).issues).toContain('기존 기록 값 차이: 순매출 원본 보존');
    expect(sale.net_sales).toBe(35000);
  });
  it.each([
    ['quantity', '0'], ['quantity', '-1'], ['quantity', '1.5'], ['quantity', ''],
    ['unit_price', ''], ['unit_price', '-1'], ['discount_amount', '40001'],
    ['payment_fee', ''], ['payment_fee', '1.5'], ['date', '2026-02-30'],
    ['date', '2026-10-13'], ['menu_id', ''], ['unit_price', '9007199254740992'],
  ] as const)('유효하지 않은 %s=%s를 거절한다', (key, value) => {
    expect(validateSaleInput(saleInput({ [key]: value }), fixture(), '2026-10-12')[key]).toBeTruthy();
  });
  it('무료 판매·전액 할인·수수료 0은 허용한다', () => {
    expect(validateSaleInput(saleInput({ unit_price: '0', discount_amount: '0', payment_fee: '0' }), fixture())).toEqual({});
    expect(saleTotals(buildSale(saleInput({ discount_amount: '40000', payment_fee: '0' }), fixture()).sale).net.toString()).toBe('0');
  });
});

describe('C4 수익성·일/월 조회', () => {
  it('전체 마진율을 비율 평균이 아닌 전체 금액으로 계산한다', () => {
    const data = fixture(); const sale = buildSale(saleInput(), data).sale;
    const totals = aggregateSales([
      { ...sale, quantity: 1, unit_price: 1000, discount_amount: 0, net_sales: 1000, payment_fee: 0, unit_food_cost_snapshot: 100, unit_packaging_cost_snapshot: 0 },
      { ...sale, sale_id: 'OTHER', quantity: 1, unit_price: 9000, discount_amount: 0, net_sales: 9000, payment_fee: 0, unit_food_cost_snapshot: 8100, unit_packaging_cost_snapshot: 0 },
    ]);
    expect(rate(totals.contribution, totals.net)).toBe('18.0%');
  });
  it('분류 필터와 카드·명세 합계를 같은 기록에서 만든다', () => {
    const data = fixture();
    data.sales = [buildSale(saleInput(), data).sale, buildSale(saleInput({ menu_id: 'M08', unit_price: '6500', discount_amount: '0' }), data).sale];
    const all = profitability(data, { mode: 'day', value: '2026-09-19' });
    const beverage = profitability(data, { mode: 'day', value: '2026-09-19' }, '음료');
    const dessert = profitability(data, { mode: 'day', value: '2026-09-19' }, '디저트');
    expect(all.total.net.toString()).toBe('104000');
    expect(beverage.total.net.plus(dessert.total.net).toString()).toBe(all.total.net.toString());
    expect(beverage.rows).toHaveLength(6); expect(dessert.rows).toHaveLength(2);
  });
  it('없는 판매는 비율 대상 없음, 누락 원가는 일부 계산 불가로 전달한다', () => {
    const data = fixture();
    expect(rate(profitability(data, { mode: 'day', value: '2026-09-19' }).total.contribution, D(0))).toBe('계산 대상 없음');
    const sale = buildSale(saleInput(), data).sale; sale.unit_food_cost_snapshot = null; data.sales = [sale];
    const totals = profitability(data, { mode: 'day', value: '2026-09-19' }).total;
    expect(totals.net.toString()).toBe('39000'); expect(totals.food).toBeNull(); expect(totals.contribution).toBeNull();
  });
  it('윤년과 한국 날짜를 처리하며 기간 마지막 날짜를 포함한다', () => {
    expect(periodBounds({ mode: 'month', value: '2024-02' }).end).toBe('2024-02-29');
    expect(periodBounds({ mode: 'month', value: '2026-02' }).end).toBe('2026-02-28');
    expect(inPeriod('2026-09-30', { mode: 'month', value: '2026-09' })).toBe(true);
    expect(inPeriod('2026-10-01', { mode: 'month', value: '2026-09' })).toBe(false);
    expect(todayKorea(new Date('2026-09-18T16:00:00Z'))).toBe('2026-09-19');
    expect(validDate('2026-02-30')).toBe(false);
  });
  it('미마감·누락·휴무 상충·자료 밖 기간을 마감 실적으로 가장하지 않는다', () => {
    const data = fixture();
    expect(periodStatus(data, { mode: 'day', value: '2026-09-19' }).hasOpen).toBe(true);
    expect(periodStatus(data, { mode: 'day', value: '2026-09-18' }).missing).toHaveLength(1);
    expect(periodStatus(data, { mode: 'day', value: '2026-10-12' }).outside).toBe(true);
    data.sales = [buildSale(saleInput({ date: '2025-07-07' }), data).sale];
    expect(periodStatus(data, { mode: 'day', value: '2025-07-07' }).inconsistent).toHaveLength(1);
  });
});
