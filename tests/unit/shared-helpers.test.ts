import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  categoryTile,
  genderLabel,
  paymentMethodLabel,
  petTypeLabel,
  vaccinationLabel,
} from "@/lib/constants";
import { petAge, toISODate } from "@/lib/formatters";

/**
 * These helpers replaced sets of near-identical copies scattered across the
 * component tree (four different age formatters, three category-tile maps, two
 * payment-method label maps). The copies disagreed on edge cases, so the
 * consolidated behaviour is pinned here.
 */

describe("petAge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 15 June 2026, local time — every expectation below is relative to this.
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when the birth date is missing or unparseable", () => {
    expect(petAge(undefined)).toBeNull();
    expect(petAge(null)).toBeNull();
    expect(petAge("")).toBeNull();
    expect(petAge("not-a-date")).toBeNull();
  });

  it("returns null for a birth date in the future", () => {
    expect(petAge("2027-01-01")).toBeNull();
  });

  it("calls anything under a month old Newborn", () => {
    expect(petAge("2026-06-01")).toBe("Newborn");
  });

  it("does not count a month until the day of the month is reached", () => {
    // 26 days old: the month arithmetic says 1, the day check takes it back to 0.
    expect(petAge("2026-05-20")).toBe("Newborn");
  });

  it("pluralises months and years independently", () => {
    expect(petAge("2026-05-15")).toBe("1 mo");
    expect(petAge("2026-03-15")).toBe("3 mos");
    expect(petAge("2025-06-15")).toBe("1 yr");
    expect(petAge("2024-06-15")).toBe("2 yrs");
    expect(petAge("2025-05-15")).toBe("1 yr 1 mo");
    expect(petAge("2024-03-15")).toBe("2 yrs 3 mos");
  });
});

describe("toISODate", () => {
  it("zero-pads month and day", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toISODate(new Date(2026, 10, 20))).toBe("2026-11-20");
  });

  it("reads the local calendar, so it never shifts the day", () => {
    // Late-evening local time used to roll forward a day via toISOString().
    expect(toISODate(new Date(2026, 5, 15, 23, 30))).toBe("2026-06-15");
  });
});

describe("enum display labels", () => {
  it("labels pet types", () => {
    expect(petTypeLabel("DOG")).toBe("Dog");
    expect(petTypeLabel("BIRD")).toBe("Bird");
  });

  it("labels genders instead of showing the raw enum", () => {
    expect(genderLabel("MALE")).toBe("Male");
    expect(genderLabel("FEMALE")).toBe("Female");
  });

  it("labels payment methods", () => {
    expect(paymentMethodLabel("CASH")).toBe("Cash");
    expect(paymentMethodLabel("MOBILE")).toBe("Mobile Banking");
  });

  it("labels vaccination statuses", () => {
    expect(vaccinationLabel("UP_TO_DATE")).toBe("Up to date");
    expect(vaccinationLabel("NONE")).toBe("None");
  });

  it("falls back to a dash for a missing value", () => {
    expect(genderLabel(undefined)).toBe("—");
    expect(genderLabel(null)).toBe("—");
    expect(vaccinationLabel(undefined)).toBe("—");
  });

  it("passes an unrecognised value through rather than blanking it", () => {
    expect(petTypeLabel("DRAGON")).toBe("DRAGON");
    expect(genderLabel("OTHER")).toBe("OTHER");
    expect(paymentMethodLabel("CRYPTO")).toBe("CRYPTO");
  });
});

describe("categoryTile", () => {
  it("gives each service category its own gradient", () => {
    expect(categoryTile("GROOMING")).toContain("amber");
    expect(categoryTile("DIAGNOSTIC")).toContain("violet");
    expect(categoryTile("MEDICAL")).toContain("emerald");
  });

  it("falls back to the medical gradient for an unknown or missing category", () => {
    expect(categoryTile("SOMETHING_NEW")).toBe(categoryTile("MEDICAL"));
    expect(categoryTile(undefined)).toBe(categoryTile("MEDICAL"));
    expect(categoryTile(null)).toBe(categoryTile("MEDICAL"));
  });
});
