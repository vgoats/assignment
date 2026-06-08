/**
 * Find a substitute goat that honors the same client promise (breed + min weight).
 */
import type { AvailableAnimal, RawBooking } from "../../types.js";
import { listAvailableAnimalsFromContext } from "../inventory/listAvailable.js";
import type { CanonicalRegistry } from "../registry.js";
import { resolveOfferingRef } from "../reconcile/resolveRef.js";
import type { EngineContext } from "../types.js";
import { breedsMatch, requiredBreedForBooking } from "./breed.js";

export interface SubstituteCandidate {
  substituteCanonicalId: string;
  breed: string;
  trustedWeightKg: number;
  promisedWeightKg: number;
}

function bookingById(ctx: EngineContext, bookingId: string): RawBooking | undefined {
  return ctx.data.bookings.find((b) => b.booking_id === bookingId);
}

export function findSubstituteForBookingFromContext(
  bookingId: string,
  ctx: EngineContext,
  registry: CanonicalRegistry,
  excludeCanonicalIds: ReadonlySet<string> = new Set(),
  availablePool?: AvailableAnimal[],
): SubstituteCandidate | null {
  const booking = bookingById(ctx, bookingId);
  if (!booking || booking.status !== "confirmed") {
    return null;
  }

  const resolved = resolveOfferingRef(registry, booking.animal_ref);
  const requiredBreed = requiredBreedForBooking(
    booking.animal_ref,
    resolved.animal ?? null,
  );
  if (!requiredBreed) {
    return null;
  }

  const promisedWeightKg = Number(booking.promised_weight);
  if (!Number.isFinite(promisedWeightKg)) {
    return null;
  }

  const pool = availablePool ?? listAvailableAnimalsFromContext(ctx);
  const candidates: SubstituteCandidate[] = [];

  for (const animal of pool) {
    const id = animal.canonicalId;
    if (excludeCanonicalIds.has(id)) {
      continue;
    }
    if (animal.identityConfidence !== "high") {
      continue;
    }
    if (!animal.price || !breedsMatch(requiredBreed, animal.breed)) {
      continue;
    }
    if (animal.price.trustedWeightKg < promisedWeightKg) {
      continue;
    }

    candidates.push({
      substituteCanonicalId: id,
      breed: animal.breed,
      trustedWeightKg: animal.price.trustedWeightKg,
      promisedWeightKg,
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    const weightDelta =
      a.trustedWeightKg - promisedWeightKg - (b.trustedWeightKg - promisedWeightKg);
    if (weightDelta !== 0) {
      return weightDelta;
    }
    return a.substituteCanonicalId.localeCompare(b.substituteCanonicalId);
  });

  return candidates[0] ?? null;
}

export function findSubstituteForBooking(
  bookingId: string,
  ctx: EngineContext,
  registry: CanonicalRegistry,
  availablePool?: AvailableAnimal[],
): SubstituteCandidate | null {
  const resolved = resolveOfferingRef(
    registry,
    bookingById(ctx, bookingId)?.animal_ref ?? "",
  );
  const exclude = new Set<string>();
  if (resolved.animal) {
    exclude.add(resolved.animal.canonicalId);
  }
  return findSubstituteForBookingFromContext(
    bookingId,
    ctx,
    registry,
    exclude,
    availablePool,
  );
}
