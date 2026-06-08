/**
 * Canonical animal registry — lookup by id, tag, farm number, or free-text ref.
 */
import type {
  AmbiguousIdentityLink,
  CanonicalAnimal,
  IdentityConfidence,
} from "./types.js";

export class CanonicalRegistry {
  private byCanonicalId = new Map<string, CanonicalAnimal>();
  private byAnimalId = new Map<string, CanonicalAnimal>();
  private byLegacyId = new Map<string, CanonicalAnimal>();
  private byRfidTag = new Map<string, CanonicalAnimal[]>();
  private byFarmNumber = new Map<string, CanonicalAnimal[]>();
  readonly ambiguousLinks: AmbiguousIdentityLink[];

  constructor(animals: CanonicalAnimal[], ambiguousLinks: AmbiguousIdentityLink[]) {
    this.ambiguousLinks = ambiguousLinks;
    for (const animal of animals) {
      this.byCanonicalId.set(animal.canonicalId, animal);
      for (const id of animal.sourceAnimalIds) {
        this.byAnimalId.set(id, animal);
      }
      for (const id of animal.legacyIds) {
        this.byLegacyId.set(id, animal);
      }
      for (const tag of animal.rfidTags) {
        this.pushIndex(this.byRfidTag, tag, animal);
      }
      for (const fn of animal.farmNumbers) {
        this.pushIndex(this.byFarmNumber, fn.toUpperCase(), animal);
      }
    }
  }

  private pushIndex(map: Map<string, CanonicalAnimal[]>, key: string, animal: CanonicalAnimal): void {
    const list = map.get(key) ?? [];
    if (!list.includes(animal)) {
      list.push(animal);
    }
    map.set(key, list);
  }

  all(): CanonicalAnimal[] {
    return [...this.byCanonicalId.values()];
  }

  getByCanonicalId(id: string): CanonicalAnimal | undefined {
    return this.byCanonicalId.get(id);
  }

  getByAnimalId(id: string): CanonicalAnimal | undefined {
    return this.byAnimalId.get(id);
  }

  getByLegacyId(id: string): CanonicalAnimal | undefined {
    return this.byLegacyId.get(id);
  }

  /** All animals carrying this RFID tag (0, 1, or many if data is inconsistent). */
  getByRfidTag(tag: string): CanonicalAnimal[] {
    return [...(this.byRfidTag.get(tag) ?? [])];
  }

  /** Farm numbers are not unique — always returns a (possibly empty) list. */
  getByFarmNumber(farmNumber: string): CanonicalAnimal[] {
    return [...(this.byFarmNumber.get(farmNumber.trim().toUpperCase()) ?? [])];
  }

  /**
   * Resolve an external reference (booking sheet, listing, movement) to canonical animal(s).
   * Does not silently pick when multiple candidates exist.
   */
  resolveRef(ref: string): {
    matches: CanonicalAnimal[];
    confidence: IdentityConfidence;
    reason: string;
  } {
    const trimmed = ref.trim();
    if (!trimmed) {
      return { matches: [], confidence: "low", reason: "empty reference" };
    }

    const byId = this.getByAnimalId(trimmed) ?? this.getByLegacyId(trimmed);
    if (byId) {
      return { matches: [byId], confidence: "high", reason: "exact animal_id or legacy_id" };
    }

    if (/^\d{12}$/.test(trimmed)) {
      const tagMatches = this.getByRfidTag(trimmed);
      if (tagMatches.length === 1) {
        return { matches: tagMatches, confidence: "high", reason: "unique RFID tag" };
      }
      if (tagMatches.length > 1) {
        return { matches: tagMatches, confidence: "low", reason: "RFID tag maps to multiple animals" };
      }
    }

    const farmNorm = trimmed.toUpperCase();
    if (/^(CBE|CPT)-\d+$/.test(farmNorm)) {
      const farmMatches = this.getByFarmNumber(farmNorm);
      if (farmMatches.length === 1) {
        return { matches: farmMatches, confidence: "medium", reason: "unique farm_number" };
      }
      if (farmMatches.length > 1) {
        return {
          matches: farmMatches,
          confidence: "low",
          reason: `farm_number ${farmNorm} is ambiguous (${farmMatches.length} animals)`,
        };
      }
    }

    return { matches: [], confidence: "low", reason: "no match" };
  }
}
