import { describe, expect, it } from "vitest";

import { dateRelation, formatBDT, formatDate, formatInstantDate, formatTime, initials } from "@/lib/formatters";

describe("formatInstantDate", () => {
  it("renders the clinic-local date, not the UTC one", () => {
    // 20:30Z on the 15th is 02:30 on the 16th in Dhaka. The old implementation
    // used toISOString() and showed the 15th.
    expect(formatInstantDate("2025-06-15T20:30:00.000Z")).toBe("2025-06-16");
  });

  it("leaves mid-day timestamps on the same date", () => {
    expect(formatInstantDate("2025-06-15T06:00:00.000Z")).toBe("2025-06-15");
  });

  it("returns an empty string for empty or invalid input", () => {
    expect(formatInstantDate("")).toBe("");
    expect(formatInstantDate("not-a-date")).toBe("");
  });
});

describe("formatDate", () => {
  it("parses yyyy-MM-dd as a local date, with no timezone shift", () => {
    expect(formatDate("2025-11-20")).toBe("20 Nov 2025");
  });

  it("passes through values it cannot parse", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("nonsense")).toBe("nonsense");
  });
});

describe("formatTime", () => {
  it("converts 24h to 12h", () => {
    expect(formatTime("14:00")).toBe("2:00 PM");
    expect(formatTime("00:30")).toBe("12:30 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
    expect(formatTime("09:05")).toBe("9:05 AM");
  });
});

describe("formatBDT", () => {
  it("formats taka with en-IN grouping", () => {
    expect(formatBDT(1200)).toBe("৳1,200");
    expect(formatBDT(0)).toBe("৳0");
  });

  it("falls back to zero for non-finite input", () => {
    expect(formatBDT(Number.NaN)).toBe("৳0");
  });
});

describe("dateRelation", () => {
  it("classifies past, today and future", () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    expect(dateRelation(today)).toBe("today");
    expect(dateRelation("2020-01-01")).toBe("past");
    expect(dateRelation("2099-01-01")).toBe("future");
  });
});

describe("initials", () => {
  it("uses the first letter of the first two words", () => {
    expect(initials("Rahim Uddin")).toBe("RU");
    expect(initials("Cher")).toBe("CH");
    expect(initials("")).toBe("?");
  });
});
