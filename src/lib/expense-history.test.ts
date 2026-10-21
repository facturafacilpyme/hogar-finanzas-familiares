import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { expensesForMonth, isExpenseHistory, shiftExpenseMonth } from "./expense-history";

describe("Caja Menor monthly history", () => {
  it("shows only expenses from the selected previous month, including its first and last day", () => {
    const expenses = [
      { id: 1, expense_date: "2026-09-01" },
      { id: 2, expense_date: "2026-09-30" },
      { id: 3, expense_date: "2026-10-01" },
      { id: 4, expense_date: "2025-09-15" },
    ];
    assert.deepEqual(expensesForMonth(expenses, "2026-09").map((x) => x.id), [1, 2]);
  });

  it("treats previous months as read-only, but keeps the current month editable", () => {
    const now = new Date(2026, 9, 21);
    assert.equal(isExpenseHistory("2026-09", now), true);
    assert.equal(isExpenseHistory("2026-10", now), false);
  });

  it("navigates across year boundaries", () => {
    assert.equal(shiftExpenseMonth("2026-01", -1), "2025-12");
    assert.equal(shiftExpenseMonth("2025-12", 1), "2026-01");
  });
});