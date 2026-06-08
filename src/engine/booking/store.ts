/**
 * In-process booking store with per-goat locking for concurrent requests.
 */
import type { BookingResult } from "../../types.js";

interface RuntimeBooking {
  bookingId: string;
  customer: { name: string; phone: string };
  promisedWeightKg: number;
  priceQuotedInr: number;
}

const runtimeByAnimal = new Map<string, RuntimeBooking>();
const lockTail = new Map<string, Promise<void>>();

export async function withGoatLock<T>(
  canonicalAnimalId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = lockTail.get(canonicalAnimalId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  lockTail.set(canonicalAnimalId, prev.then(() => gate));
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

let bookingCounter = 0;

export function getRuntimeAssignedIds(): Set<string> {
  return new Set(runtimeByAnimal.keys());
}

export function resetRuntimeBookings(): void {
  runtimeByAnimal.clear();
  lockTail.clear();
  bookingCounter = 0;
}

export function commitRuntimeBooking(
  canonicalAnimalId: string,
  customer: { name: string; phone: string },
  pricing: { promisedWeightKg: number; priceQuotedInr: number },
): BookingResult {
  bookingCounter += 1;
  const bookingId = `BK-RUN-${String(bookingCounter).padStart(4, "0")}`;
  runtimeByAnimal.set(canonicalAnimalId, {
    bookingId,
    customer,
    promisedWeightKg: pricing.promisedWeightKg,
    priceQuotedInr: pricing.priceQuotedInr,
  });
  return { ok: true, bookingId };
}

export function listRuntimeBookings(): Array<{
  canonicalAnimalId: string;
  bookingId: string;
  customer: { name: string; phone: string };
  promisedWeightKg: number;
  priceQuotedInr: number;
}> {
  return [...runtimeByAnimal.entries()].map(([canonicalAnimalId, booking]) => ({
    canonicalAnimalId,
    bookingId: booking.bookingId,
    customer: booking.customer,
    promisedWeightKg: booking.promisedWeightKg,
    priceQuotedInr: booking.priceQuotedInr,
  }));
}
