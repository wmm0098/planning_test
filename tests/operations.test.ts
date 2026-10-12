import { describe,it,expect } from 'vitest';
import { fixture,saleInput } from './fixtures';
import { buildSale } from '../src/domain/sales';
import { profitLoss,inventoryAt,wasteRows } from '../src/domain/operations';
import { validateExpense,expenseWarnings } from '../src/domain/expenses';
import type { Dataset } from '../src/domain/schemas';
const period={mode:'day' as const,value:'2026-09-19'};
function example(){const d=fixture();d.sales=[buildSale(saleInput(),d).sale];return d;}
function stockFixture(){const d=fixture();d.opening_inventory=[{material_id:'I02',date:'2026-09-18',quantity:6000,unit:'ml'}];d.inventory_events=[
 {event_id:'r',date:'2026-09-18',material_id:'I02',event_type:'입고',quantity:1000,unit:'ml',reason:'입고',unit_cost:3.132},
 {event_id:'w',date:'2026-09-18',material_id:'I02',event_type:'폐기',quantity:-200,unit:'ml',reason:'폐기',unit_cost:null},
 {event_id:'c',date:'2026-09-18',material_id:'I02',event_type:'실사조정',quantity:-200,unit:'ml',reason:'실사',unit_cost:null,counted_quantity:6200}];
 d.recipes=d.recipes.map(r=>r.menu_id==='M02'&&r.material_id==='I02'?{...r,quantity:200}:r);
 d.sales=[buildSale(saleInput({date:'2026-09-18',menu_id:'M02',channel:'매장',quantity:'2',discount_amount:'0',payment_fee:'0'}),d).sale,
 buildSale(saleInput({menu_id:'M02',channel:'매장',quantity:'1',discount_amount:'0',payment_fee:'0'}),d).sale];return d;}
const milk=(d:Dataset,date='2026-09-18')=>inventoryAt({dataset:d,saleCostBasis:{}},date).rows.find(r=>r.material.material_id==='I02')!;
describe('EPIC 2 손익',()=>{
 it('직접비용·운영비·폐기만 반영하고 월 계획·입고·실사 금액은 중복 제외',()=>{
 const d=example();d.expenses=[{expense_id:'x',date:period.value,category:'광고비',amount:10000,recognition:'직접 입력 비용'}];d.inventory_events=[{event_id:'w',date:period.value,material_id:'I02',event_type:'폐기',quantity:-200,unit:'ml',reason:'폐기',unit_cost:999},{event_id:'r',date:period.value,material_id:'I02',event_type:'입고',quantity:1000,unit:'ml',reason:'입고',unit_cost:999},{event_id:'c',date:period.value,material_id:'I02',event_type:'실사조정',quantity:-200,unit:'ml',reason:'실사',unit_cost:null,counted_quantity:6200}];
 const p=profitLoss(d,period);expect(p.total.profit?.toString()).toBe('21142');expect(p.total.wasteLoss?.toString()).toBe('626');expect(p.categories.find(c=>c.category==='광고비')?.amount.toString()).toBe('10000');});
 it('폐기 한 건의 0.5원 경계를 올리고 중간 원가를 반올림하지 않는다',()=>{const d=fixture();d.price_history=[{material_id:'I02',effective_date:'2026-09-01',pack_price:1,pack_quantity:2}];d.inventory_events=[{event_id:'w',date:period.value,material_id:'I02',event_type:'폐기',quantity:-1,unit:'ml',reason:'폐기',unit_cost:null}];expect(wasteRows(d,period.value,period.value)[0].loss?.toString()).toBe('1');});
 it('폐기 단가 누락은 수량을 유지하고 손익까지 계산 제한 전달',()=>{const d=example();d.price_history=[];d.inventory_events=[{event_id:'w',date:period.value,material_id:'I02',event_type:'폐기',quantity:-200,unit:'ml',reason:'폐기',unit_cost:10}];const p=profitLoss(d,period);expect(p.total.wasteLoss).toBeNull();expect(p.total.profit).toBeNull();expect(p.total.net.toString()).toBe('39000');expect(p.waste[0].event.quantity).toBe(-200);});
 it('휴무일·판매 없는 날 비용을 포함하고 0매출 비율은 따로 처리',()=>{const d=fixture();d.calendar=[{date:period.value,is_open:false,record_complete:true,weather:'',note:''}];d.expenses=[{expense_id:'x',date:period.value,category:'임차료',amount:10000,recognition:'월비용 일할 배분'}];const p=profitLoss(d,period);expect(p.total.profit?.toString()).toBe('-10000');expect(p.total.net.toString()).toBe('0');expect(p.missing).toHaveLength(0);});
 it('9월 마감과 미마감 기록을 같은 날짜 범위로 나누며 미입력은 예상치로 채우지 않는다',()=>{const d=example();d.sales.push(buildSale(saleInput({date:'2026-09-18'}),d).sale);d.expenses=[{expense_id:'x',date:period.value,category:'광고비',amount:10000,recognition:'직접 입력 비용'}];const p=profitLoss(d,{mode:'month',value:'2026-09'});expect(p.open).toHaveLength(12);expect(p.closed.net.toString()).toBe('39000');expect(p.pending.net.toString()).toBe('39000');expect(p.pending.operating.toString()).toBe('10000');expect(p.total.net.toString()).toBe('78000');expect(p.recordEnd).toBe('2026-09-19');expect(p.missing.length).toBeGreaterThan(0);});
 it('달력 밖과 휴무일 판매 상충을 구분한다',()=>{const d=example();d.calendar=[{date:period.value,is_open:false,record_complete:true,weather:'',note:''}];expect(profitLoss(d,period).inconsistent).toEqual([period.value]);expect(profitLoss(d,{mode:'day',value:'2025-06-30'}).outside).toEqual(['2025-06-30']);});
 it('기존 0수량 판매는 마감 판매 누락으로 보지 않는다',()=>{const d=example();d.calendar=[{date:period.value,is_open:true,record_complete:true,weather:'',note:''}];d.sales[0].quantity=0;d.sales[0].net_sales=0;d.sales[0].discount_amount=0;expect(profitLoss(d,period).missing).toHaveLength(0);});
 it('판매 원가 누락은 직접비용·손익 계산 제한으로 전달',()=>{const d=example();d.sales[0].unit_food_cost_snapshot=null;expect(profitLoss(d,period).total.profit).toBeNull();});
});
describe('EPIC 2 재고',()=>{
 it('6400ml 실사 전·6200ml 마감·다음날6000ml, 실측과 조정 이중 적용 금지',()=>{const d=stockFixture();expect(milk(d).balance?.toString()).toBe('6200');expect(milk(d).latestCount?.currentDifference?.toString()).toBe('-200');expect(milk(d,'2026-09-19').balance?.toString()).toBe('6000');});
 it('과거 판매 변경 후 실측·저장 차이 보존, 재계산 차이만 변경',()=>{const d=stockFixture();d.sales[0].quantity=1;const r=milk(d);expect(r.balance?.toString()).toBe('6200');expect(r.latestCount?.savedDifference?.toString()).toBe('-200');expect(r.latestCount?.currentDifference?.toString()).toBe('-400');expect(milk(d,'2026-09-19').balance?.toString()).toBe('6000');});
 it('실측 없는 조정은 증감만 반영',()=>{const d=stockFixture();delete d.inventory_events[2].counted_quantity;expect(milk(d).balance?.toString()).toBe('6200');expect(milk(d).latestCount?.counted).toBeNull();});
 it('실측0은 유효 기준이며 재고 음수를0으로 바꾸지 않는다',()=>{const d=stockFixture();d.inventory_events[2].counted_quantity=0;const r=milk(d,'2026-09-19');expect(r.balance?.toString()).toBe('-200');expect(r.issues.join()).toContain('기록상 음수');});
 it('초기 기준 없음은 계산 불가지만 실측 이후 기준 회복',()=>{const d=stockFixture();d.opening_inventory=[];expect(milk(d,'2026-09-17').balance).toBeNull();expect(milk(d).balance?.toString()).toBe('6200');expect(milk(d).latestCount?.currentDifference).toBeNull();});
 it('동일 재료·날짜 실사 충돌은 임의 선택하지 않는다',()=>{const d=stockFixture();d.inventory_events.push({...d.inventory_events[2],event_id:'c2',counted_quantity:999});expect(milk(d).balance).toBeNull();expect(milk(d).issues.join()).toContain('충돌');});
 it('판매 수정·삭제 소진량 반영, 채널별 포장과 단위 구분',()=>{const d=example();const before=inventoryAt({dataset:fixture(),saleCostBasis:{}},period.value);const after=inventoryAt({dataset:d,saleCostBasis:{}},period.value);for(const [id,amount] of [['I01',200],['I10',10]]){const a=before.rows.find(r=>r.material.material_id===id)!;const b=after.rows.find(r=>r.material.material_id===id)!;expect(a.balance!.minus(b.balance!).toNumber()).toBe(amount);}d.sales=[];expect(inventoryAt({dataset:d,saleCostBasis:{}},period.value).rows.map(r=>r.balance?.toString())).toEqual(before.rows.map(r=>r.balance?.toString()));});
 it('보존 레시피 근거를 사용하고 누락은 계산 제한 전달',()=>{const d=example();d.recipes=d.recipes.filter(r=>r.recipe_version!==d.sales[0].recipe_version);expect(inventoryAt({dataset:d,saleCostBasis:{}},period.value).rows.every(r=>r.balance===null)).toBe(true);});
 it('단위 원가·마지막 입고·부분 실사 날짜를 실제 기록으로 표시',()=>{const d=stockFixture();const result=inventoryAt({dataset:d,saleCostBasis:{}},period.value);expect(result.latestCountDate).toBe('2026-09-18');expect(milk(d).lastReceipt?.unit_cost).toBe(3.132);expect(milk(d).material.unit).toBe('ml');});
});
describe('EPIC 2 비용 검증',()=>{
 it.each(['','0','-1','1.5','text','9007199254740992'])('양수 정수 금액 조건: %s',amount=>{expect(validateExpense({date:period.value,category:'광고비',amount})).toHaveProperty('amount');});
 it('미래 날짜·잘못된 항목을 거부하고 달력 밖 과거 날짜는 허용',()=>{expect(validateExpense({date:'2026-10-13',category:'재료 구매',amount:'1'},'2026-10-12')).toHaveProperty('date');expect(validateExpense({date:'2025-06-30',category:'광고비',amount:'1'},'2026-10-12')).toEqual({});});
 it('기존 월배분 안내와 중복가능성 안내를 독립적으로 제공',()=>{const d=fixture();d.expenses=[{expense_id:'x',date:period.value,category:'임차료',amount:10000,recognition:'월비용 일할 배분'}];expect(expenseWarnings(d,{date:period.value,category:'임차료',amount:'10000'})).toEqual({duplicate:true,allocated:true});expect(expenseWarnings(d,{date:period.value,category:'임차료',amount:'10000'},'x')).toEqual({duplicate:false,allocated:false});});
});
