/**
 * Data loaders. These read the raw files in /data and hand you typed records.
 * They are deliberately complete so you don't spend time on CSV/JSON/JSONL/XML
 * plumbing — the assignment is what you do with the data, not parsing it.
 *
 * They do NOT clean, normalize, resolve, or validate anything. That's your job.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  RawGoatOSAnimal, RawTelemetryRead, RawHealthEvent, RawBooking, RawListing,
  RawMovement, RawFeedLog, RawBreeding, RawProcurement,
  RawLegacyCptAnimal, RawFieldReport, RawPricingInput,
} from "../types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "..", "data");

function readText(name: string): string {
  return readFileSync(join(DATA, name), "utf-8");
}
function readJSON<T>(name: string): T {
  return JSON.parse(readText(name)) as T;
}
function readJSONL<T>(name: string): T[] {
  return readText(name).split("\n").filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as T);
}
/** Minimal CSV parser: handles quoted fields and embedded commas. */
function readCSV(name: string): Record<string, string>[] {
  const text = readText(name).replace(/\r\n/g, "\n").trim();
  const lines = text.split("\n");
  const header = parseCsvLine(lines[0] ?? "");
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return row;
  });
}
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

export const loadGoatOSAnimals = (): RawGoatOSAnimal[] =>
  readJSON<RawGoatOSAnimal[]>("goatos_animals.json");

export const loadTelemetry = (): RawTelemetryRead[] =>
  readJSONL<RawTelemetryRead>("goatsense_telemetry.jsonl");

export const loadHealthLedger = (): RawHealthEvent[] =>
  readCSV("health_ledger.csv") as unknown as RawHealthEvent[];

export const loadBookings = (): RawBooking[] =>
  readCSV("festival_bookings.csv") as unknown as RawBooking[];

export const loadListings = (): RawListing[] =>
  readCSV("exchange_listings.csv") as unknown as RawListing[];


export const loadMovements = (): RawMovement[] =>
  readJSONL<RawMovement>("animal_movements.jsonl");

export const loadFeedLog = (): RawFeedLog[] =>
  readCSV("feed_shed_log.csv") as unknown as RawFeedLog[];

export const loadBreeding = (): RawBreeding[] =>
  readCSV("breeding_ledger.csv") as unknown as RawBreeding[];

export const loadProcurement = (): RawProcurement[] =>
  readCSV("procurement_batches.csv") as unknown as RawProcurement[];

export const loadPricingInputs = (): RawPricingInput[] =>
  (readCSV("pricing_inputs.csv") as unknown as Record<string, string>[]).map((r) => ({
    pricing_input_id: r.pricing_input_id!,
    effective_date: r.effective_date!,
    mutton_rate_inr_per_kg: Number(r.mutton_rate_inr_per_kg),
    breed: r.breed!,
    breed_premium_pct: Number(r.breed_premium_pct),
    festival_surge_pct: Number(r.festival_surge_pct),
  }));

export const loadFieldReports = (): RawFieldReport[] =>
  readJSONL<RawFieldReport>("field_reports.jsonl");

/** Legacy CPT XML — flat schema; parsed without an external dependency.
 * (You may swap in a real XML parser if you prefer.) */
export function loadLegacyCpt(): RawLegacyCptAnimal[] {
  const xml = readText("legacy_cpt_records.xml");
  const blocks = xml.split("<animal>").slice(1).map((b) => b.split("</animal>")[0] ?? "");
  const tag = (block: string, t: string): string => {
    const m = block.match(new RegExp(`<${t}>(.*?)</${t}>`, "s"));
    return m ? (m[1] ?? "").trim() : "";
  };
  return blocks.map((b) => ({
    legacy_id: tag(b, "legacy_id"),
    tag: tag(b, "tag"),
    breed: tag(b, "breed"),
    sex: tag(b, "sex"),
    dob: tag(b, "dob"),
    weight_lbs: Number(tag(b, "weight_lbs")),
    recorded_on: tag(b, "recorded_on"),
    shed: tag(b, "shed"),
  }));
}

/** Convenience: load everything at once. */
export function loadAll() {
  return {
    animals: loadGoatOSAnimals(),
    telemetry: loadTelemetry(),
    health: loadHealthLedger(),
    bookings: loadBookings(),
    listings: loadListings(),
    movements: loadMovements(),
    feedLog: loadFeedLog(),
    breeding: loadBreeding(),
    procurement: loadProcurement(),
    pricing: loadPricingInputs(),
    fieldReports: loadFieldReports(),
    legacyCpt: loadLegacyCpt(),
  };
}
