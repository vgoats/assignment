/**
 * Legacy CPT field parsing.
 *
 * ASSUMPTION (high): CPT legacy dates in legacy_cpt_records.xml are day-first dd/mm/yyyy.
 * ASSUMPTION (high): CPT legacy weights are in pounds; converted to kg with 0.45359237.
 */
import type { RawLegacyCptAnimal } from "../../types.js";
import type { CalendarDate, LegacyCptSnapshot } from "../types.js";

const LBS_TO_KG = 0.45359237;

/** Parse dd/mm/yyyy (day-first) to YYYY-MM-DD. */
export function parseDayFirstDate(value: string): CalendarDate {
  const trimmed = value.trim();
  const parts = trimmed.split(/[/-]/);
  if (parts.length !== 3) {
    throw new Error(`Expected day-first date dd/mm/yyyy, got "${value}"`);
  }
  const [day, month, year] = parts;
  const y = year!.length === 2 ? `20${year}` : year!.padStart(4, "0");
  return `${y}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
}

export function poundsToKg(lbs: number): number {
  return Math.round(lbs * LBS_TO_KG * 1000) / 1000;
}

export function legacyToSnapshot(record: RawLegacyCptAnimal): LegacyCptSnapshot {
  return {
    legacyId: record.legacy_id,
    tag: record.tag,
    breed: record.breed,
    sex: record.sex,
    dob: parseDayFirstDate(record.dob),
    recordedOn: parseDayFirstDate(record.recorded_on),
    weightLbs: record.weight_lbs,
    weightKg: poundsToKg(record.weight_lbs),
    shed: record.shed,
  };
}
