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
import type {
  AvailableAnimal, BookingResult, Discrepancy, EligibilityVerdict, PriceVerdict,
} from "../types.js";

/**
 * Resolve the messy source records into a set of canonical PHYSICAL goats.
 *
 * The same goat can appear across systems under different identifiers, and a
 * single reference can be ambiguous. Your resolver must attach a confidence and
 * must NOT silently merge records it cannot confidently match — an unresolved
 * record is safer than a wrong merge. Decide and document your confidence model.
 *
 * Return type is yours to design; the rest of the engine consumes whatever
 * canonical structure you build here.
 */
export function resolveIdentities(): unknown {
  throw new Error("Not implemented: resolveIdentities");
}

/**
 * Compute whether a canonical goat is fit for the festival.
 *
 * Use the rules in festival_rules.json. The verdict must be evaluated for the
 * right moment in time (see the brief — read it carefully on this point), must
 * separate genuinely-ineligible from cannot-yet-be-determined, and must carry
 * evidence pointing at the source records behind every reason.
 *
 * @param canonicalAnimalId an id from your resolved set
 */
export function computeEligibility(_canonicalAnimalId: string): EligibilityVerdict {
  throw new Error("Not implemented: computeEligibility");
}

/**
 * Reconcile the inherited booking sheet against farm reality.
 *
 * Produce a ranked list of discrepancies (severity reflects company risk), each
 * naming the affected customer where there is one and carrying evidence. The
 * categories are for you to discover from the data, not to be told.
 */
export function reconcileBookings(): Discrepancy[] {
  throw new Error("Not implemented: reconcileBookings");
}

/**
 * Value a canonical goat from a TRUSTED weight and the rate effective on the
 * valuation date, with breed premium and festival surge applied. A bad sensor
 * reading must never reach a price. Carry evidence.
 */
export function priceAnimal(_canonicalAnimalId: string): PriceVerdict {
  throw new Error("Not implemented: priceAnimal");
}

/**
 * The goats that can be safely shown as offerings right now: identity-resolved to
 * the required confidence, eligible for delivery day, trustworthy price, and not
 * already spoken for. Maps your canonical model to the AvailableAnimal contract.
 */
export function listAvailableAnimals(): AvailableAnimal[] {
  throw new Error("Not implemented: listAvailableAnimals");
}

/**
 * Book a specific goat for a customer.
 *
 * THE INVARIANT: a goat can have at most one confirmed booking for the
 * festival. This must hold at the data/system layer, and it must hold when two
 * booking attempts for the same goat arrive at the same instant. Refusals
 * should explain themselves.
 *
 * Implement whatever concurrency strategy you can defend live.
 */
export async function bookAnimal(
  _canonicalAnimalId: string,
  _customer: { name: string; phone: string },
): Promise<BookingResult> {
  throw new Error("Not implemented: bookAnimal");
}

/**
 * Additional surfaces you may choose to expose.
 *
 * These are real parts of the crisis. The assignment is intentionally broader than
 * 48 hours, so we are NOT telling you these are lower priority — that judgment is
 * yours. Build the slice you believe reduces the most risk, and explain what you
 * chose to expose, defer, or leave manual in your Triage Note. Signatures are
 * suggestions; design as you see fit.
 */
export function findSubstitute(_failedBookingId: string): unknown {
  throw new Error("Not implemented: findSubstitute");
}
export function traceFeedExposure(): unknown {
  throw new Error("Not implemented: traceFeedExposure");
}
export function ingestFieldReports(): unknown {
  throw new Error("Not implemented: ingestFieldReports");
}
