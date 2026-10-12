import { todayKorea } from './dates';
import { validDate, type Dataset } from './schemas';
export type Expense = Dataset['expenses'][number];
export const expenseCategories = ['임차료', '인건비', '사업주 부담 보험료', '관리비', '수도광열비', '통신·소프트웨어', '광고비', '소모품·청소비'] as const;
export type ExpenseInput = { date: string; category: string; amount: string };
export function validateExpense(input: ExpenseInput, today = todayKorea()) {
  const errors: Partial<Record<keyof ExpenseInput, string>> = {};
  if (!validDate(input.date)) errors.date = '귀속 날짜를 확인해 주세요.';
  else if (input.date > today) errors.date = '미래 날짜의 실적 비용은 저장할 수 없습니다.';
  if (!expenseCategories.includes(input.category as typeof expenseCategories[number])) errors.category = '제공된 비용항목을 선택해 주세요.';
  if (!/^\d+$/.test(input.amount) || !Number.isSafeInteger(Number(input.amount)) || Number(input.amount) <= 0) errors.amount = '금액은 1원 이상의 정수로 입력해 주세요.';
  return errors;
}
export function expenseWarnings(data: Dataset, input: ExpenseInput, exclude?: string) {
  const rows = data.expenses.filter(r => r.expense_id !== exclude && r.date === input.date && r.category === input.category);
  return { duplicate: rows.some(r => String(r.amount) === String(Number(input.amount))), allocated: rows.some(r => r.recognition === '월비용 일할 배분') };
}
