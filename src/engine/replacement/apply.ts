/**
 * Apply a substitute goat for a discrepancy that has a replacement offer.
 */
import type { ReplacementResult } from "../../types.js";
import { withGoatLock } from "../booking/store.js";
import { loadEngineContext } from "../context.js";
import { resolveIdentities } from "../identity/resolve.js";
import { resolveOfferingRef } from "../reconcile/resolveRef.js";
import { findSubstituteForBooking } from "./findSubstitute.js";
import { getReassignmentForBooking, recordReassignment } from "./store.js";

function bookingIdFromIssueId(issueId: string): string | null {
  if (issueId.startsWith("DIS-BOOK-INELIG-")) {
    return issueId.slice("DIS-BOOK-INELIG-".length);
  }
  if (issueId.startsWith("DIS-DEATH-FIELD-")) {
    return issueId.slice("DIS-DEATH-FIELD-".length);
  }
  if (issueId.startsWith("DIS-FEED-EXP-")) {
    return issueId.slice("DIS-FEED-EXP-".length);
  }
  return null;
}

export async function applyReplacement(issueId: string): Promise<ReplacementResult> {
  const ctx = loadEngineContext();
  const { registry } = resolveIdentities(ctx);

  const directBookingId = bookingIdFromIssueId(issueId);
  let targetBookingId = directBookingId;

  if (issueId.startsWith("DIS-DOUBLE-")) {
    const canonicalId = issueId.slice("DIS-DOUBLE-".length);
    const group = ctx.data.bookings
      .filter((b) => b.status === "confirmed")
      .map((b) => {
        const resolved = resolveOfferingRef(registry, b.animal_ref);
        return { booking: b, animalId: resolved.animal?.canonicalId ?? null };
      })
      .filter((row) => row.animalId === canonicalId)
      .sort((a, b) => a.booking.booked_on.localeCompare(b.booking.booked_on));

    const secondary = group.slice(1).find((row) => !getReassignmentForBooking(row.booking.booking_id));
    if (!secondary) {
      return { ok: false, reason: "No secondary booking left to reassign for this goat" };
    }
    targetBookingId = secondary.booking.booking_id;
  }

  if (!targetBookingId) {
    return { ok: false, reason: "This discrepancy does not support automatic replacement" };
  }

  if (getReassignmentForBooking(targetBookingId)) {
    return { ok: false, reason: "This booking already has a substitute assigned" };
  }

  const booking = ctx.data.bookings.find((b) => b.booking_id === targetBookingId);
  if (!booking) {
    return { ok: false, reason: "Booking not found" };
  }

  const resolved = resolveOfferingRef(registry, booking.animal_ref);
  const originalCanonicalId = resolved.animal?.canonicalId ?? booking.animal_ref;

  const candidate = findSubstituteForBooking(targetBookingId, ctx, registry);
  if (!candidate) {
    return {
      ok: false,
      reason: "No eligible substitute goat matches this customer's breed and promised weight",
    };
  }

  return withGoatLock(candidate.substituteCanonicalId, async () => {
    const fresh = findSubstituteForBooking(targetBookingId, loadEngineContext(), registry);
    if (!fresh || fresh.substituteCanonicalId !== candidate.substituteCanonicalId) {
      return {
        ok: false,
        reason: "Substitute goat is no longer available; refresh and try again",
      };
    }

    recordReassignment({
      issueId,
      bookingId: targetBookingId,
      originalCanonicalId,
      substituteCanonicalId: candidate.substituteCanonicalId,
    });

    return {
      ok: true,
      bookingId: targetBookingId,
      substituteCanonicalId: candidate.substituteCanonicalId,
      originalCanonicalId,
    };
  });
}
