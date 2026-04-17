import dayjs from "dayjs";

const timeFormat = "HH:mm";

export const toDateOnly = (value: string | Date) =>
  dayjs(value).startOf("day").toDate();

export const combineDateAndTime = (date: string | Date, time: string) =>
  dayjs(`${dayjs(date).format("YYYY-MM-DD")} ${time}`, `YYYY-MM-DD ${timeFormat}`);

export const isValidTimeRange = (startTime: string, endTime: string) =>
  combineDateAndTime(new Date(), endTime).isAfter(
    combineDateAndTime(new Date(), startTime)
  );

export const timeRangesOverlap = (
  startA: string,
  endA: string,
  startB: string,
  endB: string
) => {
  const rangeAStart = combineDateAndTime(new Date(), startA);
  const rangeAEnd = combineDateAndTime(new Date(), endA);
  const rangeBStart = combineDateAndTime(new Date(), startB);
  const rangeBEnd = combineDateAndTime(new Date(), endB);

  return rangeAStart.isBefore(rangeBEnd) && rangeBStart.isBefore(rangeAEnd);
};

export const formatReservationCode = (id: number) =>
  `RSV-${new Date().getFullYear()}-${id.toString().padStart(4, "0")}`;
