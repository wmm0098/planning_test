import { useEffect, useRef, useState } from 'react';
import { expenseCategories, expenseWarnings, validateExpense, type Expense, type ExpenseInput } from '../../domain/expenses';
import type { State } from '../../domain/schemas';
import { repository, userError } from '../../storage/repository';
import { formatMoney } from '../../domain/money';
import Icon from '../../app/Icon';
export default function ExpenseDialog({base,expense,defaultDate,onClose,onSaved}: {base:State;expense?:Expense;defaultDate:string;onClose:()=>void;onSaved:(state:State,date:string)=>void}) {
  const initial:ExpenseInput = expense ? {date:expense.date,category:expense.category,amount:String(expense.amount)} : {date:defaultDate,category:'',amount:''};
  const [input,setInput] = useState(initial), [errors,setErrors] = useState<ReturnType<typeof validateExpense>>({}), [error,setError] = useState(''), [saving,setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), pending = useRef(false);
  const dirty = JSON.stringify(input)!==JSON.stringify(initial);
  const warnings = expenseWarnings(base.dataset,input,expense?.expense_id);
  useEffect(()=> { dialog.current?.showModal(); dialog.current?.querySelector<HTMLInputElement>('input[type="date"]')?.focus(); return ()=>dialog.current?.close(); },[]);
  useEffect(()=> { const handler=(e:BeforeUnloadEvent)=> {if(dirty||saving){e.preventDefault();e.returnValue='';}}; window.addEventListener('beforeunload',handler);return ()=>window.removeEventListener('beforeunload',handler); },[dirty,saving]);
  function close(){ if(!pending.current && (!dirty || window.confirm('입력을 버리고 닫을까요? 저장하지 않은 내용은 반영되지 않습니다.'))) onClose(); }
  function update(key:keyof ExpenseInput,value:string){setInput(i=>({...i,[key]:value}));setErrors(e=>({...e,[key]:undefined}));setError('');}
  async function save(e:React.FormEvent){
    e.preventDefault();if(pending.current)return;
    const invalid=validateExpense(input);setErrors(invalid);if(Object.keys(invalid).length)return;
    if(warnings.duplicate&&!window.confirm('같은 날짜·항목·금액의 비용이 있습니다. 별개의 비용으로 저장할까요?'))return;
    pending.current=true;setSaving(true);setError('');
    try{onSaved(await repository.saveExpense(base,input,expense?.expense_id,warnings.duplicate),input.date);}catch(e){setError(userError(e));}finally{pending.current=false;setSaving(false);}
  }
  return <dialog ref={dialog} className="sale-dialog expense-dialog" aria-labelledby="expense-heading" onCancel={e=>{e.preventDefault();close();}}>
    <header className="dialog-head"><div className="title-icon"><Icon name="chart"/><h2 id="expense-heading">{expense?'비용 기록 수정':'비용 기록 입력'}</h2></div><button className="icon-button" aria-label="닫기" onClick={close} disabled={saving}><Icon name="close"/></button></header>
    <div className="dialog-notice"><Icon name="info"/><span>재료 구매는 입고에서 기록합니다. 월비용 계획은 다시 더하지 않습니다.</span></div>
    <form noValidate onSubmit={save} className="sale-form">
      <label className="field"><span>귀속 날짜</span><input type="date" aria-label="귀속 날짜" value={input.date} onChange={e=>update('date',e.target.value)} disabled={saving}/>{errors.date&&<small className="field-error">{errors.date}</small>}</label>
      <label className="field"><span>비용항목</span><select aria-label="비용항목" value={input.category} onChange={e=>update('category',e.target.value)} disabled={saving}><option value="">항목을 선택하세요</option>{expenseCategories.map(c=><option key={c}>{c}</option>)}</select>{errors.category&&<small className="field-error">{errors.category}</small>}</label>
      <label className="field"><span>비용 금액</span><div className="input-unit"><input aria-label="비용 금액" inputMode="numeric" value={input.amount} onChange={e=>update('amount',e.target.value.replaceAll(',',''))} disabled={saving}/><span>원</span></div>{errors.amount&&<small className="field-error">{errors.amount}</small>}</label>
      {warnings.allocated&&<div className="notice-bar">이 날짜·항목에 월비용 일할 배분 기록이 있습니다. 기존 비용을 수정하려는 경우 수정 기능을 사용하세요.</div>}
      {warnings.duplicate&&<div className="notice-bar">같은 날짜·항목·금액의 비용이 있습니다. 별개 비용인지 확인이 필요합니다.</div>}
      <section className="preview"><strong>저장 전 계산</strong><p>{Object.keys(validateExpense(input)).length?'날짜·항목·금액을 입력하세요.':`운영비 ${formatMoney(input.amount)} 반영 · 메뉴 공헌이익은 변하지 않습니다.`}</p><small>귀속일의 손익에 반영합니다. 달력 밖·미마감 날짜는 잠정 기록입니다.</small></section>
      {error&&<div role="alert" className="error-banner">{error}</div>}
      <footer className="dialog-actions"><button type="button" className="button secondary" onClick={close} disabled={saving}>취소</button><button className="button primary" disabled={saving}>{saving?'저장 중…':expense?'비용 수정 저장하기':'비용 저장하기'}</button></footer>
    </form>
  </dialog>;
}
