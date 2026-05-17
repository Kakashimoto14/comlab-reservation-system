import { DateRangeParser } from "../src/services/assistant/DateRangeParser.js";

const formatLocalDate = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate()
  ).padStart(2, "0")}`;

describe("DateRangeParser", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T08:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses the first week of June as June 1-7", () => {
    const parser = new DateRangeParser();

    const result = parser.parse("1st week ng June");

    expect(formatLocalDate(result.start)).toBe("2026-06-01");
    expect(formatLocalDate(result.end)).toBe("2026-06-07");
    expect(result.label.toLowerCase()).toContain("june");
  });

  it("uses the previous month context for a short first-week follow-up", () => {
    const parser = new DateRangeParser();

    const result = parser.parse("1st week", {
      sessionKey: "1:1",
      userId: 1,
      sessionId: 1,
      language: "taglish",
      messages: [],
      activeQuery: {
        category: "available_schedules",
        range: {
          start: new Date("2026-06-01T00:00:00.000Z"),
          end: new Date("2026-06-30T00:00:00.000Z"),
          label: "next month (June)",
          granularity: "month",
          monthIndex: 5,
          year: 2026,
          source: "explicit"
        },
        laboratory: null,
        language: "taglish",
        resultOffset: 6,
        hasMore: true
      },
      pendingActionId: null,
      updatedAt: Date.now()
    });

    expect(formatLocalDate(result.start)).toBe("2026-06-01");
    expect(formatLocalDate(result.end)).toBe("2026-06-07");
    expect(result.source).toBe("explicit");
  });
});
