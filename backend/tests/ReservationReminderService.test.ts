import { ReservationReminderService } from "../src/services/ReservationReminderService.js";

describe("ReservationReminderService", () => {
  it("publishes reminders for approved reservations inside the reminder window", async () => {
    const eventBus = {
      publish: vi.fn()
    } as any;

    const db = {
      reservation: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 14,
            reservationDate: new Date("2026-05-01T00:00:00"),
            startTime: "10:30"
          },
          {
            id: 15,
            reservationDate: new Date("2026-05-01T00:00:00"),
            startTime: "13:00"
          }
        ])
      }
    } as any;

    const service = new ReservationReminderService(db, eventBus);

    await service.runCycle(new Date("2026-05-01T10:00:00"));

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith("reservation.reminder", {
      reservationId: 14
    });
  });
});
