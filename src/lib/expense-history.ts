/** Month keys use local calendar dates, never UTC parsing of date-only expenses. */
export function expenseMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftExpenseMonth(month: string, offset: number): string {
  const [year, number] = month.split("-").map(Number);
  return expenseMonthKey(new Date(year, number - 1 + offset, 1));
}

export function isExpenseHistory(month: string, now = new Date()): boolean {
  return month < expenseMonthKey(now);
}

export function expensesForMonth<T extends { expense_date: string }>(expenses: T[], month: string): T[] {
  return expenses.filter((expense) => expense.expense_date.slice(0, 7) === month);
}