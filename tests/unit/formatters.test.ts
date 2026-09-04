import { describe, expect, it } from "vitest";

import {
  clinicToday,
  dateRelation,
  formatBDT,
  formatDate,
  formatInstantDate,
  formatInstantTime,
  formatTime,
  initials,
} from "@/lib/formatters";

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

describe("formatInstantTime", () => {
  it("renders the clinic wall clock, not the UTC one", () => {
    // 08:00Z is 2 PM in Dhaka. Slicing the ISO string showed 8:00 AM.
    expect(formatInstantTime("2025-06-15T08:00:00.000Z")).toBe("2:00 PM");
  });

  it("returns an empty string for empty or invalid input", () => {
    expect(formatInstantTime("")).toBe("");
    expect(formatInstantTime("not-a-date")).toBe("");
  });
});

describe("clinicToday", () => {
  it("agrees with formatInstantDate on the current instant", () => {
    expect(clinicToday()).toBe(formatInstantDate(new Date().toISOString()));
  });

  it("is a yyyy-MM-dd string", () => {
    expect(clinicToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("dateRelation", () => {
  it("classifies past, today and future against clinic today", () => {
    // Anchored to clinic time, not the browser's: a machine set to UTC-6 used
    // to call the clinic's today "tomorrow" for six hours a day.
    expect(dateRelation(clinicToday())).toBe("today");
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
