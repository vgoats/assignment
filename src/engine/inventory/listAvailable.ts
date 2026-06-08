/**
 * Goats safe to show as offerings: resolved identity, delivery-eligible, priced, unassigned.
 */
import type { AvailableAnimal } from "../../types.js";
import { getAssignedCanonicalIds } from "../booking/assignments.js";
import { getRuntimeAssignedIds } from "../booking/store.js";
import { loadEngineContext } from "../context.js";
import { computeEligibilityForAnimal } from "../eligibility/compute.js";
import { resolveIdentities } from "../identity/resolve.js";
import { priceAnimalForAnimal } from "../pricing/price.js";
import { formatBreedLabel } from "../pricing/lookup.js";
import type { CanonicalAnimal, EngineContext } from "../types.js";
import { saleEligibilityBlockReason } from "./bookable.js";

function displayBreed(animal: CanonicalAnimal): string {
  const raw =
    animal.goatosRecord?.breed ?? animal.legacySnapshots[0]?.breed ?? "unknown";
  if (raw === "unknown") {
    return raw;
  }
  return formatBreedLabel(raw);
}

function displaySpecies(animal: CanonicalAnimal): string {
  return animal.goatosRecord?.species ?? "goat";
}

export function listAvailableAnimalsFromContext(ctx: EngineContext): AvailableAnimal[] {
  const { registry } = resolveIdentities(ctx);
  const assigned = getAssignedCanonicalIds(ctx, registry, getRuntimeAssignedIds());
  const available: AvailableAnimal[] = [];

  for (const animal of registry.all()) {
    if (assigned.has(animal.canonicalId)) {
      continue;
    }
    if (saleEligibilityBlockReason(animal.canonicalId, ctx, registry) !== null) {
      continue;
    }

    const eligibility = computeEligibilityForAnimal(animal.canonicalId, ctx, registry);
    const price = priceAnimalForAnimal(animal.canonicalId, ctx, registry);

    available.push({
      canonicalId: animal.canonicalId,
      identityConfidence: animal.identityConfidence,
      species: displaySpecies(animal),
      breed: displayBreed(animal),
      eligibility,
      price,
    });
  }

  available.sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
  return available;
}

export function listAvailableAnimals(): AvailableAnimal[] {
  return listAvailableAnimalsFromContext(loadEngineContext());
}
