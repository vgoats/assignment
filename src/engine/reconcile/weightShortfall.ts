import type { Discrepancy, RawBooking, Severity, SourceEvidence } from "../../types.js";
import { EVIDENCE_SOURCES, sourceEvidence } from "../evidence.js";
import { priceAnimalForAnimal } from "../pricing/price.js";
import type { CanonicalRegistry } from "../registry.js";
import type { CanonicalAnimal, EngineContext } from "../types.js";
import { getReassignmentForBooking } from "../replacement/store.js";

const MIN_SHORTFALL_KG = 2;
const HIGH_SHORTFALL_KG = 5;

interface ConfirmedAssignment {
  booking: RawBooking;
  animal: CanonicalAnimal;
}

function bookingEvidence(booking: RawBooking): SourceEvidence {
  return sourceEvidence({
    source: EVIDENCE_SOURCES.FESTIVAL_BOOKINGS,
    recordId: booking.booking_id,
    field: "promised_weight",
    observedValue: {
      animal_ref: booking.animal_ref,
      promised_weight: booking.promised_weight,
      customer_name: booking.customer_name,
      status: booking.status,
    },
  });
}

function roundKg(value: number): number {
  return Math.round(value * 10) / 10;
}

export function promisedWeightGapKg(
  promisedKg: number | null,
  trustedKg: number | null,
): number | null {
  if (promisedKg === null || trustedKg === null) {
    return null;
  }
  const gap = roundKg(promisedKg - trustedKg);
  return gap >= MIN_SHORTFALL_KG ? gap : null;
}

function shortfallSeverity(gapKg: number): Severity {
  return gapKg > HIGH_SHORTFALL_KG ? "high" : "medium";
}

export function checkPromisedWeightShortfalls(
  assignments: ConfirmedAssignment[],
  ctx: EngineContext,
  registry: CanonicalRegistry,
): Discrepancy[] {
  const asOfDate = ctx.simulation.now.slice(0, 10);
  const deliveryDate = ctx.simulation.deliveryDate;
  const out: Discrepancy[] = [];

  for (const { booking, animal } of assignments) {
    if (getReassignmentForBooking(booking.booking_id)) {
      continue;
    }

    const promisedKg = Number(booking.promised_weight);
    if (!Number.isFinite(promisedKg)) {
      continue;
    }

    let price;
    try {
      price = priceAnimalForAnimal(animal.canonicalId, ctx, registry);
    } catch {
      continue;
    }

    const trustedKg = price.trustedWeightKg;
    const gapKg = promisedWeightGapKg(promisedKg, trustedKg);
    if (gapKg === null) {
      continue;
    }

    const severity = shortfallSeverity(gapKg);
    out.push({
      issueId: `DIS-BOOK-WGT-${booking.booking_id}`,
      severity,
      entityType: "booking",
      entityId: booking.booking_id,
      title: "Promised weight exceeds trusted weight today",
      explanation: `${animal.canonicalId} for ${booking.customer_name}: booked at ${promisedKg} kg but trusted weight is ${trustedKg} kg as of ${asOfDate} (${gapKg} kg short). Delivery ${deliveryDate}.`,
      affectedCustomer: booking.customer_name,
      suggestedAction:
        "Re-weigh goat, offer substitute, adjust price, or confirm growth buffer with ops",
      evidence: [
        bookingEvidence(booking),
        ...price.evidence.filter(
          (e) =>
            e.source === EVIDENCE_SOURCES.GOATSENSE_TELEMETRY ||
            e.source === EVIDENCE_SOURCES.LEGACY_CPT_RECORDS,
        ),
        sourceEvidence({
          source: EVIDENCE_SOURCES.GOATOS_ANIMALS,
          recordId: animal.goatosRecord?.animal_id ?? animal.canonicalId,
          field: "trusted_weight_kg",
          observedValue: trustedKg,
          interpretedValue: promisedKg,
          note: `Promised ${promisedKg} kg vs trusted ${trustedKg} kg on ${asOfDate}`,
        }),
      ],
    });
  }

  return out;
}
