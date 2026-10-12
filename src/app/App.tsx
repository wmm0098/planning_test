import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import SaleDialog from '../features/sales/SaleDialog';
import ProfitLossPage from '../features/operations/ProfitLossPage';
import InventoryPage from '../features/operations/InventoryPage';
import BackupPage from '../features/operations/BackupPage';
import { periodBounds, periodStatus, todayKorea, inPeriod, type Period } from '../domain/dates';
import { formatMoney, rate } from '../domain/money';
import { aggregateSales, profitability } from '../domain/profitability';
import { saleTotals } from '../domain/sales';
import type { Sale, State } from '../domain/schemas';
import { repository, userError } from '../storage/repository';

type Route = 'sales' | 'profitability' | 'profit-loss' | 'inventory' | 'backup';
function readRoute(): { page: Route; period: Period } {
  const [path, query] = window.location.hash.slice(1).split('?');
  const params = new URLSearchParams(query);
  const period: Period = { mode: params.get('mode') === 'month' ? 'month' : 'day', value: params.get('value') ?? '2026-09-18' };
  try { periodBounds(period); } catch { period.mode = 'day'; period.value = '2026-09-18'; }
  return { page: ['/profitability','/profit-loss','/inventory','/backup'].includes(path) ? path.slice(1) as Route : 'sales', period };
}
function Metric({ label, value, note, icon, tone }: { label: string; value: string; note: string; icon: string; tone?: string }) {
  return <section className={`metric ${tone ?? ''}`}><div className="metric-top"><span>{label}</span><Icon name={icon} size={20}/></div><strong>{value}</strong><p>{note}</p></section>;
}

export default function App() {
  const [state, setState] = useState<State>();
  const [startupError, setStartupError] = useState('');
  const [recovery,setRecovery]=useState(false);
  const [route, setRoute] = useState(readRoute);
  const [menuFilter, setMenuFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('전체');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'전체' | '음료' | '디저트'>('전체');
  const [page, setPage] = useState(1);
  const [dialogState, setDialogState] = useState<{ base: State; sale?: Sale }>();
  const [deleteTarget, setDeleteTarget] = useState<{ base: State; sale: Sale }>();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const broadcast = useRef<BroadcastChannel | null>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const deleting = useRef(false);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => { if (active) setStartupError('브라우저 저장소 연결을 기다리고 있습니다. 다른 열린 창을 닫고 다시 접속해 주세요. 기존 자료는 삭제하지 않았습니다.'); }, 15000);
    repository.initialize(async () => {
      const response = await fetch(new URL('../data/seed.json', import.meta.url).href);
      if (!response.ok) throw new Error('초기 가상 자료를 읽지 못했습니다. 인터넷 연결과 프로그램 파일을 확인해 주세요.');
      return response.json();
    }).then(result => { if (active) { setState(result); setStartupError(''); } }).catch(error => { if (active) setStartupError(userError(error)); }).finally(() => clearTimeout(timer));
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => undefined);
    return () => { active = false; clearTimeout(timer); };
  }, []);
  useEffect(() => {
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('prep-cafe-changes') : null;
    broadcast.current = channel;
    if (channel) channel.onmessage = () => {
      repository.read().then(next => {
        if (next) { setState(next); setNotice('다른 창의 변경 기록을 불러왔습니다. 입력 중이었다면 닫고 최신 기록을 확인해 주세요.'); }
      }).catch(error => setActionError(userError(error)));
    };
    const handler = () => { setRoute(readRoute()); setPage(1); };
    window.addEventListener('hashchange', handler);
    return () => { channel?.close(); window.removeEventListener('hashchange', handler); };
  }, []);
  useEffect(() => { setPage(1); }, [menuFilter, channelFilter, search, route.period.value, route.period.mode]);
  useEffect(() => { if (deleteTarget) deleteDialog.current?.showModal(); }, [deleteTarget]);
  function navigate(nextPage: Route, nextPeriod = route.period) {
    window.location.hash = `/${nextPage}?mode=${nextPeriod.mode}&value=${nextPeriod.value}`;
    setRoute({ page: nextPage, period: nextPeriod });
    setNotice(''); setActionError(''); setPage(1);
  }
  function saved(next: State, date: string) {
    setState(next); setDialogState(undefined);
    setMenuFilter(''); setChannelFilter('전체'); setSearch('');
    navigate('sales', inPeriod(date, route.period) ? route.period : { mode: 'day', value: date });
    setNotice('판매 기록을 저장했습니다.');
    broadcast.current?.postMessage({ revision: next.revision });
  }
  async function remove() {
    if (!deleteTarget || deleting.current) return;
    deleting.current = true; setSaving(true); setActionError('');
    try {
      const next = await repository.deleteSale(deleteTarget.base, deleteTarget.sale.sale_id);
      setState(next); setDeleteTarget(undefined); setNotice('판매 기록을 삭제했습니다.');
      broadcast.current?.postMessage({ revision: next.revision });
    } catch (error) { setActionError(userError(error)); }
    finally { deleting.current = false; setSaving(false); }
  }
  const filteredSales = useMemo(() => state?.dataset.sales.filter(s => inPeriod(s.date, route.period)
    && (!menuFilter || menuFilter === s.menu_id) && (channelFilter === '전체' || channelFilter === s.channel)
    && (state.dataset.menus.find(m => m.menu_id === s.menu_id)?.name.includes(search.trim()) ?? false))
    .sort((a, b) => b.date.localeCompare(a.date) || a.menu_id.localeCompare(b.menu_id) || a.channel.localeCompare(b.channel)) ?? [], [state, route.period, menuFilter, channelFilter, search]);
  const salesSummary = useMemo(() => aggregateSales(filteredSales), [filteredSales]);
  const menuResults = useMemo(() => state ? profitability(state.dataset, route.period, category) : null, [state, route.period, category]);
  const status = useMemo(() => state ? periodStatus(state.dataset, route.period) : null, [state, route.period]);
  if (!state && recovery) return <main className="recovery-page"><h1>백업으로 자료 복구</h1><BackupPage onSaved={next=>{setState(next);setRecovery(false);setStartupError('');broadcast.current?.postMessage({revision:next.revision});}}/><button className="button secondary" onClick={()=>setRecovery(false)}>접속 안내로 돌아가기</button></main>;
  if (!state) return <main className="startup"><div className="brand-mark"><Icon name="cafe" size={32}/></div><h1>프렙 카페</h1>{startupError ? <><p role="alert">{startupError}</p><button className="button primary" onClick={() => window.location.reload()}>다시 접속</button><button className="button secondary" onClick={()=>setRecovery(true)}>백업으로 자료 복구</button></> : <p>가상 매장 자료와 저장소를 준비하고 있습니다…</p>}</main>;
  const summary = route.page === 'sales' ? salesSummary : menuResults!.total;
  const cardMoney = (value: Parameters<typeof formatMoney>[0]) => summary.records === 0 ? '조회 기록 없음' : formatMoney(value);
  const { start, end } = periodBounds(route.period);
  const pageCount = Math.max(1, Math.ceil(filteredSales.length / 50));
  const currentPage = Math.min(page, pageCount);
  const visibleSales = filteredSales.slice((currentPage - 1) * 50, currentPage * 50);
  const menuName = (id: string) => state.dataset.menus.find(m => m.menu_id === id)?.name ?? id;
  const openCreate = () => { setActionError(''); setDialogState({ base: state }); };
  const pageName = {'sales':'판매 관리','profitability':'메뉴 수익성','profit-loss':'기간 실적·손익','inventory':'재고 관리','backup':'백업·복원'}[route.page];
  const title = {'sales':'판매 기록 및 일별 집계','profitability':'메뉴별 수익성 분석','profit-loss':'기간 실적 및 매장 손익','inventory':'재료별 기록상 잔량','backup':'전체 자료 백업·복원'}[route.page];
  function operationsSaved(next: State) { setState(next); broadcast.current?.postMessage({revision:next.revision}); }
  return <div className="app-shell">
    <aside className="sidebar"><a href="#/sales" className="brand"><div className="brand-mark"><Icon name="cafe" size={24}/></div><div><strong>프렙 카페</strong><small>매장 운영 기록</small></div></a>
      <div className="store-label"><span className="dot"/>단일 매장<span>운영자 1명</span></div>
      <nav aria-label="주요 화면"><p className="nav-label">매장 관리</p><button className={route.page === 'sales' ? 'active' : ''} onClick={() => navigate('sales')}><Icon name="sales"/>판매 관리</button><button className={route.page === 'profitability' ? 'active' : ''} onClick={() => navigate('profitability')}><Icon name="chart"/>메뉴 수익성</button>
        <button className={route.page === 'profit-loss' ? 'active' : ''} onClick={() => navigate('profit-loss')}><Icon name="chart"/>기간 실적·손익</button><button className={route.page === 'inventory' ? 'active' : ''} onClick={() => navigate('inventory',{mode:'day',value:end})}><Icon name="stock"/>재고 관리</button><button className={route.page === 'backup' ? 'active' : ''} onClick={()=>navigate('backup')}><Icon name="shield"/>백업·복원</button>
      </nav><footer className="sidebar-foot"><div><span className="dot"/>브라우저 저장</div><p>같은 컴퓨터·브라우저에서 사용</p><div className="epic-chip">EPIC 1~3 · 검수 완료</div></footer>
    </aside>
    <div className="workspace"><header className="topbar"><div className="top-store"><Icon name="cafe" size={18}/><span>프렙 카페</span><small>가상 매장 샘플</small></div><div className="top-period"><Icon name="calendar" size={16}/><span>자료: 2025.07.01 ~ 2026.09.18 마감</span></div><div className="save-status"><span className="dot"/>저장 자료 불러옴</div></header>
    <main><div className="breadcrumbs">매장 운영 <span>/</span> {pageName}</div>
      <div className="page-heading"><div><div className="eyebrow">PREP CAFE / DAILY OPERATIONS</div><h1>{title}</h1><p>{route.page === 'sales' ? '판매를 기록하고, 당시 가격과 원가를 함께 확인하세요.' : route.page === 'profitability' ? '재료비·포장비·결제수수료를 반영한 메뉴 자체의 수익성입니다.' : route.page === 'profit-loss' ? '날짜별 비용과 폐기 손실을 반영한 운영 참고 손익입니다.' : route.page === 'inventory' ? '입력된 입고·판매·폐기와 마감 실측값을 기준으로 확인하세요.' : '저장된 전체 기록을 파일로 보관하고 백업 시점으로 복원합니다.'}</p></div>{route.page === 'sales' && <button className="button primary" onClick={openCreate}><Icon name="plus" size={18}/>신규 판매 기록 추가</button>}</div>
      {notice && <div role="status" className="success-banner"><Icon name="check" size={18}/>{notice}</div>}
      {actionError && !deleteTarget && <div role="alert" className="error-banner">{actionError}</div>}
      {route.page === 'profit-loss' ? <ProfitLossPage state={state} period={route.period} onPeriod={p=>navigate('profit-loss',p)} onSaved={operationsSaved} onInventory={()=>navigate('inventory',{mode:'day',value:end})}/> : route.page === 'inventory' ? <InventoryPage state={state} date={end} onSaved={operationsSaved} onDate={value=>navigate('inventory',{mode:'day',value})}/> : route.page === 'backup' ? <BackupPage state={state} onSaved={operationsSaved}/> : <>
      <div className={`notice-bar ${status!.closed ? 'neutral' : ''}`}><Icon name="info"/><div><strong>{route.page === 'sales' ? '판매 1행은 날짜·메뉴·채널별 하루 집계입니다.' : '공통 운영비는 메뉴별로 나누지 않습니다.'}</strong><p>{route.page === 'sales' ? status!.message : `공헌이익 = 순매출 − 식재료비 − 포장비 − 수수료. ${status!.message}`}</p></div><span className={`badge ${status!.closed ? 'closed' : 'pending'}`}>{status!.label}</span></div>
      <div className="period-bar"><div className="period-select"><Icon name="calendar"/><label className="sr-only" htmlFor="period-mode">조회 단위</label><select id="period-mode" value={route.period.mode} onChange={e => navigate(route.page, { mode: e.target.value as Period['mode'], value: e.target.value === 'month' ? route.period.value.slice(0, 7) : `${route.period.value.slice(0, 7)}-01` })}><option value="day">일별</option><option value="month">월별</option></select><label className="sr-only" htmlFor="period-value">조회 기간</label><input id="period-value" type={route.period.mode === 'day' ? 'date' : 'month'} value={route.period.value} onChange={e => { try { periodBounds({ ...route.period, value: e.target.value }); navigate(route.page, { ...route.period, value: e.target.value }); } catch { /* Preserve valid period while input is incomplete. */ } }}/></div><span className="period-text">{start === end ? start : `${start} ~ ${end}`} · {route.page === 'sales' ? '판매 목록 필터 기준' : `${category} 메뉴 기준`}</span></div>
      <div className="metrics"><Metric label="순매출" value={cardMoney(summary.net)} note={summary.records === 0 ? '입력된 판매 기록 없음' : `${summary.quantity.toString()}개 판매 · 입력 기록 기준`} icon="chart"/><Metric label="식재료·포장 비용" value={summary.food !== null && summary.packaging !== null ? cardMoney(summary.food.plus(summary.packaging)) : '일부 계산 불가'} note="판매 당시 개당 원가 적용" icon="stock"/><Metric label="결제수수료" value={cardMoney(summary.fee)} note="확인된 기록 금액 · 자동 요율 없음" icon="sales"/><Metric label={route.page === 'sales' ? '판매 공헌이익' : '메뉴 공헌이익'} value={cardMoney(summary.contribution)} note={`마진율 ${rate(summary.contribution, summary.net)} · 공통 운영비 반영 전`} icon="cafe" tone="profit"/></div>
      {summary.issues.length > 0 && <div role="status" className="error-banner">{summary.issues.join(' / ')}</div>}
      {route.page === 'sales' ? <section className="panel"><div className="panel-header"><div><h2><Icon name="sales"/>판매 기록 명세</h2><p>단가·할인·수수료·원가는 당시 기록을 보존합니다.</p></div><span className="count-badge">{filteredSales.length.toLocaleString('ko-KR')}건</span></div>
      <div className="filters"><label><span className="sr-only">메뉴 필터</span><select aria-label="메뉴 필터" value={menuFilter} onChange={e => setMenuFilter(e.target.value)}><option value="">전체 메뉴</option>{state.dataset.menus.map(m => <option key={m.menu_id} value={m.menu_id}>{m.name}</option>)}</select></label><label><span className="sr-only">채널 필터</span><select aria-label="채널 필터" value={channelFilter} onChange={e => setChannelFilter(e.target.value)}><option>전체</option><option>매장</option><option>포장</option></select></label><div className="search-input"><Icon name="search" size={17}/><input aria-label="메뉴명 검색" placeholder="메뉴명 검색" value={search} onChange={e => setSearch(e.target.value)}/></div><button className="button secondary compact" onClick={openCreate}><Icon name="plus" size={16}/>간편 입력</button></div>
      <div className="table-scroll"><table aria-label="판매 기록"><thead><tr><th>판매 날짜</th><th>메뉴명 / 출처</th><th>채널</th><th className="number">수량</th><th className="number">당시 단가</th><th className="number">전체 할인</th><th className="number">순매출</th><th className="number">수수료</th><th className="number">식재료비</th><th className="number">포장비</th><th>관리</th></tr></thead><tbody>{visibleSales.map(sale => { const totals = saleTotals(sale); const meta = state.recordMetadata[`sales:${sale.sale_id}`]; return <tr key={sale.sale_id}><td className="muted nowrap">{sale.date}</td><td><strong>{menuName(sale.menu_id)}</strong><small className="row-source">{meta?.source === 'manual' ? '직접 입력' : '가상 샘플'}{meta?.updatedAt && meta.updatedAt !== meta.createdAt ? ' · 수정 기록 포함' : ''}{totals.issues.length ? ` · ${totals.issues.join(' / ')}` : ''}</small></td><td><span className={`badge ${sale.channel === '포장' ? 'takeout' : 'store'}`}>{sale.channel}</span></td><td className="number strong">{String(sale.quantity)}개</td><td className="number muted">{formatMoney(sale.unit_price)}</td><td className="number muted">{Number(sale.discount_amount) > 0 ? '−' : ''}{formatMoney(sale.discount_amount)}</td><td className="number strong">{formatMoney(totals.net)}</td><td className="number muted">{formatMoney(totals.fee)}</td><td className="number brown">{formatMoney(totals.food)}</td><td className="number blue">{formatMoney(totals.packaging)}</td><td><div className="row-actions"><button className="icon-button" aria-label={`${sale.date} ${menuName(sale.menu_id)} ${sale.channel} 수정`} title="수정" onClick={() => { setActionError(''); setDialogState({ base: state, sale }); }}><Icon name="edit" size={17}/></button><button className="icon-button danger" aria-label={`${sale.date} ${menuName(sale.menu_id)} ${sale.channel} 삭제`} title="삭제" onClick={() => { setActionError(''); setDeleteTarget({ base: state, sale }); }}><Icon name="delete" size={17}/></button></div></td></tr>; })}</tbody>
      {filteredSales.length > 0 && <tfoot><tr><td colSpan={3}>조회 결과 전체 합계</td><td className="number">{summary.quantity.toString()}개</td><td colSpan={2}/><td className="number">{formatMoney(summary.net)}</td><td className="number">{formatMoney(summary.fee)}</td><td className="number">{formatMoney(summary.food)}</td><td className="number">{formatMoney(summary.packaging)}</td><td/></tr></tfoot>}</table>
      {!filteredSales.length && <div className="empty-state"><Icon name="sales" size={30}/><strong>조회 기록 없음</strong><p>조회 기간과 필터를 확인하거나 판매 기록을 추가하세요.<br/>기록이 없는 미마감일을 실제 판매 0으로 보지 않습니다.</p></div>}</div>
      <div className="panel-footer"><span>{filteredSales.length ? `${(currentPage - 1) * 50 + 1}–${Math.min(currentPage * 50, filteredSales.length)} / 전체 ${filteredSales.length}건` : '표시할 기록 없음'} · 합계는 전체 조회 결과 기준</span><div className="pagination"><button disabled={currentPage <= 1} onClick={() => setPage(p => p - 1)}>이전</button><span>{currentPage} / {pageCount}</span><button disabled={currentPage >= pageCount} onClick={() => setPage(p => p + 1)}>다음</button></div></div>
      </section> : <section className="panel"><div className="panel-header"><div><h2><Icon name="chart"/>메뉴별 원가 및 공헌이익 명세</h2><p>마진율은 메뉴별 비율의 평균이 아닌 전체 금액에서 계산합니다.</p></div><div className="category-tabs" aria-label="메뉴 분류">{(['전체', '음료', '디저트'] as const).map(c => <button key={c} aria-pressed={category === c} className={category === c ? 'selected' : ''} onClick={() => setCategory(c)}>{c}</button>)}</div></div><div className="table-scroll"><table aria-label="메뉴 수익성"><thead><tr><th>메뉴명</th><th>분류</th><th className="number">판매수량 (매장 / 포장)</th><th className="number">순매출</th><th className="number">식재료비 / 원가율</th><th className="number">포장비</th><th className="number">수수료</th><th className="number">공헌이익</th><th className="number">마진율</th></tr></thead><tbody>{menuResults!.rows.map(row => <tr key={row.menu.menu_id}><td><strong>{row.menu.name}</strong></td><td><span className="badge category">{row.menu.category}</span></td><td className="number"><strong>{row.quantity.toString()}개</strong><small className="row-source">매장 {row.dineIn.toString()} / 포장 {row.takeout.toString()}</small></td><td className="number strong">{formatMoney(row.net)}</td><td className="number brown">{formatMoney(row.food)}<small className="row-source">{rate(row.food, row.net)}</small></td><td className="number blue">{formatMoney(row.packaging)}</td><td className="number muted">{formatMoney(row.fee)}</td><td className="number strong">{formatMoney(row.contribution)}</td><td className="number green">{rate(row.contribution, row.net)}</td></tr>)}</tbody><tfoot><tr><td colSpan={2}>합계 / 전체 금액 기준</td><td className="number">{summary.quantity.toString()}개</td><td className="number">{formatMoney(summary.net)}</td><td className="number">{formatMoney(summary.food)}</td><td className="number">{formatMoney(summary.packaging)}</td><td className="number">{formatMoney(summary.fee)}</td><td className="number">{formatMoney(summary.contribution)}</td><td className="number">{rate(summary.contribution, summary.net)}</td></tr></tfoot></table></div><div className="panel-footer">판매가 없는 메뉴는 금액 0, 마진율은 계산 대상 없음으로 표시합니다.</div></section>}
      </>}
      <footer className="page-foot"><Icon name="shield" size={16}/><span>자료는 이 브라우저에 보관됩니다. 실제 매장 기록은 서버로 전송하지 않습니다.</span><span>기록 {state.dataset.sales.length.toLocaleString('ko-KR')}건 · 저장 변경 번호 {state.revision}</span></footer>
    </main></div>
    {dialogState && <SaleDialog base={dialogState.base} sale={dialogState.sale} defaultDate={route.period.mode === 'day' ? route.period.value : start} onClose={() => setDialogState(undefined)} onSaved={saved}/>}
    {deleteTarget && <dialog ref={deleteDialog} className="delete-dialog" aria-labelledby="delete-heading" onCancel={e => { if (saving) e.preventDefault(); else setDeleteTarget(undefined); }}><div className="delete-symbol"><Icon name="delete" size={27}/></div><h2 id="delete-heading">판매 기록을 삭제할까요?</h2><p>{deleteTarget.sale.date} · {menuName(deleteTarget.sale.menu_id)} · {deleteTarget.sale.channel}</p><div className="delete-details">{String(deleteTarget.sale.quantity)}개 · 순매출 {formatMoney(deleteTarget.sale.net_sales)}</div><p>수익성과 관련 계산에서 이 기록이 빠집니다.<br/>저장 실패 시 기존 기록은 유지됩니다.</p>{actionError && <div role="alert" className="error-banner">{actionError}</div>}<div className="dialog-actions"><button className="button secondary" disabled={saving} onClick={() => setDeleteTarget(undefined)}>취소</button><button className="button delete" disabled={saving} onClick={remove}>{saving ? '삭제 중…' : '삭제 확정'}</button></div></dialog>}
  </div>;
}
