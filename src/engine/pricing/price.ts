/**
 * Price a canonical goat from trusted telemetry weight and pricing_inputs.
 */
import type { PriceVerdict } from "../../types.js";
import { loadEngineContext } from "../context.js";
import { EVIDENCE_SOURCES, sourceEvidence } from "../evidence.js";
import { resolveIdentities } from "../identity/resolve.js";
import type { CanonicalRegistry } from "../registry.js";
import { clockFromContext } from "../time.js";
import type { CanonicalAnimal, EngineContext } from "../types.js";
import { computePriceInr, lookupPricingInput } from "./lookup.js";
import { trustedWeightFromTelemetry } from "./telemetry.js";

function breedForAnimal(animal: CanonicalAnimal): string | null {
  return animal.goatosRecord?.breed ?? animal.legacySnapshots[0]?.breed ?? null;
}

function legacyWeightFallback(animal: CanonicalAnimal): {
  trustedWeightKg: number;
  evidence: PriceVerdict["evidence"];
} | null {
  if (animal.legacySnapshots.length === 0) {
    return null;
  }
  const latest = [...animal.legacySnapshots].sort((a, b) =>
    b.recordedOn.localeCompare(a.recordedOn),
  )[0]!;
  return {
    trustedWeightKg: latest.weightKg,
    evidence: [
      sourceEvidence({
        source: EVIDENCE_SOURCES.LEGACY_CPT_RECORDS,
        recordId: latest.legacyId,
        field: "weight_lbs",
        observedValue: latest.weightLbs,
        interpretedValue: latest.weightKg,
        note: "No usable GoatSense telemetry; legacy CPT weight converted to kg",
      }),
    ],
  };
}

export function priceAnimalForAnimal(
  canonicalAnimalId: string,
  ctx: EngineContext,
  registry: CanonicalRegistry,
): PriceVerdict {
  const { nowDate } = clockFromContext(ctx);
  const valuationDate = nowDate;
  const animal = registry.getByCanonicalId(canonicalAnimalId);

  if (!animal) {
    throw new Error(`Unknown canonical animal "${canonicalAnimalId}"`);
  }

  const breed = breedForAnimal(animal);
  if (!breed) {
    throw new Error(`No breed on record for "${canonicalAnimalId}"`);
  }

  const pricing = lookupPricingInput(
    breed,
    valuationDate,
    ctx.data.pricing,
  );
  if (!pricing) {
    throw new Error(`No pricing input for breed "${breed}" on ${valuationDate}`);
  }

  const telemetryWeight = trustedWeightFromTelemetry(
    animal.rfidTags,
    ctx.data.telemetry,
    valuationDate,
  );
  const weight = telemetryWeight ?? legacyWeightFallback(animal);
  if (!weight) {
    throw new Error(`No trusted weight for "${canonicalAnimalId}" on ${valuationDate}`);
  }

  const amountInr = computePriceInr(weight.trustedWeightKg, pricing.input);

  return {
    amountInr,
    trustedWeightKg: weight.trustedWeightKg,
    asOfDate: valuationDate,
    evidence: [...weight.evidence, pricing.evidence],
  };
}

export function priceAnimal(canonicalAnimalId: string): PriceVerdict {
  const ctx = loadEngineContext();
  const { registry } = resolveIdentities(ctx);
  return priceAnimalForAnimal(canonicalAnimalId, ctx, registry);
}
