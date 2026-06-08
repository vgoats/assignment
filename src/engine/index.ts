/**
 * THE ENGINE — this is what you build.
 *
 * Every function below throws `Not implemented`. The JSDoc states the contract
 * each must satisfy; it does NOT tell you how, and it does NOT list the specific
 * problems hiding in the data. Read THE FOUNDER'S BRIEF in the README, read the
 * data, and decide what matters.
 *
 * You are free to add modules, change signatures, introduce a real datastore,
 * split this file, or restructure entirely — as long as the API in
 * src/server/index.ts can produce the OUTPUT CONTRACT in src/types.ts. Document
 * material changes in your Architecture doc.
 *
 * Order is not prescribed on purpose.
 */
import type { BookingResult } from "../types.js";

export { loadEngineContext } from "./context.js";
export { resolveIdentities } from "./identity/resolve.js";
export type { IdentityResolutionResult } from "./identity/resolve.js";
export type { CanonicalRegistry } from "./registry.js";
export type { CanonicalAnimal, IdentityConfidence } from "./types.js";
export { computeEligibility } from "./eligibility/compute.js";
export { priceAnimal } from "./pricing/price.js";
export { reconcileBookings } from "./reconcile/reconcile.js";
export { listAvailableAnimals } from "./inventory/listAvailable.js";
export {
  queryAvailableInventory,
  queryAvailableInventoryPage,
} from "./inventory/queryInventory.js";
export type { InventoryQuery, InventoryPageResult } from "./inventory/queryInventory.js";
export { bookAnimal } from "./booking/book.js";
export { listBookings } from "./booking/listBookings.js";
export { getAnimalHistory } from "./history/getHistory.js";
export type { AnimalHistory } from "./history/getHistory.js";
export { findSubstituteForBooking } from "./replacement/findSubstitute.js";
export type { SubstituteCandidate } from "./replacement/findSubstitute.js";
export { applyReplacement } from "./replacement/apply.js";
export { getReplacementOffers } from "./replacement/enrich.js";
export { traceFeedExposure } from "./feed/traceExposure.js";
export type { FeedExposureTraceResult } from "../types.js";

/**
 * Additional surfaces you may choose to expose.
 *
 * These are real parts of the crisis. The assignment is intentionally broader than
 * 48 hours, so we are NOT telling you these are lower priority — that judgment is
 * yours. Build the slice you believe reduces the most risk, and explain what you
 * chose to expose, defer, or leave manual in your Triage Note. Signatures are
 * suggestions; design as you see fit.
 */
import { loadEngineContext } from "./context.js";
import { resolveIdentities } from "./identity/resolve.js";
import { findSubstituteForBooking as findSubstituteForBookingImpl } from "./replacement/findSubstitute.js";

export function findSubstitute(failedBookingId: string) {
  const ctx = loadEngineContext();
  const { registry } = resolveIdentities(ctx);
  return findSubstituteForBookingImpl(failedBookingId, ctx, registry);
}
export function ingestFieldReports(): unknown {
  throw new Error("Not implemented: ingestFieldReports");
}
