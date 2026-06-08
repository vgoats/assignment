/**
 * Internal engine types — not part of the public output contract in src/types.ts.
 */
import type { FestivalRules, SimulationConfig } from "../config.js";
import type { loadAll } from "../data/loader.js";
import type { RawGoatOSAnimal, SourceEvidence } from "../types.js";

/** Snapshot of every raw source file, loaded once per engine context. */
export type LoadedData = ReturnType<typeof loadAll>;

/** Config + data bundle passed through engine modules. */
export interface EngineContext {
  simulation: SimulationConfig;
  rules: FestivalRules;
  data: LoadedData;
}

export type IdentityConfidence = "high" | "medium" | "low";

/** Parsed legacy CPT weight/date fields ready for downstream modules. */
export interface LegacyCptSnapshot {
  legacyId: string;
  tag: string;
  breed: string;
  sex: string;
  dob: CalendarDate;
  recordedOn: CalendarDate;
  weightLbs: number;
  weightKg: number;
  shed: string;
}

/**
 * Canonical physical goat after identity resolution.
 * One row per physical animal; may combine GoatOS + legacy CPT when linked safely.
 */
export interface CanonicalAnimal {
  canonicalId: string;
  identityConfidence: IdentityConfidence;
  /** GoatOS / procurement animal_id values linked to this goat. */
  sourceAnimalIds: string[];
  /** Current and historical RFID tags (includes prior_tags and alias equivalents). */
  rfidTags: string[];
  /** Hand-written farm numbers (e.g. CBE-201). May be non-unique across animals. */
  farmNumbers: string[];
  /** Legacy CPT record ids when applicable. */
  legacyIds: string[];
  /** Primary GoatOS record when present — authoritative for status, breed, farm. */
  goatosRecord: RawGoatOSAnimal | null;
  /** Linked legacy CPT snapshots with converted units/dates. */
  legacySnapshots: LegacyCptSnapshot[];
  /** Human-readable notes on confidence, ambiguity, or skipped merges. */
  identityNotes: string[];
  /** Source records that justified linking cluster members. */
  linkEvidence: SourceEvidence[];
}

/** A link we refused to merge automatically. */
export interface AmbiguousIdentityLink {
  reason: string;
  recordIds: string[];
  sharedKey: string;
}

/** Calendar date as YYYY-MM-DD in the simulation timezone semantics. */
export type CalendarDate = string;

/** Prefix for union-find node ids. */
export type RecordNodeKind = "goatos" | "legacy";

export function goatosNodeId(animalId: string): string {
  return `goatos:${animalId}`;
}

export function legacyNodeId(legacyId: string): string {
  return `legacy:${legacyId}`;
}

export function parseNodeId(nodeId: string): { kind: RecordNodeKind; id: string } {
  const idx = nodeId.indexOf(":");
  const kind = nodeId.slice(0, idx) as RecordNodeKind;
  const id = nodeId.slice(idx + 1);
  return { kind, id };
}
