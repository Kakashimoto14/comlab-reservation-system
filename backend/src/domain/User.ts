import type { User as PrismaUser, UserRole, UserStatus } from "@prisma/client";

type UserProps = Pick<
  PrismaUser,
  | "id"
  | "firstName"
  | "lastName"
  | "email"
  | "role"
  | "status"
  | "studentNumber"
  | "department"
  | "yearLevel"
  | "phone"
>;

export abstract class User {
  #email: string;

  constructor(protected readonly props: UserProps) {
    this.#email = props.email;
  }

  get id() {
    return this.props.id;
  }

  get email() {
    return this.#email;
  }

  get fullName() {
    return `${this.props.firstName} ${this.props.lastName}`;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  isActive() {
    return this.props.status === "ACTIVE";
  }

  canManageUsers() {
    return false;
  }

  canManageSchedules() {
    return false;
  }

  canReviewReservations() {
    return false;
  }

  canCreateReservation() {
    return false;
  }

  abstract getDashboardScope(): "admin" | "staff" | "student";
}

export type UserEntity = UserProps;
