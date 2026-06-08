/**
 * Pricing input lookup by breed and valuation effective date.
 */
import type { RawPricingInput, SourceEvidence } from "../../types.js";
import { EVIDENCE_SOURCES, sourceEvidence } from "../evidence.js";
import { isOnOrBefore } from "../time.js";
import type { CalendarDate } from "../types.js";

export function normalizeBreed(breed: string): string {
  return breed.trim().toLowerCase().replace(/\s+/g, " ");
}

export function formatBreedLabel(breed: string): string {
  const norm = normalizeBreed(breed);
  if (!norm || norm === "unknown") {
    return breed;
  }
  return norm
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export interface PricingLookupResult {
  input: RawPricingInput;
  evidence: SourceEvidence;
}

/**
 * Rate effective on valuationDate: latest row where effective_date <= valuationDate.
 */
export function lookupPricingInput(
  breed: string,
  valuationDate: CalendarDate,
  inputs: RawPricingInput[],
): PricingLookupResult | null {
  const norm = normalizeBreed(breed);
  const eligible = inputs.filter(
    (row) =>
      normalizeBreed(row.breed) === norm &&
      isOnOrBefore(row.effective_date, valuationDate),
  );
  if (eligible.length === 0) {
    return null;
  }
  eligible.sort((a, b) => b.effective_date.localeCompare(a.effective_date));
  const input = eligible[0]!;
  return {
    input,
    evidence: sourceEvidence({
      source: EVIDENCE_SOURCES.PRICING_INPUTS,
      recordId: input.pricing_input_id,
      field: "effective_date",
      observedValue: {
        effective_date: input.effective_date,
        mutton_rate_inr_per_kg: input.mutton_rate_inr_per_kg,
        breed_premium_pct: input.breed_premium_pct,
        festival_surge_pct: input.festival_surge_pct,
      },
      interpretedValue: { valuationDate, breed: input.breed },
      note: "Latest pricing row effective on or before valuation date",
    }),
  };
}

export function computePriceInr(
  trustedWeightKg: number,
  input: RawPricingInput,
): number {
  const amount =
    trustedWeightKg *
    input.mutton_rate_inr_per_kg *
    (1 + input.breed_premium_pct / 100) *
    (1 + input.festival_surge_pct / 100);
  return Math.round(amount);
}
