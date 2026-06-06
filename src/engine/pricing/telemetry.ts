/**
 * Trusted weight from GoatSense telemetry — spikes and impossible reads excluded.
 *
 * See docs/ASSUMPTIONS.md § Valuation.
 */
import type { RawTelemetryRead, SourceEvidence } from "../../types.js";
import { EVIDENCE_SOURCES, sourceEvidence } from "../evidence.js";
import { isOnOrBefore, toCalendarDate } from "../time.js";
import type { CalendarDate } from "../types.js";

/** Plausible single-goat floor (kg). */
const MIN_TRUSTED_KG = 10;
/** Upper bound for one goat; higher readings treated as double-bridge occupancy. */
const MAX_SINGLE_GOAT_KG = 75;
/** Recent window for trusted-weight selection (days before valuation). */
const RECENT_WINDOW_DAYS = 60;
/** Max recent reads considered after cleaning. */
const MAX_RECENT_READS = 15;
/** Spike if above median × this factor and materially above median. */
const SPIKE_RATIO = 1.35;
const SPIKE_MARGIN_KG = 12;

export interface TrustedWeightResult {
  trustedWeightKg: number;
  evidence: SourceEvidence[];
}

function median(values: number[]): number {
  if (values.length === 0) {
    return NaN;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function daysBefore(valuationDate: CalendarDate, readDate: CalendarDate): number {
  return Math.round(
    (Date.parse(`${valuationDate}T00:00:00Z`) - Date.parse(`${readDate}T00:00:00Z`)) /
      86_400_000,
  );
}

function filterSpikes(
  reads: RawTelemetryRead[],
): { trusted: RawTelemetryRead[]; excluded: RawTelemetryRead[] } {
  const weights = reads.map((r) => r.weight);
  const baseMedian = median(weights);
  const trusted: RawTelemetryRead[] = [];
  const excluded: RawTelemetryRead[] = [];
  for (const read of reads) {
    const isSpike =
      read.weight > baseMedian * SPIKE_RATIO &&
      read.weight > baseMedian + SPIKE_MARGIN_KG;
    if (isSpike) {
      excluded.push(read);
    } else {
      trusted.push(read);
    }
  }
  return { trusted, excluded };
}

/**
 * Compute trusted current weight for an animal's RFID tags as of valuationDate.
 * Returns null when no usable telemetry exists after cleaning.
 */
export function trustedWeightFromTelemetry(
  tags: string[],
  telemetry: RawTelemetryRead[],
  valuationDate: CalendarDate,
): TrustedWeightResult | null {
  const tagSet = new Set(tags);
  const onOrBeforeValuation = telemetry
    .filter(
      (r) =>
        tagSet.has(r.tag) &&
        isOnOrBefore(toCalendarDate(r.ts), valuationDate),
    )
    .sort((a, b) => b.ts.localeCompare(a.ts));

  const hardFiltered = onOrBeforeValuation.filter(
    (r) => r.weight >= MIN_TRUSTED_KG && r.weight <= MAX_SINGLE_GOAT_KG,
  );
  const hardExcluded = onOrBeforeValuation.filter(
    (r) => r.weight < MIN_TRUSTED_KG || r.weight > MAX_SINGLE_GOAT_KG,
  );

  if (hardFiltered.length === 0) {
    return null;
  }

  const { trusted, excluded: spikeExcluded } = filterSpikes(hardFiltered);
  const usable = trusted.length > 0 ? trusted : hardFiltered;

  const recent = usable.filter(
    (r) => daysBefore(valuationDate, toCalendarDate(r.ts)) <= RECENT_WINDOW_DAYS,
  );
  const pool = (recent.length > 0 ? recent : usable)
    .slice(0, MAX_RECENT_READS);

  const trustedWeightKg =
    Math.round(median(pool.map((r) => r.weight)) * 10) / 10;

  const anchor = pool.reduce((best, r) =>
    Math.abs(r.weight - trustedWeightKg) < Math.abs(best.weight - trustedWeightKg)
      ? r
      : best,
  pool[0]!);

  const evidence: SourceEvidence[] = [
    sourceEvidence({
      source: EVIDENCE_SOURCES.GOATSENSE_TELEMETRY,
      recordId: anchor.telemetry_id,
      field: "weight",
      observedValue: anchor.weight,
      interpretedValue: trustedWeightKg,
      note: `Median of ${pool.length} cleaned read(s) on or before ${valuationDate}`,
    }),
  ];

  for (const r of hardExcluded) {
    evidence.push(
      sourceEvidence({
        source: EVIDENCE_SOURCES.GOATSENSE_TELEMETRY,
        recordId: r.telemetry_id,
        field: "weight",
        observedValue: r.weight,
        interpretedValue: null,
        note: `Excluded: outside plausible single-goat range ${MIN_TRUSTED_KG}–${MAX_SINGLE_GOAT_KG} kg`,
      }),
    );
  }
  for (const r of spikeExcluded) {
    evidence.push(
      sourceEvidence({
        source: EVIDENCE_SOURCES.GOATSENSE_TELEMETRY,
        recordId: r.telemetry_id,
        field: "weight",
        observedValue: r.weight,
        interpretedValue: null,
        note: "Excluded: double-occupancy / spike vs peer median",
      }),
    );
  }

  return { trustedWeightKg, evidence };
}
