/**
 * Replacement-offer lookup for discrepancies (separate from fast reconcile path).
 */
import type { AvailableAnimal, Discrepancy, ReplacementOffer } from "../../types.js";
import { loadEngineContext } from "../context.js";
import { resolveIdentities } from "../identity/resolve.js";
import { listAvailableAnimalsFromContext } from "../inventory/listAvailable.js";
import type { CanonicalRegistry } from "../registry.js";
import { traceFeedExposureFromContext } from "../feed/traceExposure.js";
import { reconcileBookingsFromContext } from "../reconcile/reconcile.js";
import { resolveOfferingRef } from "../reconcile/resolveRef.js";
import type { EngineContext } from "../types.js";
import { findSubstituteForBooking } from "./findSubstitute.js";
import { getReassignmentForBooking } from "./store.js";

function offerForBooking(
  bookingId: string,
  ctx: EngineContext,
  registry: CanonicalRegistry,
  availablePool: AvailableAnimal[],
): ReplacementOffer | undefined {
  if (getReassignmentForBooking(bookingId)) {
    return undefined;
  }
  const candidate = findSubstituteForBooking(bookingId, ctx, registry, availablePool);
  if (!candidate) {
    return undefined;
  }
  return {
    targetBookingId: bookingId,
    substituteCanonicalId: candidate.substituteCanonicalId,
    breed: candidate.breed,
    trustedWeightKg: candidate.trustedWeightKg,
    promisedWeightKg: candidate.promisedWeightKg,
  };
}

export function buildReplacementOffersMap(
  discrepancies: Discrepancy[],
  ctx: EngineContext,
  registry: CanonicalRegistry,
): Record<string, ReplacementOffer> {
  const availablePool = listAvailableAnimalsFromContext(ctx);
  const offers: Record<string, ReplacementOffer> = {};

  for (const d of discrepancies) {
    if (
      d.issueId.startsWith("DIS-BOOK-INELIG-") ||
      d.issueId.startsWith("DIS-DEATH-FIELD-") ||
      d.issueId.startsWith("DIS-FEED-EXP-")
    ) {
      const offer = offerForBooking(d.entityId, ctx, registry, availablePool);
      if (offer) {
        offers[d.issueId] = offer;
      }
      continue;
    }

    if (d.issueId.startsWith("DIS-DOUBLE-")) {
      const canonicalId = d.entityId;
      const secondary = ctx.data.bookings
        .filter((b) => b.status === "confirmed")
        .map((b) => ({
          booking: b,
          animalId: resolveOfferingRef(registry, b.animal_ref).animal?.canonicalId ?? null,
        }))
        .filter((row) => row.animalId === canonicalId)
        .sort((a, b) => a.booking.booked_on.localeCompare(b.booking.booked_on))
        .slice(1)
        .find((row) => !getReassignmentForBooking(row.booking.booking_id));

      if (!secondary) {
        continue;
      }
      const offer = offerForBooking(secondary.booking.booking_id, ctx, registry, availablePool);
      if (offer) {
        offers[d.issueId] = offer;
      }
    }
  }

  return offers;
}

export function getReplacementOffers(): Record<string, ReplacementOffer> {
  const ctx = loadEngineContext();
  const { registry } = resolveIdentities(ctx);
  const discrepancies = [
    ...reconcileBookingsFromContext(ctx),
    ...traceFeedExposureFromContext(ctx).discrepancies,
  ];
  return buildReplacementOffersMap(discrepancies, ctx, registry);
}
