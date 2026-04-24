import type { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { ApiError } from "../utils/ApiError.js";
import { LaboratoryService } from "./LaboratoryService.js";
import { ReservationService } from "./ReservationService.js";
import { ScheduleService } from "./ScheduleService.js";
import { StaffAccessService } from "./StaffAccessService.js";

type ReviewReservationInput = {
  status: "APPROVED" | "REJECTED";
  remarks?: string;
};

type ScheduleInput = {
  laboratoryId: number;
  date: string;
  startTime: string;
  endTime: string;
  status: "AVAILABLE" | "BLOCKED" | "CLOSED";
};

export class StaffService {
  private readonly laboratoryService: LaboratoryService;
  private readonly reservationService: ReservationService;
  private readonly scheduleService: ScheduleService;
  private readonly staffAccessService: StaffAccessService;

  constructor(private readonly db: PrismaClient) {
    this.laboratoryService = new LaboratoryService(db);
    this.reservationService = new ReservationService(db);
    this.scheduleService = new ScheduleService(db);
    this.staffAccessService = new StaffAccessService(db);
  }

  async getMyLab(staffId: number) {
    return this.laboratoryService.getStaffManagedLaboratory(staffId);
  }

  async getMyLabReservations(staffId: number) {
    const laboratory = await this.staffAccessService.ensureStaffHasAssignedLab(staffId);

    return this.db.reservation.findMany({
      where: {
        laboratoryId: laboratory.id
      },
      include: {
        laboratory: true,
        pc: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            studentNumber: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      },
      orderBy: [{ reservationDate: "desc" }, { startTime: "desc" }]
    });
  }

  async getMyLabSchedules(staffId: number) {
    const laboratory = await this.staffAccessService.ensureStaffHasAssignedLab(staffId);

    return this.scheduleService.listSchedules(
      {
        laboratoryId: laboratory.id
      },
      {
        id: staffId,
        role: "LABORATORY_STAFF"
      }
    );
  }

  async getMyLabLogs(staffId: number) {
    const laboratory = await this.staffAccessService.ensureStaffHasAssignedLab(staffId);

    return this.db.activityLog.findMany({
      where: {
        labId: laboratory.id
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        pc: true
      },
      orderBy: {
        timestamp: "desc"
      },
      take: 100
    });
  }

  async getMyLabPcs(staffId: number) {
    const laboratory = await this.staffAccessService.ensureStaffHasAssignedLab(staffId);

    return this.laboratoryService.getLaboratoryPcs(laboratory.id);
  }

  async updateMyLabReservation(staffId: number, reservationId: number, input: ReviewReservationInput) {
    return this.reservationService.reviewReservation(
      reservationId,
      input,
      {
        id: staffId,
        role: "LABORATORY_STAFF"
      }
    );
  }

  async updateMyLabSchedule(staffId: number, scheduleId: number, input: Omit<ScheduleInput, "laboratoryId">) {
    const laboratory = await this.staffAccessService.ensureStaffHasAssignedLab(staffId);

    return this.scheduleService.updateSchedule(
      scheduleId,
      {
        ...input,
        laboratoryId: laboratory.id
      },
      {
        id: staffId,
        role: "LABORATORY_STAFF"
      }
    );
  }

  async updateMyLabPcStatus(
    staffId: number,
    pcId: number,
    status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE"
  ) {
    const laboratory = await this.staffAccessService.ensureStaffHasAssignedLab(staffId);

    return this.laboratoryService.updatePcStatus(
      laboratory.id,
      pcId,
      { status },
      staffId
    );
  }

  async getOtherLabAvailability(date?: string) {
    return this.laboratoryService.getStaffAvailability({ date });
  }

  async getOtherLabPublicSchedules(date?: string) {
    return this.laboratoryService.getPublicSchedules({ date });
  }

  async ensureStaffAssignment(staffId: number) {
    const laboratory = await this.staffAccessService.getPrimaryAssignedLab(staffId);

    if (!laboratory) {
      throw new ApiError(StatusCodes.FORBIDDEN, "No laboratory is assigned to this staff account.");
    }

    return laboratory;
  }
}
