import { z } from 'zod';
import { validateState } from '../storage/repository';
import { saleTotals } from './sales';
import { inventoryAt,wasteRows } from './operations';
import type { State } from './schemas';
export const STORE_ID='prep-cafe-single-store';
const envelope=z.object({format:z.literal('prep-cafe-backup'),backupVersion:z.literal(1),createdAt:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/).refine(v=>Number.isFinite(new Date(v).valueOf())),appVersion:z.string().min(1),storeId:z.literal(STORE_ID),datasetId:z.literal('prep-cafe-operations'),schemaVersion:z.literal(1),calculationVersion:z.literal(1),payload:z.unknown()});
export type Backup=Omit<z.infer<typeof envelope>,'payload'>&{payload:State};
export function koreanStamp(now:Date){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const v=(type:string)=>parts.find(p=>p.type===type)!.value;
 return {createdAt:`${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}:${v('second')}+09:00`,filename:`prep-cafe-backup-${v('year')}${v('month')}${v('day')}-${v('hour')}${v('minute')}${v('second')}.json`};
}
export function createBackup(state:State,now=new Date()){
 validateState(state);
 const {createdAt,filename}=koreanStamp(now);
 const backup:Backup={format:'prep-cafe-backup',backupVersion:1,createdAt,appVersion:'0.1.0',storeId:STORE_ID,datasetId:'prep-cafe-operations',schemaVersion:1,calculationVersion:1,payload:structuredClone(state)};
 return {backup,filename,text:JSON.stringify(backup,null,2)};
}
export function parseBackup(text:string,current?:State):Backup{
 let raw:unknown;try{raw=JSON.parse(text);}catch{throw new Error('JSON 파일이 손상되었거나 읽을 수 없습니다. 현재 자료는 유지됩니다.');}
 const parsed=envelope.safeParse(raw);
 if(!parsed.success)throw new Error('전용 백업 형식·지원 버전·매장·백업시각을 확인해 주세요. 초기 제공 JSON은 복원 파일이 아닙니다.');
 const payload=validateState(parsed.data.payload);
 if(payload.dataset.meta.dataset_id!==parsed.data.datasetId || payload.dataset.meta.store_name!==(current?.dataset.meta.store_name??'프렙 카페') || payload.dataset.meta.dataset_id!==(current?.dataset.meta.dataset_id??'prep-cafe-operations'))throw new Error('다른 매장의 자료는 복원할 수 없습니다.');
 return {...parsed.data,payload};
}
export function backupSummary(backup:Backup){
 const d=backup.payload.dataset;
 const dates=[...d.sales,...d.expenses,...d.inventory_events,...d.opening_inventory].map(r=>r.date).sort();
 const incompleteSales=d.sales.filter(s=>saleTotals(s).contribution===null).length;
 const incompleteWaste=wasteRows(d,d.meta.start_date,dates.at(-1)??d.meta.as_of).filter(w=>w.loss===null).length;
 const incompleteStock=inventoryAt(backup.payload,dates.at(-1)??d.meta.as_of).rows.filter(r=>r.balance===null).length;
 const incompleteComparisons=Object.values(backup.payload.auditComparisons).filter(a=>(a as {difference:string|null}).difference===null).length;
 const issues=[...(incompleteComparisons?[`당시 비교 잔량·차이 계산 제한 실사 ${incompleteComparisons}건`]:[]),...(incompleteSales?[`원가·수수료 계산 제한 판매 ${incompleteSales}건`]:[]),...(incompleteWaste?[`가격 없는 폐기 ${incompleteWaste}건`]:[]),...(incompleteStock?[`잔량 계산 제한 재료 ${incompleteStock}개`]:[])];
 return {store:d.meta.store_name,createdAt:backup.createdAt,start:dates[0]??'기록 없음',end:dates.at(-1)??'기록 없음',sales:d.sales.length,expenses:d.expenses.length,inventory:d.inventory_events.length,issues};
}
