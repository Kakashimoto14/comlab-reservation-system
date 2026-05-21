import { ReservationAssistantService } from "../src/services/ReservationAssistantService.js";

const laboratories = [
  {
    id: 2,
    name: "Networking and Hardware Laboratory",
    roomCode: "CL-302",
    building: "ICT Building",
    location: "ICT Building - Floor 3 - Room CL-302",
    capacity: 40,
    computerCount: 40,
    description: "Networking and hardware sessions.",
    status: "AVAILABLE",
    custodianId: 2
  },
  {
    id: 3,
    name: "Multimedia Authoring Laboratory",
    roomCode: "CL-303",
    building: "Innovation Center",
    location: "Innovation Center - Floor 2 - Room CL-303",
    capacity: 35,
    computerCount: 35,
    description: "Multimedia and authoring sessions.",
    status: "AVAILABLE",
    custodianId: 2
  }
] as const;

const users = [
  {
    id: 1,
    firstName: "Admin",
    lastName: "User",
    email: "admin@comport.test",
    role: "ADMIN",
    status: "ACTIVE",
    studentNumber: null,
    department: "ICS",
    yearLevel: null,
    emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    assignedLaboratories: []
  },
  {
    id: 2,
    firstName: "Marco",
    lastName: "Staff",
    email: "staff@comport.test",
    role: "LABORATORY_STAFF",
    status: "ACTIVE",
    studentNumber: null,
    department: "ICS",
    yearLevel: null,
    emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    assignedLaboratories: [{ roomCode: "CL-302" }, { roomCode: "CL-303" }]
  },
  {
    id: 7,
    firstName: "Lorraine",
    lastName: "Tarcenio",
    email: "lorraine@student.test",
    role: "STUDENT",
    status: "ACTIVE",
    studentNumber: "20240001",
    department: "BSIT",
    yearLevel: 2,
    emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdAt: new Date("2025-06-15T00:00:00.000Z"),
    assignedLaboratories: []
  },
  {
    id: 8,
    firstName: "Janelle",
    lastName: "Cruz",
    email: "janelle@student.test",
    role: "STUDENT",
    status: "ACTIVE",
    studentNumber: "20240002",
    department: "BSIT",
    yearLevel: 1,
    emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdAt: new Date("2025-07-10T00:00:00.000Z"),
    assignedLaboratories: []
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

const reservationRecords = [
  {
    id: 100,
    reservationCode: "RSV-2026-0100",
    status: "APPROVED",
    reservationDate: new Date("2026-05-16T00:00:00.000Z"),
    startTime: "11:00",
    endTime: "12:00",
    reservationType: "PC",
    purpose: "Router configuration review",
    remarks: null,
    createdAt: new Date("2026-05-14T09:00:00.000Z"),
    studentId: 7,
    laboratoryId: 2,
    scheduleId: 12,
    laboratory: {
      name: "Networking and Hardware Laboratory",
      roomCode: "CL-302"
    },
    pc: {
      pcNumber: "PC-05"
    },
    student: {
      firstName: "Lorraine",
      lastName: "Tarcenio",
      studentNumber: "20240001"
    },
    reviewedBy: {
      firstName: "Marco",
      lastName: "Staff"
    }
  },
  {
    id: 101,
    reservationCode: "RSV-2026-0101",
    status: "PENDING",
    reservationDate: new Date("2026-05-16T00:00:00.000Z"),
    startTime: "13:00",
    endTime: "14:00",
    reservationType: "LAB",
    purpose: "Group project work",
    remarks: null,
    createdAt: new Date("2026-05-15T09:30:00.000Z"),
    studentId: 8,
    laboratoryId: 2,
    scheduleId: 12,
    laboratory: {
      name: "Networking and Hardware Laboratory",
      roomCode: "CL-302"
    },
    pc: null,
    student: {
      firstName: "Janelle",
      lastName: "Cruz",
      studentNumber: "20240002"
    },
    reviewedBy: null
  },
  {
    id: 102,
    reservationCode: "RSV-2026-0102",
    status: "REJECTED",
    reservationDate: new Date("2026-05-17T00:00:00.000Z"),
    startTime: "08:00",
    endTime: "09:00",
    reservationType: "LAB",
    purpose: "Make-up lab activity",
    remarks: "Needs schedule adjustment",
    createdAt: new Date("2026-05-13T10:00:00.000Z"),
    studentId: 7,
    laboratoryId: 3,
    scheduleId: 13,
    laboratory: {
      name: "Multimedia Authoring Laboratory",
      roomCode: "CL-303"
    },
    pc: null,
    student: {
      firstName: "Lorraine",
      lastName: "Tarcenio",
      studentNumber: "20240001"
    },
    reviewedBy: {
      firstName: "Admin",
      lastName: "User"
    }
  }
] as const;

const notificationRecords = [
  {
    id: 500,
    userId: 7,
    channel: "IN_APP",
    subject: "Reservation approved",
    message: "Your reservation RSV-2026-0100 has been approved.",
    type: "RESERVATION_CONFIRMED",
    createdAt: new Date("2026-05-15T08:30:00.000Z"),
    readAt: null
  },
  {
    id: 501,
    userId: 7,
    channel: "IN_APP",
    subject: "Reservation reminder",
    message: "Your reservation starts soon.",
    type: "RESERVATION_REMINDER",
    createdAt: new Date("2026-05-15T09:00:00.000Z"),
    readAt: new Date("2026-05-15T09:10:00.000Z")
  }
] as const;

const activityLogRecords = [
  {
    id: 900,
    action: "APPROVE_RESERVATION",
    description: "Approved reservation RSV-2026-0100.",
    timestamp: new Date("2026-05-15T08:45:00.000Z"),
    labId: 2,
    user: {
      firstName: "Marco",
      lastName: "Staff",
      role: "LABORATORY_STAFF"
    },
    laboratory: {
      roomCode: "CL-302"
    }
  },
  {
    id: 901,
    action: "CREATE_RESERVATION",
    description: "Submitted reservation RSV-2026-0101.",
    timestamp: new Date("2026-05-15T09:30:00.000Z"),
    labId: 2,
    user: {
      firstName: "Janelle",
      lastName: "Cruz",
      role: "STUDENT"
    },
    laboratory: {
      roomCode: "CL-302"
    }
  }
] as const;

const matchesDateRange = (value: Date, range?: { gte?: Date; lte?: Date }) => {
  if (!range) {
    return true;
  }

  if (range.gte && value < range.gte) {
    return false;
  }

  if (range.lte && value > range.lte) {
    return false;
  }

  return true;
};

const createMockDb = () => {
  const localSchedules = [...scheduleRows];
  const db = {
    laboratory: {
      findMany: vi.fn(async (args?: any) => {
        const byId = args?.where?.id;
        const byCustodian = args?.where?.custodianId;

        return laboratories.filter((laboratory) => {
          if (typeof byId === "number" && laboratory.id !== byId) {
            return false;
          }

          if (typeof byCustodian === "number" && laboratory.custodianId !== byCustodian) {
            return false;
          }

          return true;
        });
      }),
      findUnique: vi.fn(async (args?: any) =>
        laboratories.find((laboratory) => laboratory.id === args?.where?.id) ?? null),
      findFirst: vi.fn(async (args?: any) =>
        laboratories.find((laboratory) => {
          if (typeof args?.where?.id === "number" && laboratory.id !== args.where.id) {
            return false;
          }

          if (typeof args?.where?.custodianId === "number" && laboratory.custodianId !== args.where.custodianId) {
            return false;
          }

          return true;
        }) ?? null),
      count: vi.fn(async (args?: any) =>
        laboratories.filter((laboratory) => {
          if (args?.where?.status && laboratory.status !== args.where.status) {
            return false;
          }

          if (args?.where?.id?.in && !args.where.id.in.includes(laboratory.id)) {
            return false;
          }

          return true;
        }).length),
      findUnique: vi.fn(async (args?: any) =>
        laboratories.find((laboratory) => laboratory.id === args?.where?.id) ?? null)
    },
    user: {
      findUnique: vi.fn(async (args?: any) => users.find((user) => user.id === args?.where?.id) ?? null),
      findMany: vi.fn(async (args?: any) =>
        users.filter((user) => {
          if (args?.where?.status && user.status !== args.where.status) {
            return false;
          }

          const allowedRoles = args?.where?.role?.in;

          if (allowedRoles && !allowedRoles.includes(user.role)) {
            return false;
          }

          return true;
        })),
      count: vi.fn(async (args?: any) =>
        users.filter((user) => {
          if (args?.where?.status && user.status !== args.where.status) {
            return false;
          }

          return true;
        }).length)
    },
    schedule: {
      findMany: vi.fn(async (args?: any) =>
        localSchedules.filter((schedule) => {
          const allowedLabs = args?.where?.laboratoryId?.in ?? laboratories.map((lab) => lab.id);
          const exactLabId = typeof args?.where?.laboratoryId === "number" ? args.where.laboratoryId : null;
          const dateFilter = args?.where?.date;

          if (exactLabId !== null && schedule.laboratoryId !== exactLabId) {
            return false;
          }

          if (dateFilter?.in) {
            const allowedDates = dateFilter.in.map((date: Date) => date.toISOString().slice(0, 10));

            if (!allowedDates.includes(schedule.date.toISOString().slice(0, 10))) {
              return false;
            }
          } else if (dateFilter instanceof Date) {
            if (schedule.date.toISOString().slice(0, 10) !== dateFilter.toISOString().slice(0, 10)) {
              return false;
            }
          }

          return (
            allowedLabs.includes(schedule.laboratoryId) &&
            matchesDateRange(schedule.date, args?.where?.date)
          );
        })),
      count: vi.fn(async (args?: any) =>
        localSchedules.filter((schedule) => matchesDateRange(schedule.date, args?.where?.date)).length),
      create: vi.fn(async (args?: any) => {
        const laboratory = laboratories.find((lab) => lab.id === args?.data?.laboratoryId)!;
        const created = {
          id: localSchedules.length + 100,
          laboratoryId: args.data.laboratoryId,
          date: args.data.date,
          startTime: args.data.startTime,
          endTime: args.data.endTime,
          status: args.data.status,
          createdById: args.data.createdById,
          laboratory
        };
        localSchedules.push(created as any);
        return created;
      })
    },
    reservation: {
      findMany: vi.fn(async (args?: any) => {
        const filtered = reservationRecords.filter((reservation) => {
          if (typeof args?.where?.studentId === "number" && reservation.studentId !== args.where.studentId) {
            return false;
          }

          if (args?.where?.laboratoryId?.in && !args.where.laboratoryId.in.includes(reservation.laboratoryId)) {
            return false;
          }

          if (typeof args?.where?.laboratoryId === "number" && reservation.laboratoryId !== args.where.laboratoryId) {
            return false;
          }

          if (args?.where?.status?.in && !args.where.status.in.includes(reservation.status)) {
            return false;
          }

          if (typeof args?.where?.status === "string" && reservation.status !== args.where.status) {
            return false;
          }

          if (!matchesDateRange(reservation.reservationDate, args?.where?.reservationDate)) {
            return false;
          }

          return true;
        });

        const sorted = [...filtered].sort((left, right) => {
          const order = args?.orderBy?.[0];

          if (order?.createdAt === "desc") {
            return right.createdAt.getTime() - left.createdAt.getTime();
          }

          if (order?.reservationDate === "desc") {
            return (
              right.reservationDate.getTime() - left.reservationDate.getTime() ||
              right.startTime.localeCompare(left.startTime)
            );
          }

          return (
            left.reservationDate.getTime() - right.reservationDate.getTime() ||
            left.startTime.localeCompare(right.startTime)
          );
        });

        const taken = typeof args?.take === "number" ? sorted.slice(0, args.take) : sorted;

        if (args?.include) {
          return taken;
        }

        return taken.map((reservation) => ({
          scheduleId: reservation.scheduleId,
          laboratoryId: reservation.laboratoryId,
          reservationDate: reservation.reservationDate,
          startTime: reservation.startTime,
          endTime: reservation.endTime
        }));
      }),
      count: vi.fn(async (args?: any) =>
        reservationRecords.filter((reservation) => {
          if (typeof args?.where?.status === "string" && reservation.status !== args.where.status) {
            return false;
          }

          if (args?.where?.laboratoryId?.in && !args.where.laboratoryId.in.includes(reservation.laboratoryId)) {
            return false;
          }

          return true;
        }).length),
      findFirst: vi.fn(async (args?: any) => {
        const filtered = reservationRecords.filter((reservation) => {
          if (args?.where?.reservationCode && reservation.reservationCode !== args.where.reservationCode) {
            return false;
          }

          if (args?.where?.laboratoryId?.in && !args.where.laboratoryId.in.includes(reservation.laboratoryId)) {
            return false;
          }

          return true;
        });

        return [...filtered].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null;
      })
    },
    notification: {
      findMany: vi.fn(async (args?: any) =>
        notificationRecords
          .filter((notification) => {
            if (notification.userId !== args?.where?.userId) {
              return false;
            }

            if (notification.channel !== args?.where?.channel) {
              return false;
            }

            if (typeof args?.where?.readAt === "object" && args.where.readAt === null && notification.readAt !== null) {
              return false;
            }

            return true;
          })
          .slice(0, args?.take ?? notificationRecords.length)),
      count: vi.fn(async (args?: any) =>
        notificationRecords.filter(
          (notification) =>
            notification.userId === args?.where?.userId &&
            notification.channel === args?.where?.channel &&
            ((args?.where?.readAt === null && notification.readAt === null) || args?.where?.readAt !== null)
        ).length)
    },
    activityLog: {
      findMany: vi.fn(async (args?: any) =>
        activityLogRecords
          .filter((activity) => {
            if (args?.where?.labId?.in && !args.where.labId.in.includes(activity.labId)) {
              return false;
            }

            return true;
          })
          .slice(0, args?.take ?? activityLogRecords.length)),
      create: vi.fn(async (args?: any) => ({
        id: 1000,
        ...args.data
      }))
    },
    calendarEvent: {
      findMany: vi.fn(async () => [])
    },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (callback: any) => callback(db))
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
    expect(response.reply.toLowerCase()).not.toContain("focused on comport");
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

  it("returns the authenticated user's identity context for who-am-i questions", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 7, sessionId: 102, role: "STUDENT" },
      "Who am I?"
    );

    expect(response.category).toBe("current_user");
    expect(response.reply).toContain("Lorraine Tarcenio");
    expect(response.presentation?.type).toBe("user-profile");
  });

  it("returns the user's reservations for reservation-status questions", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 7, sessionId: 103, role: "STUDENT" },
      "ano reservation ko?"
    );

    expect(response.category).toBe("my_reservations");
    expect(response.presentation?.type).toBe("reservation-results");
  });

  it("returns notification context for the authenticated user", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 7, sessionId: 104, role: "STUDENT" },
      "What notifications do I have?"
    );

    expect(response.category).toBe("notifications");
    expect(response.reply).toContain("unread");
    expect(response.presentation?.type).toBe("notification-results");
  });

  it("denies whole-system pending counts for student users", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 7, sessionId: 105, role: "STUDENT" },
      "How many pending reservations are in the whole system?"
    );

    expect(response.category).toBe("admin_stats");
    expect(response.reply.toLowerCase()).toContain("staff or admin");
  });

  it("returns pending reservation stats for admin users", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 1, sessionId: 106, role: "ADMIN" },
      "How many pending reservations?"
    );

    expect(response.category).toBe("admin_stats");
    expect(response.reply).toContain("1 pending reservations");
    expect(response.presentation?.type).toBe("stats");
  });

  it("shows reservations needing approval for staff workflows", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 2, sessionId: 107, role: "LABORATORY_STAFF" },
      "Show reservations needing approval."
    );

    expect(response.category).toBe("approval_queue");
    expect(response.presentation?.type).toBe("reservation-results");
    if (response.presentation?.type === "reservation-results") {
      expect(response.presentation.reservations[0]?.studentName).toBe("Janelle Cruz");
    }
  });

  it("returns the latest visible reservation submitter for staff", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 2, sessionId: 108, role: "LABORATORY_STAFF" },
      "Who submitted the latest reservation?"
    );

    expect(response.category).toBe("reservation_submitter");
    expect(response.reply).toContain("Janelle Cruz");
  });

  it("politely keeps non-reservation requests out of scope", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 7, sessionId: 109, role: "STUDENT" },
      "tell me a joke"
    );

    expect(response.category).toBe("out_of_scope");
    expect(response.reply.toLowerCase()).toContain("comport");
  });

<<<<<<< HEAD
  it("continues a pending bulk schedule command when the admin supplies the missing laboratory", async () => {
=======
  it("answers step-by-step reservation requests with the guide and starts the guided flow", async () => {
    const service = new ReservationAssistantService(createMockDb());
    const currentUser = { id: 7, sessionId: 120, role: "STUDENT" as const };

    const response = await service.askReservationAssistant(currentUser, "Step-by-step reservation.");
    const followUp = await service.askReservationAssistant(currentUser, "CL-302");

    expect(response.category).toBe("reservation_guide");
    expect(response.reply).toContain("Step 1");
    expect(response.reply).toContain("Step 7");
    expect(response.reply).toContain("Which laboratory");
    expect(followUp.reply).toContain("What date");
  });

  it("prioritizes reservation guide over immediate lab clarification", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 7, sessionId: 121, role: "STUDENT" },
      "how to reserve? give me the step by step guide"
    );

    expect(response.category).toBe("reservation_guide");
    expect(response.reply).toContain("Sure! Here is the step-by-step guide");
    expect(response.reply).toContain("Step 1");
    expect(response.reply).toContain("Step 7");
    expect(response.reply).toContain("Which laboratory");
    expect(response.reply.toLowerCase()).not.toContain("i can help with your account details");
    expect(response.reply.trim()).not.toBe("Which laboratory would you like to reserve?");
  });

  it("keeps short how-follow-ups in reservation guide context", async () => {
    const service = new ReservationAssistantService(createMockDb());
    const currentUser = { id: 7, sessionId: 122, role: "STUDENT" as const };

    await service.askReservationAssistant(currentUser, "how to reserve?");
    const response = await service.askReservationAssistant(currentUser, "tell me how");

    expect(response.category).toBe("reservation_guide");
    expect(response.reply).toContain("Step 1");
    expect(response.reply).toContain("Step 7");
    expect(response.reply.toLowerCase()).not.toContain("focused on comport");
  });

  it("answers Tagalog reservation guide questions before create-reservation routing", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 7, sessionId: 123, role: "STUDENT" },
      "paano mag reserve?"
    );

    expect(response.category).toBe("reservation_guide");
    expect(response.reply).toContain("Step 1");
    expect(response.reply).toContain("Which laboratory");
  });

  it("still creates a reservation draft when actionable reservation details are present", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 7, sessionId: 124, role: "STUDENT" },
      "reserve CL-302 tomorrow 9-10 for programming"
    );

    expect(response.category).toBe("action_preview");
    expect(response.pendingAction?.actionType).toBe("CREATE_RESERVATION");
    expect(response.reply).toContain("reservation request draft");
  });

  it("starts guided reservation flow for clear reserve-now requests without details", async () => {
    const service = new ReservationAssistantService(createMockDb());
    const currentUser = { id: 7, sessionId: 125, role: "STUDENT" as const };

    const response = await service.askReservationAssistant(currentUser, "I want to reserve");
    const followUp = await service.askReservationAssistant(currentUser, "CL-302");

    expect(response.category).toBe("clarification");
    expect(response.reply).toContain("guide you");
    expect(response.reply).toContain("Which laboratory");
    expect(followUp.reply).toContain("What date");
  });

  it("continues bulk schedule slot collection from a short follow-up", async () => {
>>>>>>> codex/AI_Improvements
    const service = new ReservationAssistantService(createMockDb());
    const currentUser = { id: 1, sessionId: 110, role: "ADMIN" as const };

    const first = await service.askReservationAssistant(
      currentUser,
<<<<<<< HEAD
      "Create bulk schedule next week 8-5."
=======
      "Create bulk schedule next week 8-5"
>>>>>>> codex/AI_Improvements
    );
    const second = await service.askReservationAssistant(currentUser, "all active labs");

    expect(first.category).toBe("clarification");
<<<<<<< HEAD
    expect(first.reply).toContain("Which laboratory should I use");
    expect(second.category).toBe("action_preview");
    expect(second.reply.toLowerCase()).toContain("all active laboratories");
    expect(second.pendingAction?.actionType).toBe("CREATE_BULK_SCHEDULE");
    expect(second.pendingAction?.affectedCount).toBe(14);
    expect(second.pendingAction?.summary).toContain("08:00 to 17:00");
    expect(second.presentation?.type).toBe("summary");
    if (second.presentation?.type === "summary") {
      expect(second.presentation.items).toEqual(
        expect.arrayContaining([
          { label: "Start time", value: "08:00" },
          { label: "End time", value: "17:00" },
          { label: "Total schedule blocks", value: "14" }
        ])
      );
    }
  });

  it("extracts all bulk schedule slots from one admin command without re-asking for the lab", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 1, sessionId: 111, role: "ADMIN" },
      "create a bulk schedule for all labs on may 26-29. the start time is 8am the end time is 4pm"
    );

    expect(response.category).toBe("action_preview");
    expect(response.reply).not.toContain("Which laboratory");
    expect(response.pendingAction?.actionType).toBe("CREATE_BULK_SCHEDULE");
    expect(response.pendingAction?.affectedCount).toBe(8);
    expect(response.pendingAction?.summary).toContain("08:00 to 16:00");
  });

  it("denies schedule creation for students", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 7, sessionId: 112, role: "STUDENT" },
      "create bulk schedule next week 8-5 for all labs"
    );

    expect(response.category).toBe("permission_denied");
    expect(response.reply.toLowerCase()).toContain("students are not allowed");
    expect(response.pendingAction).toBeUndefined();
  });

  it("asks for a corrected time when the schedule time range is invalid", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 1, sessionId: 113, role: "ADMIN" },
      "create bulk schedule for all labs next week 5pm to 8am"
    );

    expect(response.category).toBe("clarification");
    expect(response.reply).toContain("What start and end time should I use");
    expect(response.pendingAction).toBeUndefined();
  });

  it("warns and excludes overlapping schedules from the draft", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 1, sessionId: 114, role: "ADMIN" },
      "create bulk schedule for all labs on may 16 8-9"
    );

    expect(response.category).toBe("action_preview");
    expect(response.pendingAction?.affectedCount).toBe(1);
    expect(response.pendingAction?.warnings).toEqual(
      expect.arrayContaining(["CL-303 already has an overlapping schedule on 2026-05-16."])
    );
  });

  it("requires confirmation before creating the prepared schedule records", async () => {
    const db = createMockDb();
    const service = new ReservationAssistantService(db);
    const currentUser = { id: 1, sessionId: 115, role: "ADMIN" as const };

    const draft = await service.askReservationAssistant(
      currentUser,
      "create bulk schedule for CL-302 on may 26 8-10"
    );

    expect(draft.category).toBe("action_preview");
    expect(db.schedule.create).not.toHaveBeenCalled();

    const confirmation = await service.confirmPendingAction(
      currentUser,
      draft.pendingAction!.actionId,
      "Confirm Create Schedule"
    );

    expect(confirmation.category).toBe("action_completed");
    expect(db.schedule.create).toHaveBeenCalledTimes(1);
=======
    expect(first.reply.toLowerCase()).toContain("which laboratory");
    expect(second.category).toBe("action_preview");
    expect(second.pendingAction?.actionType).toBe("CREATE_BULK_SCHEDULE");
    expect(second.pendingAction?.confirmationPhrase).toBe("CONFIRM CREATE BULK SCHEDULES");
  });

  it("does not execute a confirmation when there is no pending draft", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 7, sessionId: 111, role: "STUDENT" },
      "yes"
    );

    expect(response.category).toBe("clarification");
    expect(response.reply).toContain("pending action");
  });

  it("uses an exact destructive confirmation phrase for removing laboratories", async () => {
    const service = new ReservationAssistantService(createMockDb());

    const response = await service.askReservationAssistant(
      { id: 1, sessionId: 112, role: "ADMIN" },
      "remove laboratory CL-302"
    );

    expect(response.category).toBe("action_preview");
    expect(response.pendingAction?.actionType).toBe("DEACTIVATE_LABORATORY");
    expect(response.pendingAction?.confirmationPhrase).toBe("CONFIRM REMOVE LABORATORY");
>>>>>>> codex/AI_Improvements
  });
});
