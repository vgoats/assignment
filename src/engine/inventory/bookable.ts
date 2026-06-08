/**
 * Shared checks for whether a goat may be promised (excluding assignment state).
 */
import { computeEligibilityForAnimal } from "../eligibility/compute.js";
import { feedExposureSaleBlockReason } from "../feed/traceExposure.js";
import { priceAnimalForAnimal } from "../pricing/price.js";
import type { CanonicalRegistry } from "../registry.js";
import type { CanonicalAnimal, EngineContext, IdentityConfidence } from "../types.js";

const CONFIDENCE_RANK: Record<IdentityConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function meetsIdentityBar(animal: CanonicalAnimal, required: string): boolean {
  const requiredRank = CONFIDENCE_RANK[required as IdentityConfidence] ?? CONFIDENCE_RANK.high;
  return CONFIDENCE_RANK[animal.identityConfidence] >= requiredRank;
}

/** Returns a refusal reason, or null if the goat passes sale/eligibility gates. */
export function saleEligibilityBlockReason(
  canonicalAnimalId: string,
  ctx: EngineContext,
  registry: CanonicalRegistry,
): string | null {
  const animal = registry.getByCanonicalId(canonicalAnimalId);
  if (!animal) {
    return `Unknown goat ${canonicalAnimalId}`;
  }

  const { rules } = ctx;
  if (!meetsIdentityBar(animal, rules.minIdentityConfidenceForSale)) {
    return `Identity confidence "${animal.identityConfidence}" below required "${rules.minIdentityConfidenceForSale}"`;
  }

  const eligibility = computeEligibilityForAnimal(canonicalAnimalId, ctx, registry);
  if (eligibility.status !== "eligible") {
    return eligibility.reasons.join("; ");
  }

  const feedBlock = feedExposureSaleBlockReason(canonicalAnimalId, ctx);
  if (feedBlock) {
    return feedBlock;
  }

  let price;
  try {
    price = priceAnimalForAnimal(canonicalAnimalId, ctx, registry);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "cannot compute trusted price";
    return msg;
  }

  if (rules.requiresTrustedWeight && price.trustedWeightKg < rules.minWeightKg) {
    return `Trusted weight ${price.trustedWeightKg} kg is below minimum ${rules.minWeightKg} kg`;
  }

  return null;
}
