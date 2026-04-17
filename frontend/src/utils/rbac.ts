import type { UserRole } from "../types/api";

export const isManagementRole = (role?: UserRole) =>
  role === "ADMIN" || role === "LABORATORY_STAFF";

export const isAdmin = (role?: UserRole) => role === "ADMIN";
