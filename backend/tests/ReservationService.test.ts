import { StatusCodes } from "http-status-codes";

import { ReservationService } from "../src/services/ReservationService.js";

const createMockDb = () =>
  ({
    user: {
      findUnique: vi.fn()
    },
    laboratory: {
      findUnique: vi.fn()
    },
    schedule: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    reservation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    activityLog: {
      create: vi.fn()
    }
  }) as any;

describe("ReservationService", () => {
  it("prevents conflicting reservations for the same laboratory and time range", async () => {
    const db = createMockDb();
    db.reservation.findMany.mockResolvedValue([
      {
        id: 1,
        laboratoryId: 3,
        reservationDate: new Date("2026-05-12"),
        startTime: "09:00",
        endTime: "11:00",
        status: "APPROVED"
      }
    ]);

    const service = new ReservationService(db);

    await expect(
      service.ensureNoReservationConflict(3, "2026-05-12", "10:00", "11:30")
    ).rejects.toMatchObject({
      statusCode: StatusCodes.CONFLICT,
      message: "The selected reservation time conflicts with an existing reservation."
    });
  });

  it("approves a pending reservation during the review flow", async () => {
    const db = createMockDb();
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
    db.reservation.findMany.mockResolvedValue([]);
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
      2
    );

    expect(result.status).toBe("APPROVED");
    expect(db.reservation.update).toHaveBeenCalled();
    expect(db.activityLog.create).toHaveBeenCalled();
  });
});
