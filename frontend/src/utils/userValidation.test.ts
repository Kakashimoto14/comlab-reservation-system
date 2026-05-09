import {
  formatStudentNumber,
  getFormattedStudentNumberInput,
  sanitizeNameInput,
  sanitizePhoneInput
} from "./userValidation";

describe("userValidation", () => {
  it("formats student numbers as 12-34567", () => {
    expect(formatStudentNumber("2412345")).toBe("24-12345");
    expect(formatStudentNumber("24-12345")).toBe("24-12345");
  });

  it("keeps the student-number cursor aligned with typed digits", () => {
    expect(getFormattedStudentNumberInput("2412345", 7)).toEqual({
      value: "24-12345",
      cursor: 8
    });
  });

  it("sanitizes names to letters, spaces, and hyphens", () => {
    expect(sanitizeNameInput("  Anne - Marie123@")).toBe("Anne-Marie");
  });

  it("sanitizes phone numbers while preserving valid local and +639 prefixes", () => {
    expect(sanitizePhoneInput("0912 345 6789")).toBe("09123456789");
    expect(sanitizePhoneInput("+63912-345-6789")).toBe("+639123456789");
  });
});
