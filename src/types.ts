/**
 * Type definitions.
 *
 * Two halves:
 *  1. RAW SOURCE TYPES — the shapes of the files in /data, exactly as they arrive
 *     (messy, optional, untrusted). Provided so you don't reverse-engineer schemas.
 *  2. OUTPUT CONTRACT — the minimal shapes the demo surface and the public tests
 *     expect your engine to produce. These are intentionally thin: they fix the
 *     *interface*, not your internal model. Design your own canonical animal model,
 *     identity-resolution structures, etc. — just expose these at the edges.
 */

// ─────────────────────────────────────────────────────────────────────────
// 1. RAW SOURCE TYPES  (everything is "as written" — assume nothing is clean)
// ─────────────────────────────────────────────────────────────────────────

export interface RawGoatOSAnimal {
  animal_id: string;
  rfid_tag: string;
  prior_tags: string[];
  farm_number: string;
  species: string;
  breed: string;        // casing/spelling not normalized
  sex: string;
  dob: string;          // ISO
  farm: string;         // "CBE" | "CPT"
  current_shed: string;
  status: string;       // "active" | "quarantine" | "sold" | "dead" — as GoatOS last knew
}

export interface RawTelemetryRead {
  telemetry_id: string;
  ts: string;           // ISO timestamp
  tag: string;          // the tag read at the bridge (may not resolve)
  weight: number;       // RAW reading; unit not guaranteed; may be impossible
  activity_score: number;
  reader_id: string;
}

export interface RawHealthEvent {
  health_event_id: string;
  animal_id: string;
  event_date: string;
  event_type: string;   // treatment | condition_started | condition_resolved | quarantine_started | contamination_cleared | ...
  condition: string;
  drug: string;
  withdrawal_days: string | number; // per-treatment; "" when N/A
  resolved_on: string;  // "" when not resolved
  vet: string;
  notes: string;
}

export interface RawBooking {
  booking_id: string;
  customer_name: string;
  customer_phone: string;
  animal_ref: string;   // rfid | animal_id | farm_number | name | prior tag | garbage
  booked_on: string;    // date format NOT guaranteed consistent
  promised_weight: string | number;
  price_quoted_inr: string | number;
  status: string;       // confirmed | cancelled | void | ...
  notes: string;        // free text; sometimes the only source of a fact
}

export interface RawListing {
  listing_id: string;
  animal_ref: string;
  listed_at: string;
  listed_price_inr: string | number;
  status: string;
  source: string;
  created_by: string;
}


export interface RawMovement {
  movement_event_id: string;
  animal_ref: string;
  from_farm: string;
  from_shed: string;
  to_farm: string;
  to_shed: string;
  moved_at: string;     // ISO timestamp
  source: string;
}

export interface RawFeedLog {
  feed_log_id: string;
  log_date: string;
  farm: string;
  shed: string;
  feed_batch_id: string;
  feed_type: string;
  contaminated_flag: string; // "true" | "false"
}

export interface RawBreeding {
  breeding_record_id: string;
  kid_animal_id: string;
  dam_id: string;
  sire_id: string;
  kidding_date: string;
  farm: string;
}

export interface RawProcurement {
  procurement_record_id: string;
  batch_id: string;
  animal_id: string;
  rfid_tag: string;
  arrival_date: string;
  source: string;
  cost_inr: string | number;
  arrival_status: string; // ok | died_in_intake | failed_arrival_check
}

export interface RawLegacyCptAnimal {
  legacy_id: string;
  tag: string;
  breed: string;
  sex: string;
  dob: string;          // dd/mm/yyyy (day-first)
  weight_lbs: number;   // POUNDS, not kg
  recorded_on: string;  // dd/mm/yyyy
  shed: string;
}

export interface RawFieldReport {
  field_report_id: string;
  ts: string;
  author: string;
  channel: string;
  text: string;         // free-form, multilingual (en/ta/kn), may carry events found nowhere else
}

export interface RawPricingInput {
  pricing_input_id: string;
  effective_date: string;
  mutton_rate_inr_per_kg: number;
  breed: string;
  breed_premium_pct: number;
  festival_surge_pct: number;
}

// ─────────────────────────────────────────────────────────────────────────
// 2. OUTPUT CONTRACT  (thin — fix the edges, not your internals)
// ─────────────────────────────────────────────────────────────────────────

/** A pointer back to the exact source record(s) behind any derived value. */
export interface SourceEvidence {
  source: string;          // e.g. "goatsense_telemetry" | "health_ledger" | ...
  recordId: string;        // the stable id of the row/object (telemetry_id, health_event_id, ...)
  field?: string;
  observedValue?: unknown; // what the source said
  interpretedValue?: unknown; // what you concluded
  note?: string;
}

export type EligibilityStatus = "eligible" | "ineligible" | "needs_review";

export interface EligibilityVerdict {
  asOfDate: string;        // the date eligibility was evaluated against
  status: EligibilityStatus;
  reasons: string[];       // human-readable, e.g. "withdrawal period ends after delivery"
  evidence: SourceEvidence[];
}

export type Severity = "critical" | "high" | "medium" | "low";

export interface ReplacementOffer {
  targetBookingId: string;
  substituteCanonicalId: string;
  breed: string;
  trustedWeightKg: number;
  promisedWeightKg: number;
}

export interface Discrepancy {
  issueId: string;
  severity: Severity;
  entityType: "booking" | "animal" | "listing";
  entityId: string;
  title: string;
  explanation: string;
  affectedCustomer?: string;
  suggestedAction?: string;
  evidence: SourceEvidence[];
  replacementOffer?: ReplacementOffer;
}

export interface ReplacementResult {
  ok: boolean;
  bookingId?: string;
  substituteCanonicalId?: string;
  originalCanonicalId?: string;
  reason?: string;
}

export interface PriceVerdict {
  amountInr: number;
  trustedWeightKg: number;
  asOfDate: string;
  evidence: SourceEvidence[];
}

/** The shape the demo surface reads for an available/eligible animal. Your
 * internal canonical model can be richer; map to this at the API boundary. */
export interface AvailableAnimal {
  canonicalId: string;
  identityConfidence: "high" | "medium" | "low";
  species: string;
  breed: string;
  eligibility: EligibilityVerdict;
  price: PriceVerdict | null;
}

export interface BookingResult {
  ok: boolean;
  bookingId?: string;
  reason?: string;         // why it was refused, if ok === false
}

export interface BookingListItem {
  bookingId: string;
  customerName: string;
  customerPhone: string;
  animalRef: string;
  canonicalAnimalId: string | null;
  assignedCanonicalId: string | null;
  bookedOn: string;
  promisedWeightKg: number | null;
  priceQuotedInr: number | null;
  status: string;
  notes: string;
  source: "sheet" | "runtime";
  hasSubstitute: boolean;
  trustedWeightKg: number | null;
  weightGapKg: number | null;
}

export interface FeedExposureEvent {
  logDate: string;
  farm: string;
  shed: string;
  feedBatchId: string;
  feedLogId: string;
  movementEventId?: string;
}

export interface FeedClearanceRecord {
  healthEventId: string;
  clearedOn: string;
}

export interface AffectedBookingRef {
  bookingId: string;
  customerName: string;
}

export interface FeedExposureRecord {
  canonicalId: string;
  exposed: boolean;
  clearedForDelivery: boolean;
  exposureEvents: FeedExposureEvent[];
  clearance?: FeedClearanceRecord;
  affectedBookings?: AffectedBookingRef[];
  evidence: SourceEvidence[];
}

export interface ContaminatedFeedBatch {
  feedLogId: string;
  logDate: string;
  farm: string;
  shed: string;
  feedBatchId: string;
}

export interface FeedExposureTraceResult {
  contaminatedBatches: ContaminatedFeedBatch[];
  exposures: FeedExposureRecord[];
  discrepancies: Discrepancy[];
}
