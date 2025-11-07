import type { HoursDayKey, HoursSchedule } from "@/types/locations";

const dayKeys: HoursDayKey[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

const MINUTES_IN_DAY = 24 * 60;

const toMinutes = (time: string) => {
  const [hourStr, minuteStr] = time.split(":");
  const hours = Number.parseInt(hourStr, 10);
  const minutes = Number.parseInt(minuteStr ?? "0", 10);
  return hours * 60 + minutes;
};

const normalize = (minuteMark: number) => {
  if (minuteMark < 0) return minuteMark + MINUTES_IN_DAY;
  if (minuteMark >= MINUTES_IN_DAY) return minuteMark - MINUTES_IN_DAY;
  return minuteMark;
};

const intervalContains = (start: number, end: number, current: number) => {
  if (start <= end) {
    return current >= start && current < end;
  }

  // Overnight interval
  return current >= start || current < end;
};

export function isOpenNow(
  hours: HoursSchedule | null,
  referenceDate: Date = new Date(),
): boolean {
  if (!hours) return false;

  const dayIndex = referenceDate.getDay();
  const todayKey = dayKeys[dayIndex];
  const todaysHours = hours[todayKey];

  if (!todaysHours?.length) {
    return false;
  }

  const minutesNow =
    referenceDate.getHours() * 60 + referenceDate.getMinutes();

  return todaysHours.some(([start, end]) => {
    const startMinutes = normalize(toMinutes(start));
    const endMinutes = normalize(toMinutes(end));
    return intervalContains(startMinutes, endMinutes, minutesNow);
  });
}
