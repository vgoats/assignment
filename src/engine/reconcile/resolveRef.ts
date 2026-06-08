import type { CanonicalRegistry } from "../registry.js";
import type { CanonicalAnimal, IdentityConfidence } from "../types.js";

export interface ResolvedOfferingRef {
  animal: CanonicalAnimal | null;
  ambiguous: CanonicalAnimal[];
  confidence: IdentityConfidence;
  reason: string;
}

const BREED_FARM_NUM_RE = /^([A-Za-z][A-Za-z ]*?)\s+(\d+|\?\?)$/;

function tryBreedFarmNumber(
  registry: CanonicalRegistry,
  ref: string,
): CanonicalAnimal | null {
  const m = ref.trim().match(BREED_FARM_NUM_RE);
  if (!m?.[2] || m[2] === "??") {
    return null;
  }
  const num = m[2];
  const candidates: CanonicalAnimal[] = [];
  for (const prefix of ["CBE", "CPT"]) {
    const matches = registry.getByFarmNumber(`${prefix}-${num}`);
    if (matches.length === 1) {
      candidates.push(matches[0]!);
    }
  }
  if (candidates.length === 1) {
    return candidates[0]!;
  }
  return null;
}

export function resolveOfferingRef(
  registry: CanonicalRegistry,
  ref: string,
): ResolvedOfferingRef {
  const trimmed = ref.trim();
  const base = registry.resolveRef(trimmed);

  if (base.matches.length === 1) {
    return {
      animal: base.matches[0]!,
      ambiguous: [],
      confidence: base.confidence,
      reason: base.reason,
    };
  }
  if (base.matches.length > 1) {
    return {
      animal: null,
      ambiguous: base.matches,
      confidence: "low",
      reason: base.reason,
    };
  }

  const breedFarm = tryBreedFarmNumber(registry, trimmed);
  if (breedFarm) {
    return {
      animal: breedFarm,
      ambiguous: [],
      confidence: "medium",
      reason: "breed label + farm number maps to unique goat",
    };
  }

  if (trimmed.includes("??")) {
    return {
      animal: null,
      ambiguous: [],
      confidence: "low",
      reason: "reference contains unresolved placeholder (??)",
    };
  }

  return {
    animal: null,
    ambiguous: [],
    confidence: "low",
    reason: base.reason,
  };
}
