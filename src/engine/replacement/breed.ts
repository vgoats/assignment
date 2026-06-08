/**
 * Breed intent from a booking's animal reference when the goat itself is unresolved.
 */
import { normalizeBreed } from "../pricing/lookup.js";
import type { CanonicalAnimal } from "../types.js";

export function displayBreed(animal: CanonicalAnimal): string {
  return animal.goatosRecord?.breed ?? animal.legacySnapshots[0]?.breed ?? "";
}

export function parseBreedFromAnimalRef(animalRef: string): string | null {
  const trimmed = animalRef.trim();
  if (!trimmed || trimmed.includes("??")) {
    return null;
  }
  if (/^(G-|S-)?(CBE|CPT)-\d/i.test(trimmed)) {
    return null;
  }
  if (/^\d{12}$/.test(trimmed)) {
    return null;
  }
  if (/^(CBE|CPT)-\d/i.test(trimmed)) {
    return null;
  }
  const match = trimmed.match(/^([A-Za-z]+)/);
  return match?.[1] ?? null;
}

export function requiredBreedForBooking(
  animalRef: string,
  resolvedAnimal: CanonicalAnimal | null,
): string | null {
  if (resolvedAnimal) {
    const breed = displayBreed(resolvedAnimal);
    return breed ? normalizeBreed(breed) : null;
  }
  const parsed = parseBreedFromAnimalRef(animalRef);
  return parsed ? normalizeBreed(parsed) : null;
}

export function breedsMatch(required: string, candidateBreed: string): boolean {
  return normalizeBreed(candidateBreed) === required;
}
