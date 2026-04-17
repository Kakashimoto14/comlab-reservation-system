import type { Schedule as PrismaSchedule, ScheduleStatus } from "@prisma/client";

import { isValidTimeRange } from "../utils/time.js";

export class Schedule {
  constructor(private readonly props: PrismaSchedule) {}

  get id() {
    return this.props.id;
  }

  get status(): ScheduleStatus {
    return this.props.status;
  }

  isBookable() {
    return this.props.status === "AVAILABLE";
  }

  hasValidTimeRange() {
    return isValidTimeRange(this.props.startTime, this.props.endTime);
  }
}
