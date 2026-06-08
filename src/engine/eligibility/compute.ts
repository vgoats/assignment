/**
 * Delivery-day eligibility from festival rules and health_ledger.
 *
 * Evaluated against simulation_config.deliveryDate — never the machine clock.
 * See docs/ASSUMPTIONS.md § Eligibility.
 */
import type { FestivalRules } from "../../config.js";
import type { EligibilityVerdict, RawHealthEvent, SourceEvidence } from "../../types.js";
import { loadEngineContext } from "../context.js";
import { EVIDENCE_SOURCES, sourceEvidence } from "../evidence.js";
import { resolveIdentities } from "../identity/resolve.js";
import type { CanonicalRegistry } from "../registry.js";
import {
  addCalendarDays,
  calendarDaysBetween,
  clockFromContext,
  isBefore,
  isOnOrBefore,
  toCalendarDate,
} from "../time.js";
import type { CalendarDate, CanonicalAnimal, EngineContext } from "../types.js";

interface ReasonBlock {
  reason: string;
  status: "ineligible" | "needs_review";
  evidence: SourceEvidence;
}

function parseWithdrawalDays(value: string | number): number | null {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function healthEventsForAnimal(
  animal: CanonicalAnimal,
  health: RawHealthEvent[],
): RawHealthEvent[] {
  const ids = new Set(animal.sourceAnimalIds);
  return health.filter((e) => ids.has(e.animal_id));
}

function withdrawalBlocksDelivery(
  event: RawHealthEvent,
  deliveryDate: CalendarDate,
  boundary: FestivalRules["withdrawalBoundary"],
): ReasonBlock | null {
  if (event.event_type !== "treatment") {
    return null;
  }
  const days = parseWithdrawalDays(event.withdrawal_days);
  if (days === null) {
    return null;
  }
  const eventDate = toCalendarDate(event.event_date);
  const lastBlockedDay = addCalendarDays(eventDate, days);
  const blocked =
    boundary === "inclusive"
      ? isOnOrBefore(deliveryDate, lastBlockedDay)
      : isBefore(deliveryDate, lastBlockedDay);

  if (!blocked) {
    return null;
  }

  return {
    status: "ineligible",
    reason: `Medicine withdrawal for ${event.drug} (${days}d from ${eventDate}) blocks delivery on ${deliveryDate}`,
    evidence: sourceEvidence({
      source: EVIDENCE_SOURCES.HEALTH_LEDGER,
      recordId: event.health_event_id,
      field: "withdrawal_days",
      observedValue: { drug: event.drug, event_date: eventDate, withdrawal_days: days },
      interpretedValue: { lastBlockedDay, deliveryDate, blocked: true },
      note: `Per-treatment withdrawal; inclusive boundary through ${lastBlockedDay}`,
    }),
  };
}

function quarantineBlocksDelivery(
  event: RawHealthEvent,
  deliveryDate: CalendarDate,
): ReasonBlock | null {
  if (event.event_type !== "quarantine_started") {
    return null;
  }
  const startDate = toCalendarDate(event.event_date);
  if (isBefore(deliveryDate, startDate)) {
    return null;
  }
  const resolvedOn = event.resolved_on.trim();
  if (resolvedOn && !isBefore(deliveryDate, toCalendarDate(resolvedOn))) {
    return null;
  }

  return {
    status: "ineligible",
    reason: `In quarantine (${event.condition || "quarantine"}) on delivery day ${deliveryDate}`,
    evidence: sourceEvidence({
      source: EVIDENCE_SOURCES.HEALTH_LEDGER,
      recordId: event.health_event_id,
      field: "quarantine_started",
      observedValue: {
        event_date: startDate,
        resolved_on: resolvedOn || null,
        condition: event.condition,
      },
      interpretedValue: { activeOnDelivery: true },
      note: resolvedOn
        ? `Quarantine still active on delivery (clears ${toCalendarDate(resolvedOn)})`
        : "Quarantine not cleared in health ledger before delivery",
    }),
  };
}

function conditionActiveOnDelivery(
  event: RawHealthEvent,
  deliveryDate: CalendarDate,
  disqualifying: string[],
): ReasonBlock | null {
  if (event.event_type !== "condition_started") {
    return null;
  }
  if (!disqualifying.includes(event.condition)) {
    return null;
  }
  const startDate = toCalendarDate(event.event_date);
  if (isBefore(deliveryDate, startDate)) {
    return null;
  }
  const resolvedOn = event.resolved_on.trim();
  if (resolvedOn && !isBefore(deliveryDate, toCalendarDate(resolvedOn))) {
    return null;
  }

  return {
    status: "ineligible",
    reason: `Active disqualifying condition "${event.condition}" on delivery day ${deliveryDate}`,
    evidence: sourceEvidence({
      source: EVIDENCE_SOURCES.HEALTH_LEDGER,
      recordId: event.health_event_id,
      field: "condition",
      observedValue: {
        condition: event.condition,
        event_date: startDate,
        resolved_on: resolvedOn || null,
      },
      interpretedValue: { activeOnDelivery: true },
      note: resolvedOn
        ? `Condition not yet cleared before delivery (clears ${toCalendarDate(resolvedOn)})`
        : "Condition has no resolution date in health ledger",
    }),
  };
}

function checkGoatOSStatus(
  animal: CanonicalAnimal,
  deliveryDate: CalendarDate,
  disallowed: string[],
): ReasonBlock | null {
  const record = animal.goatosRecord;
  if (!record) {
    return null;
  }
  if (!disallowed.includes(record.status)) {
    return null;
  }
  return {
    status: "ineligible",
    reason: `GoatOS status "${record.status}" disallows festival delivery on ${deliveryDate}`,
    evidence: sourceEvidence({
      source: EVIDENCE_SOURCES.GOATOS_ANIMALS,
      recordId: record.animal_id,
      field: "status",
      observedValue: record.status,
      interpretedValue: { disallowed: true },
    }),
  };
}

function checkAge(
  animal: CanonicalAnimal,
  deliveryDate: CalendarDate,
  minAgeDays: number,
): ReasonBlock | null {
  const dob =
    animal.goatosRecord?.dob ??
    animal.legacySnapshots[0]?.dob ??
    null;
  if (!dob) {
    return {
      status: "needs_review",
      reason: "Date of birth unknown — cannot confirm minimum age on delivery day",
      evidence: sourceEvidence({
        source: EVIDENCE_SOURCES.FESTIVAL_RULES,
        recordId: "minAgeDays",
        observedValue: minAgeDays,
        note: "No DOB on GoatOS or linked legacy CPT record",
      }),
    };
  }
  const ageDays = calendarDaysBetween(dob, deliveryDate);
  if (ageDays >= minAgeDays) {
    return null;
  }
  const sourceId =
    animal.goatosRecord?.animal_id ??
    animal.legacySnapshots[0]?.legacyId ??
    animal.canonicalId;
  const source = animal.goatosRecord
    ? EVIDENCE_SOURCES.GOATOS_ANIMALS
    : EVIDENCE_SOURCES.LEGACY_CPT_RECORDS;

  return {
    status: "ineligible",
    reason: `Age ${ageDays} days on ${deliveryDate} is below minimum ${minAgeDays} days`,
    evidence: sourceEvidence({
      source,
      recordId: sourceId,
      field: "dob",
      observedValue: dob,
      interpretedValue: { ageDaysOnDelivery: ageDays, minAgeDays },
    }),
  };
}

const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 } as const;

function checkIdentityConfidence(
  animal: CanonicalAnimal,
  rules: FestivalRules,
): ReasonBlock | null {
  if (!rules.requiresResolvedIdentity) {
    return null;
  }
  const required = rules.minIdentityConfidenceForSale as keyof typeof CONFIDENCE_RANK;
  const requiredRank = CONFIDENCE_RANK[required] ?? CONFIDENCE_RANK.high;
  const actualRank = CONFIDENCE_RANK[animal.identityConfidence];
  if (actualRank >= requiredRank) {
    return null;
  }
  return {
    status: "needs_review",
    reason: `Identity confidence "${animal.identityConfidence}" below required "${required}"`,
    evidence: sourceEvidence({
      source: EVIDENCE_SOURCES.FESTIVAL_RULES,
      recordId: "minIdentityConfidenceForSale",
      observedValue: animal.identityConfidence,
      interpretedValue: { required },
      note: animal.identityNotes.join("; ") || undefined,
    }),
  };
}

function finalizeVerdict(
  deliveryDate: CalendarDate,
  blocks: ReasonBlock[],
): EligibilityVerdict {
  const ineligible = blocks.filter((b) => b.status === "ineligible");
  if (ineligible.length > 0) {
    return {
      asOfDate: deliveryDate,
      status: "ineligible",
      reasons: ineligible.map((b) => b.reason),
      evidence: ineligible.map((b) => b.evidence),
    };
  }
  const review = blocks.filter((b) => b.status === "needs_review");
  if (review.length > 0) {
    return {
      asOfDate: deliveryDate,
      status: "needs_review",
      reasons: review.map((b) => b.reason),
      evidence: review.map((b) => b.evidence),
    };
  }
  return {
    asOfDate: deliveryDate,
    status: "eligible",
    reasons: [`Eligible for festival delivery on ${deliveryDate}`],
    evidence: [
      sourceEvidence({
        source: EVIDENCE_SOURCES.SIMULATION_CONFIG,
        recordId: "deliveryDate",
        observedValue: deliveryDate,
        note: "No blocking health, status, or age findings for delivery day",
      }),
    ],
  };
}

export function computeEligibilityForAnimal(
  canonicalAnimalId: string,
  ctx: EngineContext,
  registry: CanonicalRegistry,
): EligibilityVerdict {
  const { deliveryDate } = clockFromContext(ctx);
  const { rules } = ctx;
  const animal = registry.getByCanonicalId(canonicalAnimalId);

  if (!animal) {
    return {
      asOfDate: deliveryDate,
      status: "needs_review",
      reasons: [`Unknown canonical animal "${canonicalAnimalId}"`],
      evidence: [],
    };
  }

  const blocks: ReasonBlock[] = [];
  const healthEvents = healthEventsForAnimal(animal, ctx.data.health);

  blocks.push(
    ...([
      checkIdentityConfidence(animal, rules),
      checkGoatOSStatus(animal, deliveryDate, rules.disallowedStatuses),
      checkAge(animal, deliveryDate, rules.minAgeDays),
    ].filter((b): b is ReasonBlock => b !== null)),
  );

  if (rules.quarantineDisqualifies) {
    for (const event of healthEvents) {
      const q = quarantineBlocksDelivery(event, deliveryDate);
      if (q) {
        blocks.push(q);
      }
    }
  }

  for (const event of healthEvents) {
    const c = conditionActiveOnDelivery(
      event,
      deliveryDate,
      rules.disqualifyingConditions,
    );
    if (c) {
      blocks.push(c);
    }
  }

  if (rules.withdrawalBlocksDelivery) {
    for (const event of healthEvents) {
      const w = withdrawalBlocksDelivery(event, deliveryDate, rules.withdrawalBoundary);
      if (w) {
        blocks.push(w);
      }
    }
  }

  return finalizeVerdict(deliveryDate, blocks);
}

export function computeEligibility(canonicalAnimalId: string): EligibilityVerdict {
  const ctx = loadEngineContext();
  const { registry } = resolveIdentities(ctx);
  return computeEligibilityForAnimal(canonicalAnimalId, ctx, registry);
}
