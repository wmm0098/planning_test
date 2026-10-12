import { z } from 'zod';
// 운영 CSP에서 동적 코드 생성 없이 자료를 검사합니다.
z.config({ jitless: true });

export const numeric = z.union([z.number().finite(), z.string().regex(/^-?\d+(\.\d+)?$/)]).refine(v=>Number.isFinite(Number(v)), '유한한 숫자여야 합니다.');
const nonnegative = numeric.refine(v => Number(v) >= 0, '음수는 허용하지 않습니다.');
const positive = numeric.refine(v => Number(v) > 0, '0보다 커야 합니다.');
const optionalMoney = nonnegative.nullish();
const integerMoney = nonnegative.refine(v=>Number.isSafeInteger(Number(v)), '금액은 안전한 정수여야 합니다.');
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
const date = z.string().refine(validDate, '날짜를 확인해 주세요.');
const id = z.string().min(1);
const unit = z.enum(['g', 'ml', '개']);
export const saleSchema = z.object({
  sale_id: id, date, menu_id: id, channel: z.enum(['매장', '포장']),
  quantity: nonnegative.refine(v => Number.isSafeInteger(Number(v)), '판매수량은 정수여야 합니다.'),
  unit_price: integerMoney, discount_amount: integerMoney, net_sales: integerMoney,
  payment_fee: integerMoney.nullish(), recipe_version: id,
  unit_food_cost_snapshot: optionalMoney, unit_packaging_cost_snapshot: optionalMoney,
}).passthrough();
export const datasetSchema = z.object({
  meta: z.object({ dataset_id: id, version: id, store_name: id, start_date: date, as_of: date,
    currency: z.literal('KRW'), amount_basis: id }).passthrough(),
  suppliers: z.array(z.object({ supplier_id: id, name: id }).passthrough()),
  materials: z.array(z.object({ material_id: id, name: id, unit, supplier_id: id,
    pack_quantity: positive, base_pack_price: nonnegative, lead_days: nonnegative, safety_days: nonnegative }).passthrough()),
  menus: z.array(z.object({ menu_id: id, name: id, price: nonnegative, category: z.enum(['음료', '디저트']), recipe_version: id }).passthrough()),
  recipes: z.array(z.object({ recipe_version: id, menu_id: id, material_id: id,
    quantity: positive, unit, channel_only: z.enum(['매장', '포장']).optional() }).passthrough()),
  price_history: z.array(z.object({ material_id: id, effective_date: date, pack_price: nonnegative, pack_quantity: positive }).passthrough()),
  calendar: z.array(z.object({ date, is_open: z.boolean(), record_complete: z.boolean(), weather: z.string(), note: z.string() }).passthrough()),
  sales: z.array(saleSchema),
  opening_inventory: z.array(z.object({ material_id: id, date, quantity: nonnegative, unit }).passthrough()),
  inventory_events: z.array(z.object({ event_id: id, date, material_id: id, event_type: z.enum(['입고', '폐기', '실사조정']),
    quantity: numeric, unit, reason: z.string(), unit_cost: optionalMoney, supplier_id: id.optional(), counted_quantity: nonnegative.optional(), total_purchase_amount: integerMoney.optional(), memo: z.string().optional() }).passthrough()),
  expenses: z.array(z.object({ expense_id: id, date, category: z.enum(['임차료','인건비','사업주 부담 보험료','관리비','수도광열비','통신·소프트웨어','광고비','소모품·청소비']), amount: integerMoney, recognition: id }).passthrough()),
  monthly_expense_plan: z.array(z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), category: id, amount: nonnegative }).passthrough()),
  settings: z.record(z.string(), z.unknown()),
}).passthrough();
export type Dataset = z.infer<typeof datasetSchema>;
export type Sale = z.infer<typeof saleSchema>;
export type Numeric = z.infer<typeof numeric>;
export type CostBasis = { recipeVersion: string; food: string; packaging: string;
  items: { materialId: string; unit: string; perSale: string; unitCost: string; effectiveDate: string }[] };
export type State = {
  schemaVersion: 1; calculationVersion: 1; revision: number; dataset: Dataset;
  recordMetadata: Record<string, { source: 'sample' | 'manual'; createdAt?: string; updatedAt?: string }>;
  saleCostBasis: Record<string, CostBasis>; auditComparisons: Record<string, unknown>;
  policies: { rounding: 'ROUND_HALF_UP'; foodPackagingOnly: true; fee: 'confirmed-amount'; calculation: 'FRD-C1-C7-v1' };
};

function unique<T>(rows: T[], key: (row: T) => string, label: string) {
  const found = new Set<string>();
  for (const row of rows) {
    const value = key(row);
    if (found.has(value)) throw new Error(`${label}이 중복되었습니다: ${value}`);
    found.add(value);
  }
}
export function validateDataset(raw: unknown): Dataset {
  const result = datasetSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`자료 형식 오류 (${issue.path.join('.')}): ${issue.message}`);
  }
  const data = result.data;
  unique(data.suppliers, r => r.supplier_id, '공급사 번호');
  unique(data.materials, r => r.material_id, '재료 번호');
  unique(data.menus, r => r.menu_id, '메뉴 번호');
  unique(data.sales, r => r.sale_id, '판매 번호');
  unique(data.sales, r => JSON.stringify([r.date, r.menu_id, r.channel]), '날짜·메뉴·채널 판매');
  unique(data.inventory_events, r => r.event_id, '재고 번호');
  unique(data.expenses, r => r.expense_id, '비용 번호');
  unique(data.calendar, r => r.date, '영업 날짜');
  unique(data.opening_inventory, r => r.material_id, '초기재고');
  unique(data.price_history, r => JSON.stringify([r.material_id, r.effective_date]), '재료 가격 적용일');
  unique(data.recipes, r => JSON.stringify([r.recipe_version, r.menu_id, r.material_id, r.channel_only ?? '전체']), '레시피 항목');
  unique(data.monthly_expense_plan, r => JSON.stringify([r.month, r.category]), '월 비용 계획');
  unique(data.inventory_events.filter(r => r.event_type === '실사조정'), r => JSON.stringify([r.material_id, r.date]), '실사 날짜');
  const suppliers = new Set(data.suppliers.map(r => r.supplier_id));
  const materials = new Map(data.materials.map(r => [r.material_id, r]));
  const menus = new Map(data.menus.map(r => [r.menu_id, r]));
  const versions = new Set(data.recipes.map(r => JSON.stringify([r.menu_id, r.recipe_version])));
  const fail = (label: string) => { throw new Error(`연결된 자료가 없거나 단위가 다릅니다: ${label}`); };
  for (const row of data.materials) if (!suppliers.has(row.supplier_id)) fail(row.material_id);
  for (const row of data.recipes) if (!menus.has(row.menu_id) || materials.get(row.material_id)?.unit !== row.unit) fail(`레시피 ${row.menu_id}/${row.material_id}`);
  for (const row of data.menus) if (!versions.has(JSON.stringify([row.menu_id, row.recipe_version]))) fail(`메뉴 레시피 ${row.menu_id}`);
  for (const row of data.sales) if (!menus.has(row.menu_id) || !versions.has(JSON.stringify([row.menu_id, row.recipe_version]))) fail(`판매 ${row.sale_id}`);
  for (const row of data.price_history) if (!materials.has(row.material_id)) fail(`가격 ${row.material_id}`);
  for (const row of [...data.opening_inventory, ...data.inventory_events]) {
    if (materials.get(row.material_id)?.unit !== row.unit) fail(`재고 ${row.material_id}`);
  }
  for (const row of [...data.recipes, ...data.opening_inventory, ...data.inventory_events]) {
    if (row.unit === '개' && !Number.isSafeInteger(Number(row.quantity))) fail(`개 단위 수량 ${row.material_id}`);
    if ('counted_quantity' in row && row.counted_quantity !== undefined && row.unit === '개' && !Number.isSafeInteger(Number(row.counted_quantity))) fail(`개 단위 실측 ${row.material_id}`);
  }
  for (const row of data.inventory_events) {
    if (row.supplier_id && !suppliers.has(row.supplier_id)) fail(`입고 공급사 ${row.event_id}`);
    if (row.event_type === '입고' && Number(row.quantity) <= 0) fail(`입고 증감 ${row.event_id}`);
    if (row.event_type === '폐기' && Number(row.quantity) >= 0) fail(`폐기 증감 ${row.event_id}`);
  }
  return data;
}
