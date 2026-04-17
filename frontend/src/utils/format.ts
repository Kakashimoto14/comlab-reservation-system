import { format } from "date-fns";

export const formatDate = (value: string) => format(new Date(value), "MMM dd, yyyy");

export const formatDateTime = (value: string) =>
  format(new Date(value), "MMM dd, yyyy hh:mm a");

export const formatClockTime = (value: string) =>
  format(new Date(`2000-01-01T${value}:00`), "hh:mm a");

export const formatTimeRange = (startTime: string, endTime: string) =>
  `${formatClockTime(startTime)} - ${formatClockTime(endTime)}`;

export const fullName = (firstName?: string, lastName?: string) =>
  [firstName, lastName].filter(Boolean).join(" ");
