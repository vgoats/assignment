/**
 * Minimal animal history: telemetry, health ledger, breeding lineage.
 */
import type {
  RawBreeding,
  RawHealthEvent,
  RawTelemetryRead,
} from "../../types.js";
import { loadEngineContext } from "../context.js";
import { resolveIdentities } from "../identity/resolve.js";
import type { CanonicalRegistry } from "../registry.js";
import type { EngineContext } from "../types.js";

export interface AnimalHistory {
  canonicalId: string;
  telemetry: RawTelemetryRead[];
  health: RawHealthEvent[];
  breeding: {
    asKid: RawBreeding | null;
    asDam: RawBreeding[];
    asSire: RawBreeding[];
  };
}

const MAX_TELEMETRY_READS = 120;

export function getAnimalHistoryForAnimal(
  canonicalAnimalId: string,
  ctx: EngineContext,
  registry: CanonicalRegistry,
): AnimalHistory | null {
  const animal = registry.getByCanonicalId(canonicalAnimalId);
  if (!animal) {
    return null;
  }

  const tags = new Set(animal.rfidTags);
  const animalIds = new Set(animal.sourceAnimalIds);

  const telemetry = ctx.data.telemetry
    .filter((r) => tags.has(r.tag))
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, MAX_TELEMETRY_READS);

  const health = ctx.data.health
    .filter((e) => animalIds.has(e.animal_id))
    .sort((a, b) => b.event_date.localeCompare(a.event_date));

  const asKid =
    ctx.data.breeding.find((b) => animalIds.has(b.kid_animal_id)) ?? null;
  const asDam = ctx.data.breeding.filter((b) =>
    animalIds.has(b.dam_id),
  );
  const asSire = ctx.data.breeding.filter((b) =>
    animalIds.has(b.sire_id),
  );

  return {
    canonicalId: canonicalAnimalId,
    telemetry,
    health,
    breeding: { asKid, asDam, asSire },
  };
}

export function getAnimalHistory(canonicalAnimalId: string): AnimalHistory | null {
  const ctx = loadEngineContext();
  const { registry } = resolveIdentities(ctx);
  return getAnimalHistoryForAnimal(canonicalAnimalId, ctx, registry);
}
