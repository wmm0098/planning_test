import 'fake-indexeddb/auto';
import { openDB, deleteDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { Repository } from '../src/storage/repository';
import { fixture, saleInput } from './fixtures';
import { aggregateSales } from '../src/domain/profitability';
import { materialConsumption } from '../src/domain/sales';

const owned: { repository: Repository; name: string }[] = [];
function repo(name = `test-${crypto.randomUUID()}`) { const repository = new Repository(name); owned.push({ repository, name }); return repository; }
afterEach(async () => { for (const entry of owned) await entry.repository.close(); for (const name of new Set(owned.map(e => e.name))) await deleteDB(name); owned.length = 0; });
describe('F01·F03·F04·F11 실제 저장 작업', () => {
  it('초기자료를 한 번만 반영하고 재접속해도 직접 기록과 다른 모든 자료를 유지한다', async () => {
    const repository = repo(); let calls = 0;
    const first = await repository.initialize(async () => { calls++; return fixture(); });
    const saved = await repository.saveSale(first, saleInput());
    const again = await repository.initialize(async () => { calls++; return fixture(); });
    expect(calls).toBe(1); expect(again.dataset.sales).toEqual(saved.dataset.sales);
    expect(again.dataset.monthly_expense_plan).toEqual(first.dataset.monthly_expense_plan);
    expect(again.dataset.inventory_events).toEqual(first.dataset.inventory_events);
    expect(again.recordMetadata[`sales:${saved.dataset.sales[0].sale_id}`].source).toBe('manual');
    expect(again.saleCostBasis[saved.dataset.sales[0].sale_id].food).toBe('496.8');
  });
  it('동시 초기화에서 자료를 합치거나 반복 저장하지 않는다', async () => {
    const name = `test-${crypto.randomUUID()}`; const a = repo(name), b = repo(name);
    const results = await Promise.all([a.initialize(async () => fixture()), b.initialize(async () => fixture())]);
    expect(results[0].revision).toBe(0); expect(results[1]).toEqual(results[0]);
  });
  it('같은 날짜·메뉴·채널 등록과 수정 충돌은 저장하지 않는다', async () => {
    const repository = repo(); const start = await repository.initialize(async () => fixture());
    const first = await repository.saveSale(start, saleInput());
    await expect(repository.saveSale(first, saleInput())).rejects.toThrow('기존 기록');
    const second = await repository.saveSale(first, saleInput({ channel: '매장' }));
    const id = second.dataset.sales.find(s => s.channel === '매장')!.sale_id;
    await expect(repository.saveSale(second, saleInput(), id)).rejects.toThrow('기존 기록');
    expect((await repository.read())!.revision).toBe(second.revision);
  });
  it('수정·삭제를 저장하고 합계·재료 소진량에서 기존 기여분이 빠진다', async () => {
    const repository = repo(); const start = await repository.initialize(async () => fixture());
    const first = await repository.saveSale(start, saleInput()); const id = first.dataset.sales[0].sale_id;
    const second = await repository.saveSale(first, saleInput({ quantity: '5' }), id);
    expect(aggregateSales(second.dataset.sales).contribution?.toString()).toBe('15084');
    expect(materialConsumption(second.dataset.sales[0], second.dataset, second.saleCostBasis[id])[0].quantity).toBe('100');
    const third = await repository.deleteSale(second, id);
    expect(aggregateSales(third.dataset.sales).net.toString()).toBe('0');
    expect((await repository.read())!.dataset.sales).toHaveLength(0);
    expect(third.saleCostBasis[id]).toBeUndefined();
  });
  it('여러 창의 오래된 수정·삭제를 막고 최신 자료를 유지한다', async () => {
    const name = `test-${crypto.randomUUID()}`; const a = repo(name), b = repo(name);
    const start = await a.initialize(async () => fixture());
    const stale = await b.read();
    const saved = await a.saveSale(start, saleInput());
    await expect(b.saveSale(stale!, saleInput({ menu_id: 'M02' }))).rejects.toThrow('다른 창');
    await expect(b.deleteSale({ ...saved, revision: start.revision }, saved.dataset.sales[0].sale_id)).rejects.toThrow('다른 창');
    expect((await a.read())!.dataset.sales).toHaveLength(1);
  });
  it('저장 중 의도적 실패에도 전체 이전 자료와 변경 번호를 유지한다', async () => {
    const repository = repo(); const first = await repository.initialize(async () => fixture());
    const next = structuredClone(first); next.dataset.settings.test = true;
    await expect(repository.commit(first.revision, next, () => { throw new DOMException('검사용 공간 부족', 'QuotaExceededError'); })).rejects.toThrow();
    expect(await repository.read()).toEqual(first);
  });
  it('저장된 손상·미지원 버전을 초기자료로 덮어쓰지 않는다', async () => {
    const name = `test-${crypto.randomUUID()}`;
    const repository = repo(name); const first = await repository.initialize(async () => fixture());
    const db = await openDB(name, 1); await db.put('state', { ...first, schemaVersion: 99 }, 'active'); db.close();
    let loaded = false;
    await expect(repository.initialize(async () => { loaded = true; return fixture(); })).rejects.toThrow('형식 또는 버전');
    expect(loaded).toBe(false);
  });
  it('새 입력 검증 실패와 없는 대상 삭제에서 기존 자료를 보존한다', async () => {
    const repository = repo(); const first = await repository.initialize(async () => fixture());
    await expect(repository.saveSale(first, saleInput({ payment_fee: '' }))).rejects.toThrow();
    await expect(repository.deleteSale(first, 'MISSING')).rejects.toThrow('기록이 없습니다');
    expect(await repository.read()).toEqual(first);
  });
});
