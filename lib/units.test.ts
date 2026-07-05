import { describe, expect, it } from "vitest";
import { comparable, convert, unitFamily } from "./units";

describe("unitFamily", () => {
  it("classifies mass, volume, and count units", () => {
    expect(unitFamily("kg")).toBe("mass");
    expect(unitFamily("cup")).toBe("volume");
    expect(unitFamily("can")).toBe("count");
    expect(unitFamily("mystery-unit")).toBe("count"); // unknown → count
  });
});

describe("comparable", () => {
  it("treats the same unit as comparable", () => {
    expect(comparable("can", "can")).toBe(true);
  });
  it("treats units within a family as comparable", () => {
    expect(comparable("kg", "oz")).toBe(true);
    expect(comparable("cup", "L")).toBe(true);
  });
  it("rejects cross-family and differing count units", () => {
    expect(comparable("cup", "g")).toBe(false);
    expect(comparable("can", "bag")).toBe(false);
  });
});

describe("convert", () => {
  it("converts identity", () => {
    expect(convert(3, "can", "can")).toBe(3);
  });
  it("converts mass", () => {
    expect(convert(1, "kg", "g")).toBeCloseTo(1000);
    expect(convert(1, "lb", "oz")).toBeCloseTo(16, 1);
  });
  it("converts volume", () => {
    expect(convert(1, "cup", "tbsp")).toBeCloseTo(16, 1);
    expect(convert(2, "L", "cup")).toBeCloseTo(8.45, 1);
    expect(convert(1, "gallon", "quart")).toBeCloseTo(4, 2);
  });
  it("returns null for incomparable units", () => {
    expect(convert(1, "cup", "g")).toBeNull();
    expect(convert(1, "can", "bag")).toBeNull();
  });
});
