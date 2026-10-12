import { test, expect, type Page } from '@playwright/test';

const date = '2026-09-19';
const route = `/#/sales?mode=day&value=${date}`;
async function start(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-12T03:00:00Z'));
  await page.goto(route);
  await expect(page.getByRole('heading', { name: '판매 기록 및 일별 집계' })).toBeVisible();
}
async function fillSale(page: Page, menu = 'M01') {
  await page.getByRole('button', { name: '신규 판매 기록 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '신규 판매 기록 등록' });
  await expect(dialog.getByLabel('판매 날짜', { exact: true })).toBeFocused();
  await dialog.getByLabel('판매 날짜', { exact: true }).fill(date);
  await dialog.getByLabel('메뉴 선택', { exact: true }).selectOption(menu);
  await dialog.getByRole('radio', { name: '포장', exact: true }).check();
  await dialog.getByLabel('판매 수량', { exact: true }).fill('10');
  await dialog.getByLabel('판매 단가', { exact: true }).fill('4000');
  await dialog.getByLabel('전체 할인 금액', { exact: true }).fill('1000');
  await dialog.getByLabel('결제수수료 · 확인한 전체 금액', { exact: true }).fill('600');
  return dialog;
}
test('판매 등록→재접속→수익성→수정→삭제 취소·확정', async ({ page }) => {
  await start(page);
  await expect(page.locator('.empty-state').getByText('조회 기록 없음', { exact: true })).toBeVisible();
  const dialog = await fillSale(page);
  const preview = dialog.getByRole('region', { name: '저장 전 계산' });
  for (const amount of ['39,000원', '4,968원', '1,664원', '31,768원']) await expect(preview.getByText(amount, { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '기록 저장하기' }).click();
  await expect(page.getByRole('status')).toContainText('판매 기록을 저장했습니다');
  const table = page.getByRole('table', { name: '판매 기록', exact: true });
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.locator('tbody tr')).toContainText('직접 입력');
  await expect(page.getByText('잠정 · 기록 확인', { exact: true })).toBeVisible();
  await page.reload();
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: '메뉴 수익성', exact: true }).click();
  const profitTable = page.getByRole('table', { name: '메뉴 수익성', exact: true });
  const americano = profitTable.locator('tbody tr').filter({ hasText: '아메리카노' });
  await expect(americano).toContainText('31,768원');
  await expect(americano).toContainText('81.5%');
  await page.getByRole('button', { name: '디저트', exact: true }).click();
  await expect(profitTable.locator('tbody tr')).toHaveCount(2);
  await expect(profitTable).toContainText('계산 대상 없음');
  await page.getByRole('button', { name: '판매 관리', exact: true }).click();
  await page.getByRole('button', { name: `${date} 아메리카노 포장 수정` }).click();
  const edit = page.getByRole('dialog', { name: '판매 기록 수정' });
  await edit.getByLabel('판매 수량', { exact: true }).fill('5');
  await expect(edit.getByRole('region', { name: '저장 전 계산' })).toContainText('15,084원');
  await edit.getByRole('button', { name: '수정 저장하기' }).click();
  await expect(table.locator('tbody tr')).toContainText('19,000원');
  await page.reload();
  await expect(table.locator('tbody tr')).toContainText('5개');
  await page.getByRole('button', { name: `${date} 아메리카노 포장 삭제` }).click();
  await page.getByRole('dialog', { name: '판매 기록을 삭제할까요?' }).getByRole('button', { name: '취소' }).click();
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: `${date} 아메리카노 포장 삭제` }).click();
  await page.getByRole('button', { name: '삭제 확정' }).click();
  await expect(table.locator('tbody tr')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.empty-state').getByText('조회 기록 없음', { exact: true })).toBeVisible();
});

test('입력 오류·미래일·가격 누락·중복 기록을 저장하지 않는다', async ({ page }) => {
  await start(page); let dialog = await fillSale(page);
  await dialog.getByLabel('판매 수량', { exact: true }).fill('0');
  await dialog.getByRole('button', { name: '기록 저장하기' }).click();
  await expect(dialog.getByText('판매수량은 1개 이상의 정수여야 합니다.')).toBeVisible();
  await dialog.getByLabel('판매 수량', { exact: true }).fill('10');
  await dialog.getByLabel('결제수수료 · 확인한 전체 금액', { exact: true }).fill('');
  await dialog.getByRole('button', { name: '기록 저장하기' }).click();
  await expect(dialog.getByText('0 이상의 정수 금액을 입력해 주세요.')).toBeVisible();
  await dialog.getByLabel('결제수수료 · 확인한 전체 금액', { exact: true }).fill('600');
  await dialog.getByLabel('판매 날짜', { exact: true }).fill('2026-10-13');
  await dialog.getByRole('button', { name: '기록 저장하기' }).click();
  await expect(dialog.getByText('미래 날짜는 실적 기록으로 저장할 수 없습니다.')).toBeVisible();
  await dialog.getByLabel('판매 날짜', { exact: true }).fill('2025-06-30');
  await dialog.getByRole('button', { name: '기록 저장하기' }).click();
  await expect(dialog.getByRole('alert')).toContainText('적용할 가격이 없습니다');
  await dialog.getByLabel('판매 날짜', { exact: true }).fill(date);
  await dialog.getByRole('button', { name: '기록 저장하기' }).click();
  await expect(dialog).not.toBeVisible();
  dialog = await fillSale(page);
  await dialog.getByRole('button', { name: '기록 저장하기' }).click();
  await expect(dialog.getByRole('alert')).toContainText('기존 기록의 수정 기능');
  page.once('dialog', d => d.accept());
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('table', { name: '판매 기록', exact: true }).locator('tbody tr')).toHaveCount(1);
});

test('미저장 취소 확인과 수수료 경고를 실제로 처리한다', async ({ page }) => {
  await start(page); const dialog = await fillSale(page);
  page.once('dialog', d => d.dismiss());
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('결제수수료 · 확인한 전체 금액', { exact: true }).fill('40000');
  page.once('dialog', d => d.dismiss());
  await dialog.getByRole('button', { name: '기록 저장하기' }).click();
  await expect(dialog).toBeVisible();
  page.once('dialog', d => d.accept());
  await dialog.getByRole('button', { name: '기록 저장하기' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: '메뉴 수익성', exact: true }).click();
  await expect(page.getByRole('table', { name: '메뉴 수익성', exact: true })).toContainText('-7,632원');
});

test('다른 창에서 변경한 뒤 오래된 입력을 저장해 덮어쓰지 않는다', async ({ page, context }) => {
  await start(page);
  const other = await context.newPage(); await start(other);
  const stale = await fillSale(other, 'M02');
  const first = await fillSale(page);
  await first.getByRole('button', { name: '기록 저장하기' }).click();
  await expect(first).not.toBeVisible();
  await stale.getByRole('button', { name: '기록 저장하기' }).click();
  await expect(stale.getByRole('alert')).toContainText('다른 창에서 자료가 변경되었습니다');
  await expect(stale.getByLabel('판매 수량', { exact: true })).toHaveValue('10');
  await page.reload();
  await expect(page.getByRole('table', { name: '판매 기록', exact: true }).locator('tbody tr')).toHaveCount(1);
});

test('저장 공간 오류에도 입력과 이전 자료를 보존하고 재시도한다', async ({ page }) => {
  await start(page); const dialog = await fillSale(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      IDBObjectStore.prototype.put = original;
      throw new DOMException('검사용 저장 공간 부족', 'QuotaExceededError');
    };
  });
  await dialog.getByRole('button', { name: '기록 저장하기' }).click();
  await expect(dialog.getByRole('alert')).toContainText('저장 공간이 부족합니다');
  await expect(dialog.getByLabel('판매 수량', { exact: true })).toHaveValue('10');
  await dialog.getByRole('button', { name: '기록 저장하기' }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('table', { name: '판매 기록', exact: true }).locator('tbody tr')).toHaveCount(1);
});

test('월별 목록의 페이지 이동과 메뉴·채널·검색 필터가 합계와 일치한다', async ({ page }) => {
  await start(page);
  await page.getByLabel('조회 단위', { exact: true }).selectOption('month');
  const table = page.getByRole('table', { name: '판매 기록', exact: true });
  await expect(table.locator('tbody tr')).toHaveCount(50);
  const subtotal = await table.locator('tfoot').innerText();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(table.locator('tbody tr')).toHaveCount(50);
  await expect(table.locator('tfoot')).toHaveText(subtotal, { useInnerText: true });
  await page.getByLabel('메뉴 필터', { exact: true }).selectOption('M01');
  await page.getByLabel('채널 필터', { exact: true }).selectOption('포장');
  await expect(table.locator('tbody tr').first()).toContainText('아메리카노');
  await expect(table.locator('tbody tr').first()).toContainText('포장');
  await page.getByLabel('메뉴명 검색', { exact: true }).fill('없는메뉴');
  await expect(page.locator('.empty-state').getByText('조회 기록 없음', { exact: true })).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(0);
});
