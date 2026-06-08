/**
 * Feed contamination exposure trace — movements × feed_shed_log × health clearance.
 */
import type {
  Discrepancy,
  FeedClearanceRecord,
  FeedExposureEvent,
  FeedExposureRecord,
  FeedExposureTraceResult,
  RawBooking,
  RawFeedLog,
  RawHealthEvent,
  SourceEvidence,
} from "../../types.js";
import { loadEngineContext } from "../context.js";
import { EVIDENCE_SOURCES, sourceEvidence } from "../evidence.js";
import { resolveIdentities } from "../identity/resolve.js";
import type { CanonicalRegistry } from "../registry.js";
import { resolveOfferingRef } from "../reconcile/resolveRef.js";
import { clockFromContext, isOnOrBefore } from "../time.js";
import type { EngineContext } from "../types.js";
import { buildMovementIndex, locationAtDate } from "./timeline.js";

function isContaminated(row: RawFeedLog): boolean {
  return row.contaminated_flag.trim().toLowerCase() === "true";
}

function contaminatedBatches(ctx: EngineContext): RawFeedLog[] {
  return ctx.data.feedLog.filter(isContaminated);
}

function clearanceForAnimal(
  animalId: string,
  healthEvents: RawHealthEvent[],
  deliveryDate: string,
): FeedClearanceRecord | undefined {
  for (const event of healthEvents) {
    if (event.animal_id !== animalId || event.event_type !== "contamination_cleared") {
      continue;
    }
    const clearedOn = event.resolved_on.trim() || event.event_date;
    if (!clearedOn || !isOnOrBefore(clearedOn, deliveryDate)) {
      continue;
    }
    return { healthEventId: event.health_event_id, clearedOn };
  }
  return undefined;
}

function bookingsByCanonicalId(
  bookings: RawBooking[],
  registry: CanonicalRegistry,
): Map<string, RawBooking[]> {
  const out = new Map<string, RawBooking[]>();
  for (const booking of bookings) {
    if (booking.status !== "confirmed") {
      continue;
    }
    const resolved = resolveOfferingRef(registry, booking.animal_ref);
    if (!resolved.animal) {
      continue;
    }
    const id = resolved.animal.canonicalId;
    const list = out.get(id) ?? [];
    list.push(booking);
    out.set(id, list);
  }
  return out;
}

function buildExposureRecord(
  canonicalId: string,
  exposureEvents: FeedExposureEvent[],
  clearance: FeedClearanceRecord | undefined,
  bookings: RawBooking[],
  deliveryDate: string,
): FeedExposureRecord {
  const exposed = exposureEvents.length > 0;
  const clearedForDelivery = exposed && clearance !== undefined;
  const evidence: SourceEvidence[] = [];

  for (const event of exposureEvents) {
    evidence.push(
      sourceEvidence({
        source: EVIDENCE_SOURCES.FEED_SHED_LOG,
        recordId: event.feedLogId,
        field: "contaminated_flag",
        observedValue: {
          log_date: event.logDate,
          farm: event.farm,
          shed: event.shed,
          feed_batch_id: event.feedBatchId,
        },
        note: "Goat was in this shed on contaminated feed delivery day",
      }),
    );
    if (event.movementEventId) {
      evidence.push(
        sourceEvidence({
          source: EVIDENCE_SOURCES.ANIMAL_MOVEMENTS,
          recordId: event.movementEventId,
          note: `Location on ${event.logDate}: ${event.farm}/${event.shed}`,
        }),
      );
    }
  }

  if (clearance) {
    evidence.push(
      sourceEvidence({
        source: EVIDENCE_SOURCES.HEALTH_LEDGER,
        recordId: clearance.healthEventId,
        field: "resolved_on",
        observedValue: clearance.clearedOn,
        note: `Contamination cleared on or before delivery ${deliveryDate}`,
      }),
    );
  }

  for (const booking of bookings) {
    evidence.push(
      sourceEvidence({
        source: EVIDENCE_SOURCES.FESTIVAL_BOOKINGS,
        recordId: booking.booking_id,
        field: "animal_ref",
        observedValue: booking.animal_ref,
        note: `Confirmed promise to ${booking.customer_name}`,
      }),
    );
  }

  return {
    canonicalId,
    exposed,
    clearedForDelivery,
    exposureEvents,
    clearance,
    affectedBookings: bookings.map((b) => ({
      bookingId: b.booking_id,
      customerName: b.customer_name,
    })),
    evidence,
  };
}

export function feedExposureDiscrepancies(
  exposures: FeedExposureRecord[],
): Discrepancy[] {
  const out: Discrepancy[] = [];
  for (const record of exposures) {
    if (!record.exposed || record.clearedForDelivery || !record.affectedBookings?.length) {
      continue;
    }
    for (const booking of record.affectedBookings) {
      const dates = record.exposureEvents.map((e) => e.logDate).join(", ");
      out.push({
        issueId: `DIS-FEED-EXP-${booking.bookingId}`,
        severity: "critical",
        entityType: "booking",
        entityId: booking.bookingId,
        title: "Promised goat exposed to contaminated feed and not cleared for delivery",
        explanation: `${record.canonicalId} was in a contaminated shed on ${dates}; no contamination_cleared before festival delivery.`,
        affectedCustomer: booking.customerName,
        suggestedAction: "Hold delivery; verify clearance screening or substitute goat",
        evidence: record.evidence,
      });
    }
  }
  out.sort((a, b) => a.issueId.localeCompare(b.issueId));
  return out;
}

export function traceFeedExposureFromContext(ctx: EngineContext): FeedExposureTraceResult {
  const { registry } = resolveIdentities(ctx);
  const { deliveryDate } = clockFromContext(ctx);
  const contaminated = contaminatedBatches(ctx);
  const movementIndex = buildMovementIndex(ctx.data.movements, registry);
  const bookingIndex = bookingsByCanonicalId(ctx.data.bookings, registry);

  const healthByAnimal = new Map<string, RawHealthEvent[]>();
  for (const event of ctx.data.health) {
    const list = healthByAnimal.get(event.animal_id) ?? [];
    list.push(event);
    healthByAnimal.set(event.animal_id, list);
  }

  const exposures: FeedExposureRecord[] = [];

  for (const [canonicalId, movements] of movementIndex) {
    const exposureEvents: FeedExposureEvent[] = [];

    for (const batch of contaminated) {
      const location = locationAtDate(movements, batch.log_date);
      if (!location) {
        continue;
      }
      if (location.farm !== batch.farm || location.shed !== batch.shed) {
        continue;
      }
      exposureEvents.push({
        logDate: batch.log_date,
        farm: batch.farm,
        shed: batch.shed,
        feedBatchId: batch.feed_batch_id,
        feedLogId: batch.feed_log_id,
        movementEventId: location.movementEventId,
      });
    }

    if (exposureEvents.length === 0) {
      continue;
    }

    exposureEvents.sort((a, b) => a.logDate.localeCompare(b.logDate));
    const clearance = clearanceForAnimal(
      canonicalId,
      healthByAnimal.get(canonicalId) ?? [],
      deliveryDate,
    );
    const bookings = bookingIndex.get(canonicalId) ?? [];

    exposures.push(
      buildExposureRecord(canonicalId, exposureEvents, clearance, bookings, deliveryDate),
    );
  }

  exposures.sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));

  return {
    contaminatedBatches: contaminated.map((b) => ({
      feedLogId: b.feed_log_id,
      logDate: b.log_date,
      farm: b.farm,
      shed: b.shed,
      feedBatchId: b.feed_batch_id,
    })),
    exposures,
    discrepancies: feedExposureDiscrepancies(exposures),
  };
}

export function traceFeedExposure(): FeedExposureTraceResult {
  return traceFeedExposureFromContext(loadEngineContext());
}

let unclearedExposureSaleBlocks: Map<string, string> | undefined;

function buildUnclearedExposureSaleBlocks(ctx: EngineContext): Map<string, string> {
  const blocks = new Map<string, string>();
  for (const record of traceFeedExposureFromContext(ctx).exposures) {
    if (!record.exposed || record.clearedForDelivery) {
      continue;
    }
    const dates = record.exposureEvents.map((e) => e.logDate).join(", ");
    blocks.set(
      record.canonicalId,
      `Exposed to contaminated feed on ${dates}; not cleared for festival delivery`,
    );
  }
  return blocks;
}

/** Block reason for inventory/booking when goat was exposed and not vet-cleared before delivery. */
export function feedExposureSaleBlockReason(
  canonicalAnimalId: string,
  ctx: EngineContext,
): string | null {
  if (!unclearedExposureSaleBlocks) {
    unclearedExposureSaleBlocks = buildUnclearedExposureSaleBlocks(ctx);
  }
  return unclearedExposureSaleBlocks.get(canonicalAnimalId) ?? null;
}

export function resetFeedExposureSaleBlockCache(): void {
  unclearedExposureSaleBlocks = undefined;
}
