/**
 * Helpers for building audit-trail evidence pointing at stable source record ids.
 */
import type { SourceEvidence } from "../types.js";

/** Known raw source identifiers — use consistently in evidence.source. */
export const EVIDENCE_SOURCES = {
  GOATOS_ANIMALS: "goatos_animals",
  GOATSENSE_TELEMETRY: "goatsense_telemetry",
  HEALTH_LEDGER: "health_ledger",
  FESTIVAL_BOOKINGS: "festival_bookings",
  EXCHANGE_LISTINGS: "exchange_listings",
  ANIMAL_MOVEMENTS: "animal_movements",
  FEED_SHED_LOG: "feed_shed_log",
  BREEDING_LEDGER: "breeding_ledger",
  PROCUREMENT_BATCHES: "procurement_batches",
  LEGACY_CPT_RECORDS: "legacy_cpt_records",
  FIELD_REPORTS: "field_reports",
  PRICING_INPUTS: "pricing_inputs",
  SIMULATION_CONFIG: "simulation_config",
  FESTIVAL_RULES: "festival_rules",
} as const;

export type EvidenceSource = (typeof EVIDENCE_SOURCES)[keyof typeof EVIDENCE_SOURCES];

export interface SourceEvidenceInput {
  source: EvidenceSource | string;
  recordId: string;
  field?: string;
  observedValue?: unknown;
  interpretedValue?: unknown;
  note?: string;
}

/** Construct a single evidence pointer for output-contract payloads. */
export function sourceEvidence(input: SourceEvidenceInput): SourceEvidence {
  const out: SourceEvidence = {
    source: input.source,
    recordId: input.recordId,
  };
  if (input.field !== undefined) out.field = input.field;
  if (input.observedValue !== undefined) out.observedValue = input.observedValue;
  if (input.interpretedValue !== undefined) out.interpretedValue = input.interpretedValue;
  if (input.note !== undefined) out.note = input.note;
  return out;
}

/** Append evidence entries without mutating the original array. */
export function appendEvidence(
  existing: SourceEvidence[],
  ...entries: SourceEvidenceInput[]
): SourceEvidence[] {
  return [...existing, ...entries.map(sourceEvidence)];
}
