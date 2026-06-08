import type { BookingListItem, RawBooking } from "../../types.js";
import { loadEngineContext } from "../context.js";
import { resolveIdentities } from "../identity/resolve.js";
import { priceAnimalForAnimal } from "../pricing/price.js";
import { promisedWeightGapKg } from "../reconcile/weightShortfall.js";
import { resolveOfferingRef } from "../reconcile/resolveRef.js";
import type { CanonicalRegistry } from "../registry.js";
import { getReassignmentForBooking } from "../replacement/store.js";
import type { EngineContext } from "../types.js";
import { listRuntimeBookings } from "./store.js";

function parseOptionalNumber(value: string | number): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function trustedWeightForCanonicalId(
  canonicalId: string,
  ctx: EngineContext,
  registry: CanonicalRegistry,
): number | null {
  try {
    return priceAnimalForAnimal(canonicalId, ctx, registry).trustedWeightKg;
  } catch {
    return null;
  }
}

function mapSheetBooking(
  booking: RawBooking,
  registry: CanonicalRegistry,
  ctx: EngineContext,
): BookingListItem {
  const resolved = resolveOfferingRef(registry, booking.animal_ref);
  const reassignment = getReassignmentForBooking(booking.booking_id);
  const canonicalAnimalId = resolved.animal?.canonicalId ?? null;
  const assignedCanonicalId =
    reassignment?.substituteCanonicalId ?? canonicalAnimalId;
  const promisedWeightKg = parseOptionalNumber(booking.promised_weight);
  const trustedWeightKg =
    assignedCanonicalId && !reassignment
      ? trustedWeightForCanonicalId(assignedCanonicalId, ctx, registry)
      : reassignment
        ? trustedWeightForCanonicalId(
            reassignment.substituteCanonicalId,
            ctx,
            registry,
          )
        : null;

  return {
    bookingId: booking.booking_id,
    customerName: booking.customer_name,
    customerPhone: booking.customer_phone,
    animalRef: booking.animal_ref,
    canonicalAnimalId,
    assignedCanonicalId,
    bookedOn: booking.booked_on,
    promisedWeightKg,
    priceQuotedInr: parseOptionalNumber(booking.price_quoted_inr),
    status: booking.status,
    notes: booking.notes,
    source: "sheet",
    hasSubstitute: reassignment !== undefined,
    trustedWeightKg,
    weightGapKg: reassignment
      ? null
      : promisedWeightGapKg(promisedWeightKg, trustedWeightKg),
  };
}

function mapRuntimeBooking(
  entry: ReturnType<typeof listRuntimeBookings>[number],
  bookedOn: string,
): BookingListItem {
  return {
    bookingId: entry.bookingId,
    customerName: entry.customer.name,
    customerPhone: entry.customer.phone,
    animalRef: entry.canonicalAnimalId,
    canonicalAnimalId: entry.canonicalAnimalId,
    assignedCanonicalId: entry.canonicalAnimalId,
    bookedOn,
    promisedWeightKg: entry.promisedWeightKg,
    priceQuotedInr: entry.priceQuotedInr,
    status: "confirmed",
    notes: "",
    source: "runtime",
    hasSubstitute: false,
    trustedWeightKg: entry.promisedWeightKg,
    weightGapKg: null,
  };
}

function sortBookings(items: BookingListItem[]): BookingListItem[] {
  return [...items].sort((a, b) => {
    const byDate = b.bookedOn.localeCompare(a.bookedOn);
    if (byDate !== 0) {
      return byDate;
    }
    return a.bookingId.localeCompare(b.bookingId);
  });
}

export function listBookingsFromContext(ctx: EngineContext): BookingListItem[] {
  const { registry } = resolveIdentities(ctx);
  const bookedOn = ctx.simulation.now.slice(0, 10);
  const sheetIds = new Set(ctx.data.bookings.map((b) => b.booking_id));

  const items = ctx.data.bookings.map((booking) =>
    mapSheetBooking(booking, registry, ctx),
  );

  for (const runtime of listRuntimeBookings()) {
    if (sheetIds.has(runtime.bookingId)) {
      continue;
    }
    items.push(mapRuntimeBooking(runtime, bookedOn));
  }

  return sortBookings(items);
}

export function listBookings(): BookingListItem[] {
  return listBookingsFromContext(loadEngineContext());
}
