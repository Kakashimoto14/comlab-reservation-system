import { describe, expect, it } from "vitest";

import { parseBooleanEnvValue } from "../src/utils/envBoolean.js";

describe("parseBooleanEnvValue", () => {
  it.each(["true", "1", "yes", "on", " TRUE ", "Yes"])(
    "parses %s as true",
    (value) => {
      expect(parseBooleanEnvValue(value)).toBe(true);
    }
  );

  it.each(["false", "0", "no", "off", "", " FALSE ", "No"])(
    "parses %s as false",
    (value) => {
      expect(parseBooleanEnvValue(value)).toBe(false);
    }
  );

  it("preserves undefined so env defaults can still be applied", () => {
    expect(parseBooleanEnvValue(undefined)).toBeUndefined();
  });

  it("leaves invalid values unchanged so Zod can reject them", () => {
    expect(parseBooleanEnvValue("maybe")).toBe("maybe");
  });
});
