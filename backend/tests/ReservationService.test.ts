import { StatusCodes } from "http-status-codes";

import { ReservationService } from "../src/services/ReservationService.js";

const createMockDb = () => {
  const db = {
    $queryRaw: vi.fn(),
    user: {
      findUnique: vi.fn()
    },
    laboratory: {
      findFirst: vi.fn(),
      findUnique: vi.fn()
    },
    schedule: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    reservation: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    activityLog: {
      create: vi.fn()
    }
  } as any;

  db.$transaction = vi.fn(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db));

  return db;
};

describe("ReservationService", () => {
  it("prevents conflicting reservations for the same laboratory and time range", async () => {
    const db = createMockDb();
    db.reservation.findFirst.mockResolvedValue({
      id: 1,
      reservationCode: "RSV-2026-0001",
      laboratoryId: 3,
      reservationDate: new Date("2026-05-12"),
      startTime: "09:00",
      endTime: "11:00",
      status: "APPROVED"
    });

    const service = new ReservationService(db);

    await expect(
      service.ensureNoReservationConflict({
        laboratoryId: 3,
        reservationDate: "2026-05-12",
        startTime: "10:00",
        endTime: "11:30",
        reservationType: "LAB"
      })
    ).rejects.toHaveProperty("statusCode", StatusCodes.CONFLICT);
    await expect(
      service.ensureNoReservationConflict({
        laboratoryId: 3,
        reservationDate: "2026-05-12",
        startTime: "10:00",
        endTime: "11:30",
        reservationType: "LAB"
      })
    ).rejects.toThrow(/RSV-2026-0001 from 09:00 to 11:00/);
  });

  it("approves a pending reservation during the review flow", async () => {
    const db = createMockDb();
    db.$queryRaw.mockResolvedValue([{ id: 1 }]);
    db.user.findUnique.mockResolvedValue({
      id: 2,
      firstName: "Daniel",
      lastName: "Reyes",
      email: "staff@comlab.edu",
      passwordHash: "hash",
      role: "LABORATORY_STAFF",
      status: "ACTIVE",
      studentNumber: null,
      department: "Laboratory Office",
      yearLevel: null,
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    db.laboratory.findFirst.mockResolvedValue({
      id: 1
    });
    db.reservation.findUnique.mockResolvedValue({
      id: 9,
      reservationCode: "RSV-2026-0009",
      studentId: 4,
      laboratoryId: 1,
      scheduleId: 6,
      purpose: "Database laboratory exercise",
      reservationDate: new Date("2026-05-20"),
      startTime: "09:00",
      endTime: "10:30",
      status: "PENDING",
      remarks: null,
      reviewedById: null,
      reviewedAt: null,
      cancelledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      laboratory: {
        id: 1,
        name: "Systems Development Laboratory",
        roomCode: "CL-301"
      }
    });
    db.reservation.findFirst.mockResolvedValue(null);
    db.reservation.update.mockResolvedValue({
      id: 9,
      reservationCode: "RSV-2026-0009",
      status: "APPROVED",
      remarks: "Approved for scheduled laboratory use.",
      laboratory: {
        id: 1,
        name: "Systems Development Laboratory",
        roomCode: "CL-301"
      },
      student: {
        id: 4,
        firstName: "Brian",
        lastName: "Santos",
        email: "brian@student.edu",
        studentNumber: "2024-0002"
      },
      reviewedBy: {
        id: 2,
        firstName: "Daniel",
        lastName: "Reyes",
        role: "LABORATORY_STAFF"
      }
    });

    const service = new ReservationService(db);

    const result = await service.reviewReservation(
      9,
      {
        status: "APPROVED",
        remarks: "Approved for scheduled laboratory use."
      },
      {
        id: 2,
        role: "LABORATORY_STAFF"
      }
    );

    expect(result.status).toBe("APPROVED");
    expect(db.$queryRaw).toHaveBeenCalled();
    expect(db.reservation.update).toHaveBeenCalled();
    expect(db.activityLog.create).toHaveBeenCalled();
  });
});
