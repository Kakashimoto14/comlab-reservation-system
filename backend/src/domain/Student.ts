import { User, type UserEntity } from "./User.js";

export class Student extends User {
  constructor(props: UserEntity) {
    super(props);
  }

  override canCreateReservation() {
    return this.isActive();
  }

  override getDashboardScope() {
    return "student" as const;
  }
}
