import { describe, expect, it } from "vitest";

import { reservationAssistantSchema } from "../src/validations/ai.validation.js";

describe("AI assistant validation", () => {
  it.each(["MY RESERVATIONS", "My reservations today.", "Who am I?", "Available schedules tomorrow."])(
    "accepts a valid assistant message: %s",
    (message) => {
      const result = reservationAssistantSchema.safeParse({
        body: { message },
        params: {},
        query: {}
      });

      expect(result.success).toBe(true);
    }
  );

  it("rejects empty assistant messages with a field-specific message", () => {
    const result = reservationAssistantSchema.safeParse({
      body: { message: "   " },
      params: {},
      query: {}
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["body", "message"]);
      expect(result.error.issues[0]?.message).toBe("Message is required.");
    }
  });
});
