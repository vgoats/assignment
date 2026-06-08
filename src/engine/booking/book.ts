/**
 * Book a canonical goat — per-goat lock; eligibility and assignment re-checked inside lock.
 */
import type { BookingResult } from "../../types.js";
import { getAssignedCanonicalIds } from "./assignments.js";
import {
  commitRuntimeBooking,
  getRuntimeAssignedIds,
  withGoatLock,
} from "./store.js";
import { loadEngineContext } from "../context.js";
import { resolveIdentities } from "../identity/resolve.js";
import { saleEligibilityBlockReason } from "../inventory/bookable.js";
import { priceAnimalForAnimal } from "../pricing/price.js";

export async function bookAnimal(
  canonicalAnimalId: string,
  customer: { name: string; phone: string },
): Promise<BookingResult> {
  const ctx = loadEngineContext();
  const { registry } = resolveIdentities(ctx);

  return withGoatLock(canonicalAnimalId, async () => {
    const assigned = getAssignedCanonicalIds(ctx, registry, getRuntimeAssignedIds());
    if (assigned.has(canonicalAnimalId)) {
      return {
        ok: false,
        reason: `Goat ${canonicalAnimalId} is already promised for the festival`,
      };
    }

    const blockReason = saleEligibilityBlockReason(canonicalAnimalId, ctx, registry);
    if (blockReason) {
      return {
        ok: false,
        reason: `Goat not available: ${blockReason}`,
      };
    }

    const price = priceAnimalForAnimal(canonicalAnimalId, ctx, registry);
    return commitRuntimeBooking(canonicalAnimalId, customer, {
      promisedWeightKg: price.trustedWeightKg,
      priceQuotedInr: price.amountInr,
    });
  });
}
