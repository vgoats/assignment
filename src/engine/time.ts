/**
 * Simulation clock helpers.
 *
 * RULE: never read the machine clock here. All instants come from EngineContext
 * or explicit date strings passed in by callers.
 */
import type { EngineContext } from "./types.js";
import type { CalendarDate } from "./types.js";

export interface SimulationClock {
  nowIso: string;
  nowDate: CalendarDate;
  deliveryDate: CalendarDate;
  timezone: string;
}

const CALENDAR_DATE_RE = /^(\d{4}-\d{2}-\d{2})/;

/** Extract YYYY-MM-DD from an ISO datetime or date string. */
export function toCalendarDate(value: string): CalendarDate {
  const m = value.match(CALENDAR_DATE_RE);
  if (!m?.[1]) {
    throw new Error(`Cannot parse calendar date from "${value}"`);
  }
  return m[1];
}

/** Build a clock view from loaded engine context. */
export function clockFromContext(ctx: EngineContext): SimulationClock {
  return {
    nowIso: ctx.simulation.now,
    nowDate: toCalendarDate(ctx.simulation.now),
    deliveryDate: ctx.simulation.deliveryDate,
    timezone: ctx.simulation.timezone,
  };
}

/** UTC-midnight ms for a calendar date — used only for day arithmetic. */
function calendarDateToUtcMs(date: CalendarDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

/** Whole calendar days from `start` up to but not including `end`. */
export function calendarDaysBetween(start: CalendarDate, end: CalendarDate): number {
  const diff = calendarDateToUtcMs(end) - calendarDateToUtcMs(start);
  return Math.round(diff / 86_400_000);
}

/** Add whole calendar days to a date string. */
export function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const ms = calendarDateToUtcMs(date) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function isOnOrBefore(date: CalendarDate, boundary: CalendarDate): boolean {
  return calendarDateToUtcMs(date) <= calendarDateToUtcMs(boundary);
}

export function isOnOrAfter(date: CalendarDate, boundary: CalendarDate): boolean {
  return calendarDateToUtcMs(date) >= calendarDateToUtcMs(boundary);
}

export function isBefore(date: CalendarDate, boundary: CalendarDate): boolean {
  return calendarDateToUtcMs(date) < calendarDateToUtcMs(boundary);
}

export function isAfter(date: CalendarDate, boundary: CalendarDate): boolean {
  return calendarDateToUtcMs(date) > calendarDateToUtcMs(boundary);
}
