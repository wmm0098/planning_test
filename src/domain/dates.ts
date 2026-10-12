import { validDate, type Dataset } from './schemas';
export type Period = { mode: 'day' | 'month'; value: string };
export function todayKorea(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function periodBounds(period: Period) {
  if (period.mode === 'day') {
    if (!validDate(period.value)) throw new Error('조회 날짜를 확인해 주세요.');
    return { start: period.value, end: period.value };
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period.value)) throw new Error('조회 월을 확인해 주세요.');
  const [year, month] = period.value.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${period.value}-01`, end: `${period.value}-${last}` };
}
export function inPeriod(date: string, period: Period) {
  const { start, end } = periodBounds(period);
  return date >= start && date <= end;
}
export function periodStatus(data: Dataset, period: Period) {
  const { start, end } = periodBounds(period);
  const calendar = data.calendar.filter(r => r.date >= start && r.date <= end);
  const datesWithSales = new Set(data.sales.filter(s => inPeriod(s.date, period)).map(s => s.date));
  const hasOpen = calendar.some(r => !r.record_complete);
  const missing = calendar.filter(r => r.is_open && r.record_complete && !datesWithSales.has(r.date));
  const inconsistent = calendar.filter(r => !r.is_open && datesWithSales.has(r.date));
  const outside = start < data.meta.start_date || end > (data.calendar.at(-1)?.date ?? data.meta.as_of);
  const closed = calendar.length > 0 && !hasOpen && !missing.length && !outside && !inconsistent.length;
  return { label: closed ? '마감 기록' : '잠정 · 기록 확인', closed, missing, inconsistent, hasOpen, outside,
    message: hasOpen ? '미마감 날짜는 판매 0이 아닙니다. 입력된 기록만 잠정 실적으로 표시합니다.'
      : outside ? '영업달력 범위 밖입니다. 입력된 기록만 표시하며 마감 여부는 확인되지 않았습니다.'
      : missing.length ? '마감된 영업일에 판매 기록이 없습니다. 기록 누락 여부를 확인해 주세요.'
      : inconsistent.length ? '휴무일에 판매가 기록되어 있습니다. 영업 여부와 판매 기록을 확인해 주세요.'
      : '저장된 마감 기록 기준입니다. 사용자 수정·삭제는 가능하며 당시 원가를 보존합니다.' };
}
