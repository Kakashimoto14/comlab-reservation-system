import { ReservationAssistantService } from "../src/services/ReservationAssistantService.js";

const laboratories = [
  {
    id: 2,
    name: "Networking and Hardware Laboratory",
    roomCode: "CL-302",
    building: "ICT Building",
    location: "ICT Building - Floor 3 - Room CL-302",
    description: "Networking and hardware sessions.",
    status: "AVAILABLE"
  },
  {
    id: 3,
    name: "Multimedia Authoring Laboratory",
    roomCode: "CL-303",
    building: "Innovation Center",
    location: "Innovation Center - Floor 2 - Room CL-303",
    description: "Multimedia and authoring sessions.",
    status: "AVAILABLE"
  }
] as const;

const scheduleRows = [
  {
    id: 10,
    laboratoryId: 2,
    date: new Date("2026-06-03T00:00:00.000Z"),
    startTime: "09:00",
    endTime: "16:00",
    laboratory: {
      name: "Networking and Hardware Laboratory",
      roomCode: "CL-302",
      building: "ICT Building"
    }
  },
  {
    id: 11,
    laboratoryId: 3,
    date: new Date("2026-06-04T00:00:00.000Z"),
    startTime: "08:00",
    endTime: "12:00",
    laboratory: {
      name: "Multimedia Authoring Laboratory",
      roomCode: "CL-303",
      building: "Innovation Center"
    }
  },
  {
    id: 12,
    laboratoryId: 2,
    date: new Date("2026-05-16T00:00:00.000Z"),
    startTime: "09:00",
    endTime: "16:00",
    laboratory: {
      name: "Networking and Hardware Laboratory",
      roomCode: "CL-302",
      building: "ICT Building"
    }
  },
  {
    id: 13,
    laboratoryId: 3,
    date: new Date("2026-05-16T00:00:00.000Z"),
    startTime: "08:00",
    endTime: "12:00",
    laboratory: {
      name: "Multimedia Authoring Laboratory",
      roomCode: "CL-303",
      building: "Innovation Center"
    }
  }
];

const availabilityReservations = [
  {
    scheduleId: 10,
    laboratoryId: 2,
    reservationDate: new Date("2026-06-03T00:00:00.000Z"),
    startTime: "09:30",
    endTime: "11:30"
  },
  {
    scheduleId: 12,
    laboratoryId: 2,
    reservationDate: new Date("2026-05-16T00:00:00.000Z"),
    startTime: "10:00",
    endTime: "11:00"
  }
];

const userReservations = [
  {
    reservationCode: "RSV-2026-0100",
    status: "APPROVED",
    reservationDate: new Date("2026-05-16T00:00:00.000Z"),
    startTime: "11:00",
    endTime: "12:00",
    laboratory: {
      name: "Networking and Hardware Laboratory",
      roomCode: "CL-302"
    },
    pc: {
      pcNumber: "PC-05"
    },
    reservationType: "PC",
    purpose: "Router configuration review"
  }
];

const createMockDb = () => {
  const db = {
    laboratory: {
      findMany: vi.fn(async (args?: { where?: { id?: number } }) => {
        if (args?.where?.id) {
          return laboratories.filter((laboratory) => laboratory.id === args.where?.id);
        }

        return [...laboratories];
      }),
      count: vi.fn(async () => laboratories.length)
    },
    schedule: {
      findMany: vi.fn(async (args?: { where?: { laboratoryId?: { in: number[] }; date?: { gte: Date; lte: Date } } }) =>
        scheduleRows.filter((schedule) => {
          const allowedLabs = args?.where?.laboratoryId?.in ?? laboratories.map((lab) => lab.id);
          const start = args?.where?.date?.gte ?? new Date("2026-01-01T00:00:00.000Z");
          const end = args?.where?.date?.lte ?? new Date("2026-12-31T00:00:00.000Z");

          return (
            allowedLabs.includes(schedule.laboratoryId) &&
            schedule.date >= start &&
            schedule.date <= end
          );
        })),
      count: vi.fn(async (args?: { where?: { date?: { gte: Date; lte: Date } } }) =>
        scheduleRows.filter((schedule) => {
          const start = args?.where?.date?.gte ?? new Date("2026-01-01T00:00:00.000Z");
          const end = args?.where?.date?.lte ?? new Date("2026-12-31T00:00:00.000Z");
          return schedule.date >= start && schedule.date <= end;
        }).length)
    },
    reservation: {
      findMany: vi.fn(async (args?: any) => {
        if (args?.include?.laboratory) {
          const start = args.where.reservationDate.gte;
          const end = args.where.reservationDate.lte;
          return userReservations.filter(
            (reservation) =>
              reservation.reservationDate >= start && reservation.reservationDate <= end
          );
        }

        const start = args?.where?.reservationDate?.gte ?? new Date("2026-01-01T00:00:00.000Z");
        const end = args?.where?.reservationDate?.lte ?? new Date("2026-12-31T00:00:00.000Z");
        const allowedLabs = args?.where?.laboratoryId?.in ?? laboratories.map((lab) => lab.id);

        return availabilityReservations.filter(
          (reservation) =>
            allowedLabs.includes(reservation.laboratoryId) &&
            reservation.reservationDate >= start &&
            reservation.reservationDate <= end
        );
      })
    },
    calendarEvent: {
      findMany: vi.fn(async () => [])
    }
  } as any;

  return db;
};

describe("ReservationAssistantService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T08:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps month context for a short follow-up after asking about next month", async () => {
    const service = new ReservationAssistantService(createMockDb());
    const currentUser = { id: 7, sessionId: 99, role: "STUDENT" as const };

    await service.askReservationAssistant(currentUser, "May schedule ba next month?");
    const followUp = await service.askReservationAssistant(currentUser, "1st week");

    expect(followUp.category).toBe("available_schedules");
    expect(followUp.presentation?.type).toBe("schedule-results");
    if (followUp.presentation?.type === "schedule-results") {
      expect(followUp.presentation.groups[0]?.date).toBe("2026-06-03");
    }
  });

  it("accepts Tagalog schedule questions for the first week of June", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 7, sessionId: 100, role: "STUDENT" },
      "schedules sa unang linggo ng june?"
    );

    expect(response.category).toBe("available_schedules");
    expect(response.reply.toLowerCase()).not.toContain("i can only help");
    expect(response.presentation?.type).toBe("schedule-results");
  });

  it("checks CL-302 for tomorrow and switches to CL-303 on follow-up", async () => {
    const service = new ReservationAssistantService(createMockDb());
    const currentUser = { id: 7, sessionId: 101, role: "STUDENT" as const };

    const first = await service.askReservationAssistant(
      currentUser,
      "available ba CL-302 bukas?"
    );
    const second = await service.askReservationAssistant(currentUser, "what about CL-303?");

    expect(first.category).toBe("specific_laboratory");
    expect(second.category).toBe("specific_laboratory");
    expect(second.presentation?.type).toBe("schedule-results");
    if (second.presentation?.type === "schedule-results") {
      expect(second.presentation.groups[0]?.laboratories[0]?.roomCode).toBe("CL-303");
    }
  });

  it("returns the user's reservations for reservation-status questions", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 7, sessionId: 102, role: "STUDENT" },
      "ano reservation ko?"
    );

    expect(response.category).toBe("my_reservations");
    expect(response.presentation?.type).toBe("reservation-results");
  });

  it("politely keeps non-reservation requests out of scope", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 7, sessionId: 103, role: "STUDENT" },
      "tell me a joke"
    );

    expect(response.category).toBe("out_of_scope");
    expect(response.reply.toLowerCase()).toContain("comlab");
  });
});
