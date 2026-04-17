import type {
  Reservation as PrismaReservation,
  ReservationStatus
} from "@prisma/client";

export class Reservation {
  constructor(private readonly props: PrismaReservation) {}

  get id() {
    return this.props.id;
  }

  get status(): ReservationStatus {
    return this.props.status;
  }

  isPending() {
    return this.props.status === "PENDING";
  }

  canBeCancelledByStudent() {
    return this.props.status === "PENDING";
  }

  canBeCompleted() {
    return this.props.status === "APPROVED";
  }
}
