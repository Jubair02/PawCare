import { describe, expect, it } from "vitest";

import {
  MAX_PAGE_SIZE,
  MAX_PHOTO_BYTES,
  assertBookable,
  assertValidPhoto,
  clinicDayBoundsUtc,
  clinicMonthKey,
  pageMeta,
  readPage,
  slotWindow,
  todayStr,
} from "@/app/api/_lib/shape";
import { allowedTransitions, providerRoleForCategory } from "@/lib/domain";

// The Setting fields assertBookable actually reads.
const setting = { openTime: "09:00", closeTime: "17:00", slotMinutes: 60 } as never;
const FUTURE = "2099-03-04";

describe("clinic timezone", () => {
  it("maps a clinic day onto the right UTC window", () => {
    // Asia/Dhaka is UTC+6, so 2025-06-16 locally starts at 18:00Z the day before.
    const { start, end } = clinicDayBoundsUtc("2025-06-16");
    expect(start.toISOString()).toBe("2025-06-15T18:00:00.000Z");
    expect(end.toISOString()).toBe("2025-06-16T18:00:00.000Z");
  });

  it("puts a late-evening UTC instant in the following clinic day", () => {
    // 20:30Z is 02:30 the next morning in Dhaka. The old UTC-based todayStr()
    // put this in the previous day, which is what broke "today's appointments".
    const { start, end } = clinicDayBoundsUtc("2025-06-16");
    const instant = new Date("2025-06-15T20:30:00.000Z");
    expect(instant >= start && instant < end).toBe(true);
  });

  it("buckets months in clinic time, including across a year boundary", () => {
    expect(clinicMonthKey(new Date("2025-06-30T20:00:00Z"))).toBe("2025-07");
    expect(clinicMonthKey(new Date("2024-12-31T19:00:00Z"))).toBe("2025-01");
  });

  it("returns today as yyyy-MM-dd", () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("slot overlap", () => {
  it("computes the minute window an appointment occupies", () => {
    expect(slotWindow("09:00", 90)).toEqual({ start: 540, end: 630 });
    expect(slotWindow("14:30", 30)).toEqual({ start: 870, end: 900 });
  });

  it("treats a 90-minute 09:00 booking as blocking 10:00", () => {
    // The original bug: conflicts were detected by exact start-time equality,
    // so a long service never blocked the slot it actually ran into.
    const booked = slotWindow("09:00", 90);
    const wanted = slotWindow("10:00", 60);
    expect(wanted.start < booked.end && booked.start < wanted.end).toBe(true);
  });

  it("allows a booking that starts exactly when the previous one ends", () => {
    const booked = slotWindow("09:00", 90);
    const wanted = slotWindow("10:30", 60);
    expect(wanted.start < booked.end && booked.start < wanted.end).toBe(false);
  });
});

describe("assertBookable", () => {
  it("accepts a valid future slot", () => {
    expect(() => assertBookable(FUTURE, "10:00", 60, setting)).not.toThrow();
  });

  it("accepts a booking that finishes exactly at closing time", () => {
    expect(() => assertBookable(FUTURE, "16:00", 60, setting)).not.toThrow();
  });

  it("rejects a date in the past", () => {
    expect(() => assertBookable("2020-01-01", "10:00", 60, setting)).toThrow(/past/i);
  });

  it("rejects a start before opening", () => {
    expect(() => assertBookable(FUTURE, "07:00", 60, setting)).toThrow(/opening hours/i);
  });

  it("rejects a service that would run past closing", () => {
    expect(() => assertBookable(FUTURE, "16:00", 90, setting)).toThrow(/opening hours/i);
  });

  it("rejects a start that is off the slot grid", () => {
    expect(() => assertBookable(FUTURE, "10:30", 60, setting)).toThrow(/align/i);
  });

  it("rejects a time that has already passed today", () => {
    const allDay = { openTime: "00:00", closeTime: "23:00", slotMinutes: 60 } as never;
    expect(() => assertBookable(todayStr(), "00:00", 60, allDay)).toThrow(/passed/i);
  });

  it("rejects misconfigured opening hours instead of silently offering nothing", () => {
    const inverted = { openTime: "18:00", closeTime: "09:00", slotMinutes: 60 } as never;
    expect(() => assertBookable(FUTURE, "10:00", 60, inverted)).toThrow(/misconfigured/i);
  });
});

describe("status machine", () => {
  it("follows the happy path", () => {
    expect(allowedTransitions("PENDING", "STAFF")).toEqual(["CONFIRMED", "CANCELLED"]);
    expect(allowedTransitions("IN_PROGRESS", "VET")).toEqual(["COMPLETED"]);
  });

  it("treats COMPLETED and CANCELLED as terminal", () => {
    expect(allowedTransitions("COMPLETED", "ADMIN")).toEqual([]);
    expect(allowedTransitions("CANCELLED", "ADMIN")).toEqual([]);
  });

  it("gives ADMIN the walk-in shortcut that the client table used to omit", () => {
    expect(allowedTransitions("PENDING", "ADMIN")).toContain("CHECKED_IN");
    expect(allowedTransitions("PENDING", "STAFF")).not.toContain("CHECKED_IN");
  });
});

describe("service category routing", () => {
  it("routes grooming to groomers and everything else to vets", () => {
    expect(providerRoleForCategory("GROOMING")).toBe("GROOMER");
    expect(providerRoleForCategory("MEDICAL")).toBe("VET");
    expect(providerRoleForCategory("DIAGNOSTIC")).toBe("VET");
  });
});

describe("paging", () => {
  const url = (qs: string) => new URL("http://x/api/list" + qs);

  it("defaults when no params are given", () => {
    expect(readPage(url(""))).toEqual({ take: 200, skip: 0 });
  });

  it("reads explicit limit and offset", () => {
    expect(readPage(url("?limit=50&offset=25"))).toEqual({ take: 50, skip: 25 });
  });

  it("clamps hostile or nonsensical values", () => {
    expect(readPage(url("?limit=99999")).take).toBe(MAX_PAGE_SIZE);
    expect(readPage(url("?limit=0")).take).toBe(1);
    expect(readPage(url("?limit=-5")).take).toBe(1);
    expect(readPage(url("?offset=-10")).skip).toBe(0);
    expect(readPage(url("?limit=abc")).take).toBe(200);
    expect(readPage(url("?limit=10.9")).take).toBe(10);
  });

  it("reports hasMore only when records remain", () => {
    expect(pageMeta(500, { take: 200, skip: 0 }).hasMore).toBe(true);
    expect(pageMeta(150, { take: 200, skip: 0 }).hasMore).toBe(false);
    expect(pageMeta(200, { take: 200, skip: 0 }).hasMore).toBe(false);
    expect(pageMeta(500, { take: 200, skip: 300 }).hasMore).toBe(false);
  });
});

describe("photo validation", () => {
  const dataUri = (bytes: number) =>
    "data:image/png;base64," + "A".repeat(Math.ceil((bytes * 4) / 3));

  it("allows an empty value so the field can be cleared", () => {
    expect(() => assertValidPhoto("")).not.toThrow();
  });

  it("accepts a small image data URI and an https URL", () => {
    expect(() => assertValidPhoto(dataUri(1000))).not.toThrow();
    expect(() => assertValidPhoto("https://cdn.example.com/pet.jpg")).not.toThrow();
  });

  it("rejects a payload over the 400KB cap", () => {
    expect(MAX_PHOTO_BYTES).toBe(400 * 1024);
    expect(() => assertValidPhoto(dataUri(500 * 1024))).toThrow(/400KB/);
  });

  it("rejects non-image and non-http values", () => {
    expect(() => assertValidPhoto("javascript:alert(1)")).toThrow();
    expect(() => assertValidPhoto("data:text/html;base64,PHNjcmlwdD4=")).toThrow();
  });

  it("rejects an overlong URL", () => {
    expect(() => assertValidPhoto("https://x.com/" + "a".repeat(3000))).toThrow(/too long/i);
  });
});
