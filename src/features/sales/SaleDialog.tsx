import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../app/Icon';
import { buildSale, saleTotals, validateSaleInput, type FieldErrors, type SaleInput } from '../../domain/sales';
import { formatMoney, D } from '../../domain/money';
import { type Sale, type State } from '../../domain/schemas';
import { repository, userError } from '../../storage/repository';

export default function SaleDialog({ base, sale, defaultDate, onClose, onSaved }: {
  base: State; sale?: Sale; defaultDate: string; onClose: () => void; onSaved: (next: State, date: string) => void;
}) {
  const initial = useMemo<SaleInput>(() => sale ? {
    date: sale.date, menu_id: sale.menu_id, channel: sale.channel, quantity: String(sale.quantity), unit_price: String(sale.unit_price),
    discount_amount: String(sale.discount_amount), payment_fee: sale.payment_fee == null ? '' : String(sale.payment_fee),
  } : { date: defaultDate, menu_id: '', channel: '매장', quantity: '', unit_price: '', discount_amount: '0', payment_fee: '' }, [sale, defaultDate]);
  const [input, setInput] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const dirty = JSON.stringify(input) !== JSON.stringify(initial);
  const preview = useMemo(() => {
    if (Object.keys(validateSaleInput(input, base.dataset)).length) return { totals: null, message: '필수 항목을 입력하면 판매 금액과 원가를 계산합니다.' };
    try { return { totals: saleTotals(buildSale(input, base.dataset, sale).sale), message: '' }; }
    catch (e) { return { totals: null, message: userError(e) }; }
  }, [input, base, sale]);
  useEffect(() => { dialog.current?.showModal(); dialog.current?.querySelector<HTMLInputElement>('input[type="date"]')?.focus(); return () => dialog.current?.close(); }, []);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty || saving) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, saving]);
  function close() {
    if (pending.current) return;
    if (!dirty || window.confirm('입력을 버리고 닫을까요? 저장하지 않은 내용은 반영되지 않습니다.')) onClose();
  }
  function update(field: keyof SaleInput, value: string) {
    setErrors(previous => ({ ...previous, [field]: undefined })); setError('');
    setInput(previous => {
      const next = { ...previous, [field]: value };
      if (field === 'menu_id' && value !== previous.menu_id) next.unit_price = String(base.dataset.menus.find(m => m.menu_id === value)?.price ?? '');
      return next;
    });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (pending.current) return;
    const invalid = validateSaleInput(input, base.dataset);
    setErrors(invalid); setError('');
    if (Object.keys(invalid).length) return;
    try {
      const candidate = buildSale(input, base.dataset, sale);
      const net = D(candidate.sale.net_sales);
      if (D(input.payment_fee).gt(net) && !window.confirm('결제수수료가 순매출보다 큽니다. 확인한 금액으로 저장할까요?')) return;
      pending.current = true; setSaving(true);
      const next = await repository.saveSale(base, input, sale?.sale_id);
      onSaved(next, input.date);
    } catch (e) { setError(userError(e)); }
    finally { pending.current = false; setSaving(false); }
  }
  const field = (key: keyof SaleInput, label: string, unit?: string) => <label className="field">
    <span>{label}</span><div className="input-unit"><input name={key} aria-label={label} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `error-${key}` : undefined}
      inputMode="numeric" autoComplete="off" value={input[key]} onChange={e => update(key, e.target.value.replaceAll(',', ''))} disabled={saving}/>{unit && <span>{unit}</span>}</div>
    {errors[key] && <small id={`error-${key}`} className="field-error">{errors[key]}</small>}
  </label>;
  const changedBasis = sale && (sale.date !== input.date || sale.menu_id !== input.menu_id || sale.channel !== input.channel);
  return <dialog ref={dialog} className="sale-dialog" aria-labelledby="dialog-heading" onCancel={e => { e.preventDefault(); close(); }}>
    <header className="dialog-head"><div className="title-icon"><Icon name="sales"/><div><h2 id="dialog-heading">{sale ? '판매 기록 수정' : '신규 판매 기록 등록'}</h2><p>날짜 · 메뉴 · 채널별 하루 판매 합계</p></div></div><button type="button" className="icon-button" aria-label="닫기" onClick={close} disabled={saving}><Icon name="close"/></button></header>
    <div className="dialog-notice"><Icon name="shield" size={18}/><span>{sale && !changedBasis ? '수량·금액 수정에는 저장된 당시 개당 원가를 유지합니다.' : '판매 날짜의 레시피와 재료 가격을 적용합니다. 수수료는 확인한 금액을 입력해 주세요.'}</span></div>
    <form noValidate onSubmit={save} className="sale-form">
      <div className="form-grid two">
        <label className="field"><span>판매 날짜</span><input name="date" type="date" aria-label="판매 날짜" value={input.date} disabled={saving} onChange={e => update('date', e.target.value)} aria-invalid={!!errors.date}/>{errors.date && <small className="field-error">{errors.date}</small>}</label>
        <label className="field"><span>메뉴 선택</span><select name="menu_id" aria-label="메뉴 선택" value={input.menu_id} onChange={e => update('menu_id', e.target.value)} disabled={saving} aria-invalid={!!errors.menu_id}><option value="">메뉴를 선택하세요</option>{base.dataset.menus.map(m => <option key={m.menu_id} value={m.menu_id}>{m.name} · {formatMoney(m.price)}</option>)}</select>{errors.menu_id && <small className="field-error">{errors.menu_id}</small>}</label>
      </div>
      <fieldset className="channel-field"><legend>판매 채널</legend><div className="form-grid two">{(['매장', '포장'] as const).map(channel => <label className={`channel-choice ${input.channel === channel ? 'selected' : ''}`} key={channel}><input type="radio" name="channel" aria-label={channel} value={channel} checked={input.channel === channel} disabled={saving} onChange={() => update('channel', channel)}/><div><strong>{channel}</strong><small>{channel === '포장' ? '포장 전용 재료 원가 포함' : '포장 전용 재료 제외'}</small></div></label>)}</div></fieldset>
      <div className="form-grid three">{field('quantity', '판매 수량', '개')}{field('unit_price', '판매 단가', '원')}{field('discount_amount', '전체 할인 금액', '원')}</div>
      {field('payment_fee', '결제수수료 · 확인한 전체 금액', '원')}
      <p className="form-hint">할인과 수수료는 이 기록 전체 금액입니다. 수수료가 없으면 0을 입력해 주세요.</p>
      <section className="preview" aria-label="저장 전 계산"><div className="preview-label"><strong>저장 전 계산</strong><span>아직 기록에 반영되지 않았습니다</span></div>
        {preview.totals ? <div className="preview-grid">{[['순매출', preview.totals.net], ['식재료비', preview.totals.food], ['포장비', preview.totals.packaging], ['수수료', preview.totals.fee], ['공헌이익', preview.totals.contribution]].map(([label, value]) => <div key={String(label)} className={label === '공헌이익' ? 'preview-profit' : ''}><small>{String(label)}</small><strong>{formatMoney(value as Parameters<typeof formatMoney>[0])}</strong></div>)}</div> : <p>{preview.message}</p>}
        {changedBasis && preview.totals && sale && <p className="basis-change">적용 조건 변경: 식재료비 {formatMoney(saleTotals(sale).food)} → {formatMoney(preview.totals.food)} / 포장비 {formatMoney(saleTotals(sale).packaging)} → {formatMoney(preview.totals.packaging)}</p>}
      </section>
      {error && <div role="alert" className="error-banner">{error}</div>}
      <footer className="dialog-actions"><button type="button" className="button secondary" onClick={close} disabled={saving}>취소</button><button type="submit" className="button primary" disabled={saving}><Icon name="check" size={17}/>{saving ? '저장 중…' : sale ? '수정 저장하기' : '기록 저장하기'}</button></footer>
    </form>
  </dialog>;
}
