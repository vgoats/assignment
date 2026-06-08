import type {
  Discrepancy,
  RawBooking,
  RawListing,
  Severity,
  SourceEvidence,
} from "../../types.js";
import { loadEngineContext } from "../context.js";
import { computeEligibilityForAnimal } from "../eligibility/compute.js";
import { EVIDENCE_SOURCES, sourceEvidence } from "../evidence.js";
import { resolveIdentities } from "../identity/resolve.js";
import type { CanonicalRegistry } from "../registry.js";
import type { CanonicalAnimal, EngineContext } from "../types.js";
import { getReassignmentForBooking } from "../replacement/store.js";
import { deathSignalsFromFieldReports } from "./fieldDeaths.js";
import { resolveOfferingRef } from "./resolveRef.js";
import { checkPromisedWeightShortfalls } from "./weightShortfall.js";

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

interface ConfirmedAssignment {
  booking: RawBooking;
  animal: CanonicalAnimal;
  resolvedReason: string;
}

function bookingEvidence(booking: RawBooking): SourceEvidence {
  return sourceEvidence({
    source: EVIDENCE_SOURCES.FESTIVAL_BOOKINGS,
    recordId: booking.booking_id,
    field: "animal_ref",
    observedValue: {
      animal_ref: booking.animal_ref,
      customer_name: booking.customer_name,
      status: booking.status,
    },
  });
}

function listingEvidence(listing: RawListing): SourceEvidence {
  return sourceEvidence({
    source: EVIDENCE_SOURCES.EXCHANGE_LISTINGS,
    recordId: listing.listing_id,
    field: "animal_ref",
    observedValue: {
      animal_ref: listing.animal_ref,
      status: listing.status,
      listed_price_inr: listing.listed_price_inr,
    },
  });
}

function sortDiscrepancies(items: Discrepancy[]): Discrepancy[] {
  return [...items].sort((a, b) => {
    const sd = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sd !== 0) {
      return sd;
    }
    return a.issueId.localeCompare(b.issueId);
  });
}

function buildAssignments(
  bookings: RawBooking[],
  registry: CanonicalRegistry,
): {
  assignments: ConfirmedAssignment[];
  discrepancies: Discrepancy[];
} {
  const assignments: ConfirmedAssignment[] = [];
  const discrepancies: Discrepancy[] = [];

  for (const booking of bookings) {
    if (booking.status !== "confirmed") {
      continue;
    }
    const resolved = resolveOfferingRef(registry, booking.animal_ref);
    const evidence = [bookingEvidence(booking)];

    if (resolved.ambiguous.length > 0) {
      discrepancies.push({
        issueId: `DIS-BOOK-AMBIG-${booking.booking_id}`,
        severity: "high",
        entityType: "booking",
        entityId: booking.booking_id,
        title: "Booking reference matches multiple goats",
        explanation: `${booking.animal_ref} is ambiguous (${resolved.reason}); cannot safely assign this promise.`,
        affectedCustomer: booking.customer_name,
        suggestedAction: "Resolve identity manually before festival fulfillment",
        evidence: [
          ...evidence,
          sourceEvidence({
            source: EVIDENCE_SOURCES.GOATOS_ANIMALS,
            recordId: resolved.ambiguous.map((a) => a.canonicalId).join(","),
            note: "Ambiguous canonical candidates",
          }),
        ],
      });
      continue;
    }

    if (!resolved.animal) {
      const severity: Severity = booking.animal_ref.includes("??") ? "medium" : "high";
      discrepancies.push({
        issueId: `DIS-BOOK-UNRES-${booking.booking_id}`,
        severity,
        entityType: "booking",
        entityId: booking.booking_id,
        title: "Booking does not resolve to a known goat",
        explanation: `Cannot match "${booking.animal_ref}" to any canonical animal (${resolved.reason}).`,
        affectedCustomer: booking.customer_name,
        suggestedAction: "Locate the physical goat or cancel/rebook with a verified id",
        evidence,
      });
      continue;
    }

    assignments.push({
      booking,
      animal: resolved.animal,
      resolvedReason: resolved.reason,
    });
  }

  return { assignments, discrepancies };
}

function effectiveAnimalId(assignment: ConfirmedAssignment): string {
  const reassignment = getReassignmentForBooking(assignment.booking.booking_id);
  return reassignment?.substituteCanonicalId ?? assignment.animal.canonicalId;
}

function checkDoubleBookings(assignments: ConfirmedAssignment[]): Discrepancy[] {
  const byAnimal = new Map<string, ConfirmedAssignment[]>();
  for (const a of assignments) {
    const effectiveId = effectiveAnimalId(a);
    const list = byAnimal.get(effectiveId) ?? [];
    list.push(a);
    byAnimal.set(effectiveId, list);
  }

  const out: Discrepancy[] = [];
  for (const [canonicalId, group] of byAnimal) {
    if (group.length < 2) {
      continue;
    }
    const customers = group.map((g) => g.booking.customer_name);
    out.push({
      issueId: `DIS-DOUBLE-${canonicalId}`,
      severity: "critical",
      entityType: "animal",
      entityId: canonicalId,
      title: "Same goat promised to multiple customers",
      explanation: `${canonicalId} has ${group.length} confirmed bookings: ${group.map((g) => `${g.booking.booking_id} (${g.booking.customer_name})`).join("; ")}.`,
      affectedCustomer: customers.join("; "),
      suggestedAction: "Keep one booking; contact other customers immediately",
      evidence: group.flatMap((g) => [
        bookingEvidence(g.booking),
        sourceEvidence({
          source: EVIDENCE_SOURCES.GOATOS_ANIMALS,
          recordId: g.animal.goatosRecord?.animal_id ?? canonicalId,
          note: g.resolvedReason,
        }),
      ]),
    });
  }
  return out;
}

function checkIneligibleBookings(
  assignments: ConfirmedAssignment[],
  ctx: EngineContext,
  registry: CanonicalRegistry,
): Discrepancy[] {
  const out: Discrepancy[] = [];
  for (const { booking, animal } of assignments) {
    if (getReassignmentForBooking(booking.booking_id)) {
      continue;
    }
    const verdict = computeEligibilityForAnimal(animal.canonicalId, ctx, registry);
    if (verdict.status === "eligible") {
      continue;
    }
    const severity: Severity = verdict.status === "ineligible" ? "critical" : "high";
    out.push({
      issueId: `DIS-BOOK-INELIG-${booking.booking_id}`,
      severity,
      entityType: "booking",
      entityId: booking.booking_id,
      title: "Confirmed booking backs a goat not fit for delivery day",
      explanation: `${animal.canonicalId} for ${booking.customer_name}: ${verdict.reasons.join("; ")}`,
      affectedCustomer: booking.customer_name,
      suggestedAction:
        verdict.status === "needs_review"
          ? "Human review required before promising this goat"
          : "Find substitute goat or cancel booking",
      evidence: [bookingEvidence(booking), ...verdict.evidence],
    });
  }
  return out;
}

function checkFieldReportDeaths(
  assignments: ConfirmedAssignment[],
  ctx: EngineContext,
  registry: CanonicalRegistry,
): Discrepancy[] {
  const signals = deathSignalsFromFieldReports(ctx.data.fieldReports, registry);
  const bookedByAnimal = new Map(
    assignments.map((a) => [a.animal.canonicalId, a.booking]),
  );

  const out: Discrepancy[] = [];
  for (const signal of signals) {
    const booking = bookedByAnimal.get(signal.animal.canonicalId);
    if (!booking || getReassignmentForBooking(booking.booking_id)) {
      continue;
    }
    const goatosStatus = signal.animal.goatosRecord?.status ?? "unknown";
    if (goatosStatus === "dead") {
      continue;
    }
    out.push({
      issueId: `DIS-DEATH-FIELD-${booking.booking_id}`,
      severity: "critical",
      entityType: "booking",
      entityId: booking.booking_id,
      title: "Field report records death; GoatOS still shows live",
      explanation: `Field report ${signal.fieldReportId} reports death for ${signal.animal.canonicalId}, but GoatOS status is "${goatosStatus}". Customer ${booking.customer_name} still has a confirmed booking.`,
      affectedCustomer: booking.customer_name,
      suggestedAction: "Verify carcass/removal; cancel booking and contact customer",
      evidence: [
        bookingEvidence(booking),
        sourceEvidence({
          source: EVIDENCE_SOURCES.FIELD_REPORTS,
          recordId: signal.fieldReportId,
          field: "text",
          observedValue: signal.text,
          note: "Unstructured death signal not reflected in GoatOS",
        }),
        sourceEvidence({
          source: EVIDENCE_SOURCES.GOATOS_ANIMALS,
          recordId: signal.animal.goatosRecord?.animal_id ?? signal.animal.canonicalId,
          field: "status",
          observedValue: goatosStatus,
        }),
      ],
    });
  }
  return out;
}

function checkListings(
  listings: RawListing[],
  assignments: ConfirmedAssignment[],
  ctx: EngineContext,
  registry: CanonicalRegistry,
): Discrepancy[] {
  const assignedIds = new Set(assignments.map((a) => a.animal.canonicalId));
  const bookingByAnimal = new Map(
    assignments.map((a) => [a.animal.canonicalId, a.booking]),
  );
  const out: Discrepancy[] = [];

  for (const listing of listings) {
    if (listing.status !== "active") {
      continue;
    }
    const resolved = resolveOfferingRef(registry, listing.animal_ref);
    const evidence = [listingEvidence(listing)];

    if (!resolved.animal) {
      out.push({
        issueId: `DIS-LST-UNRES-${listing.listing_id}`,
        severity: "medium",
        entityType: "listing",
        entityId: listing.listing_id,
        title: "Active listing references unknown goat",
        explanation: `Listing ${listing.listing_id} ref "${listing.animal_ref}" does not resolve (${resolved.reason}).`,
        suggestedAction: "Remove listing or fix animal reference",
        evidence,
      });
      continue;
    }

    const animal = resolved.animal;
    const booking = bookingByAnimal.get(animal.canonicalId);
    if (assignedIds.has(animal.canonicalId) && booking) {
      out.push({
        issueId: `DIS-LST-BOOKED-${listing.listing_id}`,
        severity: "high",
        entityType: "listing",
        entityId: listing.listing_id,
        title: "Active listing for already-promised goat",
        explanation: `${animal.canonicalId} is listed but confirmed for ${booking.customer_name} (${booking.booking_id}).`,
        affectedCustomer: booking.customer_name,
        suggestedAction: "Delist immediately — goat is spoken for",
        evidence: [...evidence, bookingEvidence(booking)],
      });
      continue;
    }

    const verdict = computeEligibilityForAnimal(animal.canonicalId, ctx, registry);
    if (verdict.status !== "eligible") {
      out.push({
        issueId: `DIS-LST-INELIG-${listing.listing_id}`,
        severity: verdict.status === "ineligible" ? "high" : "medium",
        entityType: "listing",
        entityId: listing.listing_id,
        title: "Active listing for delivery-ineligible goat",
        explanation: `${animal.canonicalId} is listed but ${verdict.reasons.join("; ")}`,
        suggestedAction: "Remove listing until goat is eligible on delivery day",
        evidence: [...evidence, ...verdict.evidence],
      });
    }
  }

  return out;
}

export function reconcileBookingsFromContext(ctx: EngineContext): Discrepancy[] {
  const { registry } = resolveIdentities(ctx);
  const { assignments, discrepancies: bookingIssues } = buildAssignments(
    ctx.data.bookings,
    registry,
  );

  const all = [
    ...bookingIssues,
    ...checkDoubleBookings(assignments),
    ...checkIneligibleBookings(assignments, ctx, registry),
    ...checkPromisedWeightShortfalls(assignments, ctx, registry),
    ...checkFieldReportDeaths(assignments, ctx, registry),
    ...checkListings(ctx.data.listings, assignments, ctx, registry),
  ];

  return sortDiscrepancies(all);
}

export function reconcileBookings(): Discrepancy[] {
  return reconcileBookingsFromContext(loadEngineContext());
}
