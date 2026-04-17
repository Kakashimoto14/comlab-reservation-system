import { User, type UserEntity } from "./User.js";

export class LaboratoryStaff extends User {
  constructor(props: UserEntity) {
    super(props);
  }

  override canManageSchedules() {
    return true;
  }

  override canReviewReservations() {
    return true;
  }

  override getDashboardScope() {
    return "staff" as const;
  }
}
