import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDate, localISODate, parseAppDate } from "./currency";

describe("fechas locales", () => {
  it("una fecha 2026-11-14 se muestra como 14 de noviembre", () => {
    const d = parseAppDate("2026-11-14");
    assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 10, 14]);
    assert.ok(formatDate("2026-11-14").includes("14"));
  });
  it("hoy usa el día local, no UTC", () => {
    assert.equal(localISODate(new Date(2026, 10, 15, 22, 16)), "2026-11-15");
  });
});
