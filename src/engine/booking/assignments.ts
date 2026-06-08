/**
 * Confirmed festival assignments mapped to canonical animal ids.
 */
import type { RawBooking } from "../../types.js";
import { getReassignmentForBooking, getSubstituteAssignedIds } from "../replacement/store.js";
import { resolveOfferingRef } from "../reconcile/resolveRef.js";
import type { CanonicalRegistry } from "../registry.js";
import type { EngineContext } from "../types.js";

export function confirmedAssignmentsFromSheet(
  bookings: RawBooking[],
  registry: CanonicalRegistry,
): Map<string, RawBooking> {
  const out = new Map<string, RawBooking>();
  for (const booking of bookings) {
    if (booking.status !== "confirmed") {
      continue;
    }
    const resolved = resolveOfferingRef(registry, booking.animal_ref);
    if (resolved.animal) {
      out.set(resolved.animal.canonicalId, booking);
    }
  }
  return out;
}

export function getAssignedCanonicalIds(
  ctx: EngineContext,
  registry: CanonicalRegistry,
  runtimeAssigned: ReadonlySet<string>,
): Set<string> {
  const ids = new Set(runtimeAssigned);
  for (const id of getSubstituteAssignedIds()) {
    ids.add(id);
  }

  for (const [canonicalId, booking] of confirmedAssignmentsFromSheet(
    ctx.data.bookings,
    registry,
  )) {
    if (getReassignmentForBooking(booking.booking_id)) {
      continue;
    }
    ids.add(canonicalId);
  }
  return ids;
}
