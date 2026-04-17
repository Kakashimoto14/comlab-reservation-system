import { User, type UserEntity } from "./User.js";

export class Admin extends User {
  constructor(props: UserEntity) {
    super(props);
  }

  override canManageUsers() {
    return true;
  }

  override canManageSchedules() {
    return true;
  }

  override canReviewReservations() {
    return true;
  }

  override getDashboardScope() {
    return "admin" as const;
  }
}
