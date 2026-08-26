import { describe, expect, it } from "vitest";
import {
  dateOnlySchema,
  formatDateOnly,
  formatDateTimeJst,
  formatTimeOnly,
  parseDateOnly,
  parseTimeOnly,
  timeOnlySchema,
} from "./datetime";

describe("date only round trip", () => {
  it("parses and formats back to the same string", () => {
    expect(formatDateOnly(parseDateOnly("2026-08-25"))).toBe("2026-08-25");
  });
});

describe("time only round trip", () => {
  it("parses and formats back to the same string", () => {
    expect(formatTimeOnly(parseTimeOnly("10:00"))).toBe("10:00");
    expect(formatTimeOnly(parseTimeOnly("23:59"))).toBe("23:59");
  });
});

describe("formatDateTimeJst", () => {
  it("adds a +09:00 offset to a UTC instant", () => {
    // 2026-08-25T09:10:00Z -> 2026-08-25T18:10:00+09:00
    expect(formatDateTimeJst(new Date("2026-08-25T09:10:00.000Z"))).toBe(
      "2026-08-25T18:10:00+09:00",
    );
  });

  it("rolls the date over when JST crosses midnight", () => {
    // 2026-08-25T20:00:00Z -> 2026-08-26T05:00:00+09:00
    expect(formatDateTimeJst(new Date("2026-08-25T20:00:00.000Z"))).toBe(
      "2026-08-26T05:00:00+09:00",
    );
  });
});

describe("dateOnlySchema", () => {
  it("accepts a valid calendar date", () => {
    expect(dateOnlySchema.safeParse("2026-08-25").success).toBe(true);
  });

  it("rejects a non-existent calendar date", () => {
    expect(dateOnlySchema.safeParse("2026-02-30").success).toBe(false);
  });

  it("rejects a malformed string", () => {
    expect(dateOnlySchema.safeParse("2026/08/25").success).toBe(false);
  });
});

describe("timeOnlySchema", () => {
  it("accepts HH:mm", () => {
    expect(timeOnlySchema.safeParse("09:05").success).toBe(true);
  });

  it("rejects an out-of-range hour", () => {
    expect(timeOnlySchema.safeParse("24:00").success).toBe(false);
  });

  it("rejects a missing leading zero", () => {
    expect(timeOnlySchema.safeParse("9:05").success).toBe(false);
  });
});
