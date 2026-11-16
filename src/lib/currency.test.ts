import { describe, expect, it } from "vitest";
import { formatDate, localISODate, parseAppDate } from "./currency";

describe("fechas locales", () => {
  it("una fecha 2026-11-14 se muestra como 14 de noviembre", () => {
    const d = parseAppDate("2026-11-14");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 14]);
    expect(formatDate("2026-11-14")).toContain("14");
  });
  it("hoy usa el día local, no UTC", () => {
    expect(localISODate(new Date(2026, 10, 15, 22, 16))).toBe("2026-11-15");
  });
});
