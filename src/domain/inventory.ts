import { todayKorea } from './dates';
import { D, won } from './money';
import { inventoryAt } from './operations';
import { validDate, type State, type Dataset } from './schemas';
export type InventoryType = '입고' | '폐기' | '실사조정';
export type InventoryInput = { date:string; material_id:string; quantity:string; purchase_amount:string; supplier_id:string; reason:string; memo:string };
export const countReasons = ['자연 손실','레시피 초과 사용','미기록 폐기','기타'] as const;
export type AuditComparison = { balance:string|null; difference:string|null; issues:string[] };
export function validateInventory(input:InventoryInput,type:InventoryType,data:Dataset,today=todayKorea()) {
  const errors:Partial<Record<keyof InventoryInput,string>>={};
  if(!validDate(input.date))errors.date='날짜를 확인해 주세요.';
  else if(input.date>today)errors.date='미래 날짜의 실적 재고는 저장할 수 없습니다.';
  const material=data.materials.find(m=>m.material_id===input.material_id);
  if(!material)errors.material_id='재료를 선택해 주세요.';
  const pattern=material?.unit==='개'?/^\d+$/:/^\d+(\.\d{1,3})?$/;
  if(!pattern.test(input.quantity)||!Number.isFinite(Number(input.quantity))||Number(input.quantity)>Number.MAX_SAFE_INTEGER||Number(input.quantity)<0||(type!=='실사조정'&&Number(input.quantity)===0))errors.quantity=type==='실사조정'?'실측 수량은 0 이상, 개는 정수·g/ml는 소수 셋째 자리까지 입력해 주세요.':'수량은 0보다 커야 하며 개는 정수·g/ml는 소수 셋째 자리까지 입력해 주세요.';
  if(type==='입고'){
    if(!/^\d+$/.test(input.purchase_amount)||!Number.isSafeInteger(Number(input.purchase_amount)))errors.purchase_amount='총 구매금액은 0 이상의 정수로 입력해 주세요.';
    if(!data.suppliers.some(s=>s.supplier_id===input.supplier_id))errors.supplier_id='제공된 공급사를 선택해 주세요.';
  }
  if(type==='폐기'&&!input.reason.trim())errors.reason='폐기 사유를 입력해 주세요.';
  if(type==='실사조정'&&!countReasons.includes(input.reason as typeof countReasons[number]))errors.reason='실사 차이 발생 사유를 선택해 주세요.';
  return errors;
}
export function inventoryDuplicate(input:InventoryInput,type:InventoryType,data:Dataset){
  return data.inventory_events.some(e=>e.date===input.date&&e.material_id===input.material_id&&e.event_type===type&&(type==='실사조정'||D(e.quantity).abs().eq(input.quantity||'0')));
}
export function buildInventory(base:State,input:InventoryInput,type:InventoryType){
  const errors=validateInventory(input,type,base.dataset);
  if(Object.keys(errors).length)throw new Error(Object.values(errors)[0]);
  const material=base.dataset.materials.find(m=>m.material_id===input.material_id)!;
  const before=inventoryAt(base,input.date).rows.find(r=>r.material.material_id===input.material_id)!;
  const price=base.dataset.price_history.filter(p=>p.material_id===input.material_id&&p.effective_date<=input.date).sort((a,b)=>b.effective_date.localeCompare(a.effective_date))[0];
  const unitCost=type==='입고'?D(input.purchase_amount).div(input.quantity):type==='폐기'&&price?D(price.pack_price).div(price.pack_quantity):null;
  const difference=type==='실사조정'&&before.balance!==null?D(input.quantity).minus(before.balance):null;
  const event:Dataset['inventory_events'][number]={event_id:`U-E-${crypto.randomUUID()}`,date:input.date,material_id:input.material_id,event_type:type,unit:material.unit,
    quantity:type==='입고'?D(input.quantity).toString():type==='폐기'?D(input.quantity).negated().toString():difference?.toString()??'0',
    reason:input.reason.trim(),memo:input.memo.trim(),unit_cost:unitCost?.toString()??null,
    ...(type==='입고'?{supplier_id:input.supplier_id,total_purchase_amount:input.purchase_amount}:{}),
    ...(type==='실사조정'?{counted_quantity:D(input.quantity).toString()}:{}),
  };
  const audit:AuditComparison|undefined=type==='실사조정'?{balance:before.balance?.toString()??null,difference:difference?.toString()??null,issues:before.issues}:undefined;
  return {event,audit,before:before.balance,loss:type==='폐기'&&unitCost!==null?won(D(input.quantity).times(unitCost)):null,duplicate:inventoryDuplicate(input,type,base.dataset),overdraw:type==='폐기'&&before.balance!==null&&D(input.quantity).gt(before.balance)};
}
