import dayjs from "dayjs";

import { toDateOnly } from "../../utils/time.js";
import type { AssistantConversationContext, DateRange } from "./types.js";
import { normalizeAssistantText } from "./text.js";

const MONTH_INDEX_BY_NAME = new Map<string, number>([
  ["january", 0],
  ["enero", 0],
  ["february", 1],
  ["pebrero", 1],
  ["march", 2],
  ["marso", 2],
  ["april", 3],
  ["abril", 3],
  ["may", 4],
  ["mayo", 4],
  ["june", 5],
  ["hunyo", 5],
  ["july", 6],
  ["hulyo", 6],
  ["august", 7],
  ["agosto", 7],
  ["september", 8],
  ["setyembre", 8],
  ["october", 9],
  ["oktubre", 9],
  ["november", 10],
  ["nobyembre", 10],
  ["december", 11],
  ["disyembre", 11]
]);

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const WEEKDAY_INDEX_BY_NAME = new Map<string, number>([
  ["monday", 1],
  ["lunes", 1],
  ["tuesday", 2],
  ["martes", 2],
  ["wednesday", 3],
  ["miyerkules", 3],
  ["mierkules", 3],
  ["thursday", 4],
  ["huwebes", 4],
  ["friday", 5],
  ["biyernes", 5],
  ["saturday", 6],
  ["sabado", 6],
  ["sunday", 0],
  ["linggo", 0]
]);

export class DateRangeParser {
  parse(message: string, context?: AssistantConversationContext | null): DateRange {
    const normalizedMessage = normalizeAssistantText(message);
    const today = toDateOnly(new Date());
    const previousRange = context?.activeQuery?.range ?? null;

    const keywordRange = this.resolveKeywordRange(normalizedMessage, today);

    if (keywordRange) {
      return keywordRange;
    }

    const explicitIsoDate = normalizedMessage.match(/\b\d{4}-\d{2}-\d{2}\b/);

    if (explicitIsoDate) {
      const parsedDate = toDateOnly(explicitIsoDate[0]);
      return {
        start: parsedDate,
        end: parsedDate,
        label: explicitIsoDate[0],
        granularity: "day",
        monthIndex: parsedDate.getMonth(),
        year: parsedDate.getFullYear(),
        source: "explicit"
      };
    }

    const monthRange = this.resolveNamedMonthRange(normalizedMessage, previousRange);

    if (monthRange) {
      return monthRange;
    }

    const ordinalWeekRange = this.resolveOrdinalWeekRange(normalizedMessage, previousRange);

    if (ordinalWeekRange) {
      return ordinalWeekRange;
    }

    const weekdayRange = this.resolveWeekdayRange(normalizedMessage, today, previousRange);

    if (weekdayRange) {
      return weekdayRange;
    }

    if (previousRange && this.isImplicitFollowUp(normalizedMessage)) {
      return {
        ...previousRange,
        source: "context"
      };
    }

    return {
      start: today,
      end: this.addDays(today, 6),
      label: "the next 7 days",
      granularity: "range",
      monthIndex: today.getMonth(),
      year: today.getFullYear(),
      source: "default"
    };
  }

  private resolveKeywordRange(message: string, today: Date): DateRange | null {
    if (message.includes("tomorrow") || message.includes("bukas")) {
      const tomorrow = this.addDays(today, 1);
      return {
        start: tomorrow,
        end: tomorrow,
        label: "tomorrow",
        granularity: "day" as const,
        monthIndex: tomorrow.getMonth(),
        year: tomorrow.getFullYear(),
        source: "explicit" as const
      };
    }

    if (message.includes("today") || message.includes("ngayon")) {
      return {
        start: today,
        end: today,
        label: "today",
        granularity: "day" as const,
        monthIndex: today.getMonth(),
        year: today.getFullYear(),
        source: "explicit" as const
      };
    }

    if (message.includes("next week") || message.includes("susunod na linggo")) {
      const nextWeekStart = this.addDays(this.startOfIsoWeek(today), 7);
      return {
        start: nextWeekStart,
        end: this.addDays(nextWeekStart, 6),
        label: "next week",
        granularity: "week" as const,
        monthIndex: nextWeekStart.getMonth(),
        year: nextWeekStart.getFullYear(),
        source: "explicit" as const
      };
    }

    if (message.includes("this week") || message.includes("ngayong linggo")) {
      const weekStart = this.startOfIsoWeek(today);
      return {
        start: weekStart,
        end: this.addDays(weekStart, 6),
        label: "this week",
        granularity: "week" as const,
        monthIndex: weekStart.getMonth(),
        year: weekStart.getFullYear(),
        source: "explicit" as const
      };
    }

    if (message.includes("next month") || message.includes("susunod na buwan")) {
      const monthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      return {
        start: toDateOnly(monthStart),
        end: toDateOnly(monthEnd),
        label: `next month (${MONTH_NAMES[monthStart.getMonth()]})`,
        granularity: "month" as const,
        monthIndex: monthStart.getMonth(),
        year: monthStart.getFullYear(),
        source: "explicit" as const
      };
    }

    if (message.includes("this month") || message.includes("ngayong buwan")) {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return {
        start: toDateOnly(monthStart),
        end: toDateOnly(monthEnd),
        label: `this month (${MONTH_NAMES[monthStart.getMonth()]})`,
        granularity: "month" as const,
        monthIndex: monthStart.getMonth(),
        year: monthStart.getFullYear(),
        source: "explicit" as const
      };
    }

    return null;
  }

  private resolveNamedMonthRange(
    message: string,
    previousRange: DateRange | null
  ): DateRange | null {
    const monthRangeMatch = message.match(
      /\b([a-z]+)\s+(\d{1,2})\s*(?:-|to|until|hanggang)\s*(?:([a-z]+)\s+)?(\d{1,2})(?:,\s*(\d{4}))?\b/
    );

    if (monthRangeMatch) {
      const [, monthToken, startDayRaw, endMonthToken, endDayRaw, explicitYearRaw] = monthRangeMatch;
      const monthIndex = MONTH_INDEX_BY_NAME.get(monthToken);
      const endMonthIndex = endMonthToken ? MONTH_INDEX_BY_NAME.get(endMonthToken) : monthIndex;

      if (monthIndex !== undefined && endMonthIndex !== undefined) {
        const year =
          explicitYearRaw !== undefined
            ? Number.parseInt(explicitYearRaw, 10)
            : previousRange?.year ?? new Date().getFullYear();
        const startDay = Number.parseInt(startDayRaw, 10);
        const endDay = Number.parseInt(endDayRaw, 10);
        const label =
          monthIndex === endMonthIndex
            ? `${MONTH_NAMES[monthIndex]} ${startDay}-${endDay}`
            : `${MONTH_NAMES[monthIndex]} ${startDay} to ${MONTH_NAMES[endMonthIndex]} ${endDay}`;

        return this.buildValidatedRange(
          new Date(year, monthIndex, startDay),
          new Date(year, endMonthIndex, endDay),
          label,
          "range"
        );
      }
    }

    const singleMonthDateMatch = message.match(/\b([a-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?\b/);

    if (singleMonthDateMatch) {
      const [, monthToken, dayRaw, explicitYearRaw] = singleMonthDateMatch;
      const monthIndex = MONTH_INDEX_BY_NAME.get(monthToken);

      if (monthIndex !== undefined) {
        const year =
          explicitYearRaw !== undefined
            ? Number.parseInt(explicitYearRaw, 10)
            : previousRange?.year ?? new Date().getFullYear();
        const day = Number.parseInt(dayRaw, 10);

        return this.buildValidatedRange(
          new Date(year, monthIndex, day),
          new Date(year, monthIndex, day),
          `${MONTH_NAMES[monthIndex]} ${day}`,
          "day"
        );
      }
    }

    return null;
  }

  private resolveOrdinalWeekRange(
    message: string,
    previousRange: DateRange | null
  ): DateRange | null {
    const ordinalMatch = message.match(
      /\b(?:(1st|2nd|3rd|4th|5th)|first|second|third|fourth|fifth|unang|ikalawang|ikatlong|ikaapat|ikalima)\s+week(?:\s+(?:of|ng)\s+([a-z]+))?\b/
    );
    const tagalogWeekMatch = message.match(
      /\b(?:unang|ikalawang|ikatlong|ikaapat|ikalima)\s+linggo(?:\s+ng\s+([a-z]+))?\b/
    );

    const weekToken = ordinalMatch?.[1] ?? ordinalMatch?.[0] ?? tagalogWeekMatch?.[0] ?? null;
    const monthToken = ordinalMatch?.[2] ?? tagalogWeekMatch?.[1] ?? null;

    if (!weekToken) {
      return null;
    }

    const ordinal = this.resolveOrdinalValue(weekToken);

    if (!ordinal) {
      return null;
    }

    const inferredMonthIndex =
      (monthToken ? MONTH_INDEX_BY_NAME.get(monthToken) : undefined) ??
      previousRange?.monthIndex ??
      new Date().getMonth();
    const year = previousRange?.year ?? new Date().getFullYear();

    if (inferredMonthIndex === undefined) {
      return null;
    }

    const startDay = ordinal === 1 ? 1 : (ordinal - 1) * 7 + 1;
    const endDay = ordinal * 7;
    const labelMonthName = MONTH_NAMES[inferredMonthIndex];

    return this.buildValidatedRange(
      new Date(year, inferredMonthIndex, startDay),
      new Date(year, inferredMonthIndex, endDay),
      `the ${this.ordinalLabel(ordinal)} week of ${labelMonthName}`,
      "week"
    );
  }

  private resolveWeekdayRange(
    message: string,
    today: Date,
    previousRange: DateRange | null
  ): DateRange | null {
    const weekdayToken = Array.from(WEEKDAY_INDEX_BY_NAME.keys()).find((token) =>
      message.includes(token)
    );

    if (!weekdayToken) {
      return null;
    }

    const weekdayIndex = WEEKDAY_INDEX_BY_NAME.get(weekdayToken);

    if (weekdayIndex === undefined) {
      return null;
    }

    if (previousRange) {
      const matchInRange = this.findWeekdayInRange(previousRange, weekdayIndex);

      if (matchInRange) {
        return {
          start: matchInRange,
          end: matchInRange,
          label: this.weekdayLabel(weekdayIndex),
          granularity: "day",
          monthIndex: matchInRange.getMonth(),
          year: matchInRange.getFullYear(),
          source: "context"
        };
      }
    }

    const nextOccurrence = this.nextWeekday(today, weekdayIndex);

    return {
      start: nextOccurrence,
      end: nextOccurrence,
      label: this.weekdayLabel(weekdayIndex),
      granularity: "day",
      monthIndex: nextOccurrence.getMonth(),
      year: nextOccurrence.getFullYear(),
      source: "explicit"
    };
  }

  private buildValidatedRange(
    start: Date,
    end: Date,
    label: string,
    granularity: DateRange["granularity"]
  ): DateRange | null {
    const safeStart = toDateOnly(start);
    const safeEnd = toDateOnly(end);

    if (safeEnd < safeStart) {
      return null;
    }

    return {
      start: safeStart,
      end: safeEnd,
      label,
      granularity,
      monthIndex: safeStart.getMonth(),
      year: safeStart.getFullYear(),
      source: "explicit" as const
    };
  }

  private resolveOrdinalValue(token: string) {
    if (token.includes("1st") || token.includes("first") || token.includes("unang")) {
      return 1;
    }
    if (token.includes("2nd") || token.includes("second") || token.includes("ikalawang")) {
      return 2;
    }
    if (token.includes("3rd") || token.includes("third") || token.includes("ikatlong")) {
      return 3;
    }
    if (token.includes("4th") || token.includes("fourth") || token.includes("ikaapat")) {
      return 4;
    }
    if (token.includes("5th") || token.includes("fifth") || token.includes("ikalima")) {
      return 5;
    }

    return null;
  }

  private ordinalLabel(value: number) {
    return ["first", "second", "third", "fourth", "fifth"][value - 1] ?? `${value}th`;
  }

  private weekdayLabel(dayIndex: number) {
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
      dayIndex
    ];
  }

  private findWeekdayInRange(range: DateRange, weekdayIndex: number) {
    let cursor = dayjs(range.start);
    const end = dayjs(range.end);

    while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
      if (cursor.day() === weekdayIndex) {
        return toDateOnly(cursor.toDate());
      }

      cursor = cursor.add(1, "day");
    }

    return null;
  }

  private nextWeekday(fromDate: Date, weekdayIndex: number) {
    const current = dayjs(fromDate);
    const currentDayIndex = current.day();
    const diff = (weekdayIndex - currentDayIndex + 7) % 7;
    return toDateOnly(current.add(diff === 0 ? 7 : diff, "day").toDate());
  }

  private isImplicitFollowUp(message: string) {
    return /^(what about|how about|same lab|show more|sa\s|for\s|about\s)/.test(message);
  }

  private addDays(date: Date, days: number) {
    return toDateOnly(dayjs(date).add(days, "day").toDate());
  }

  private startOfIsoWeek(date: Date) {
    const baseDate = dayjs(date);
    const day = baseDate.day();
    const diff = day === 0 ? -6 : 1 - day;

    return this.addDays(toDateOnly(baseDate.toDate()), diff);
  }
}
