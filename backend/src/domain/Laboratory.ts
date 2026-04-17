import type { Laboratory as PrismaLaboratory, LaboratoryStatus } from "@prisma/client";

export class Laboratory {
  constructor(private readonly props: PrismaLaboratory) {}

  get id() {
    return this.props.id;
  }

  get status(): LaboratoryStatus {
    return this.props.status;
  }

  canAcceptReservations() {
    return this.props.status === "AVAILABLE";
  }
}
