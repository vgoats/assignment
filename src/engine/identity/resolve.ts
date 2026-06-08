/**
 * Identity resolution — cluster physical goats across GoatOS, legacy CPT, and tags.
 *
 * See docs/ASSUMPTIONS.md § Identity for documented assumptions.
 */
import type { RawGoatOSAnimal, RawLegacyCptAnimal } from "../../types.js";
import { EVIDENCE_SOURCES, sourceEvidence } from "../evidence.js";
import { loadEngineContext } from "../context.js";
import { CanonicalRegistry } from "../registry.js";
import { legacyToSnapshot } from "./parseLegacy.js";
import { buildTagAliasGroups, type TagAliasGroups } from "./tagAliases.js";
import { UnionFind } from "./unionFind.js";
import type {
  AmbiguousIdentityLink,
  CanonicalAnimal,
  EngineContext,
  IdentityConfidence,
} from "../types.js";
import {
  goatosNodeId,
  legacyNodeId,
  parseNodeId,
} from "../types.js";

export interface IdentityResolutionResult {
  registry: CanonicalRegistry;
  ambiguousLinks: AmbiguousIdentityLink[];
}

const RFID_RE = /^\d{12}$/;

interface MergeAttempt {
  a: string;
  b: string;
  key: string;
  evidence: ReturnType<typeof sourceEvidence>[];
}

/** All RFID tags for a GoatOS row: current, prior, and retag alias equivalents. */
function collectGoatTags(animal: RawGoatOSAnimal, aliases: TagAliasGroups): string[] {
  const raw = [animal.rfid_tag, ...animal.prior_tags].filter(Boolean);
  const seen = new Set<string>();
  for (const tag of raw) {
    seen.add(tag);
    seen.add(aliases.find(tag));
  }
  return [...seen];
}

/** Index GoatOS animals by every tag they carry (including alias groups). */
function goatosByTag(
  animals: RawGoatOSAnimal[],
  aliases: TagAliasGroups,
): Map<string, RawGoatOSAnimal[]> {
  const index = new Map<string, RawGoatOSAnimal[]>();
  for (const animal of animals) {
    for (const tag of collectGoatTags(animal, aliases)) {
      const list = index.get(tag) ?? [];
      if (!list.includes(animal)) {
        list.push(animal);
      }
      index.set(tag, list);
    }
  }
  return index;
}

/** Find GoatOS rows matching a tag directly or via retag alias. */
function tagLookup(
  tag: string,
  index: Map<string, RawGoatOSAnimal[]>,
  aliases: TagAliasGroups,
): RawGoatOSAnimal[] {
  const direct = index.get(tag) ?? [];
  const root = aliases.find(tag);
  const viaAlias = index.get(root) ?? [];
  const merged = new Map<string, RawGoatOSAnimal>();
  for (const a of [...direct, ...viaAlias]) {
    merged.set(a.animal_id, a);
  }
  return [...merged.values()];
}

/** Link legacy CPT to GoatOS when RFID matches exactly one row; else record ambiguity. */
function tryTagMerge(
  legacy: RawLegacyCptAnimal,
  tagIndex: Map<string, RawGoatOSAnimal[]>,
  aliases: TagAliasGroups,
  ambiguous: AmbiguousIdentityLink[],
  pending: MergeAttempt[],
): void {
  if (!RFID_RE.test(legacy.tag)) {
    return;
  }
  const matches = tagLookup(legacy.tag, tagIndex, aliases);
  const legacyNode = legacyNodeId(legacy.legacy_id);

  if (matches.length === 1) {
    const goat = matches[0]!;
    pending.push({
      a: legacyNode,
      b: goatosNodeId(goat.animal_id),
      key: `tag:${legacy.tag}`,
      evidence: [
        sourceEvidence({
          source: EVIDENCE_SOURCES.LEGACY_CPT_RECORDS,
          recordId: legacy.legacy_id,
          field: "tag",
          observedValue: legacy.tag,
        }),
        sourceEvidence({
          source: EVIDENCE_SOURCES.GOATOS_ANIMALS,
          recordId: goat.animal_id,
          field: goat.rfid_tag === legacy.tag ? "rfid_tag" : "prior_tags",
          observedValue: legacy.tag,
          note: "Unique tag match links legacy CPT to GoatOS",
        }),
      ],
    });
    return;
  }

  if (matches.length > 1) {
    ambiguous.push({
      reason: "Legacy CPT tag matches multiple GoatOS animals — merge skipped",
      recordIds: [legacy.legacy_id, ...matches.map((m) => m.animal_id)],
      sharedKey: `tag:${legacy.tag}`,
    });
  }
}

/** Pick canonical id: prefer GoatOS animal_id, else legacy CPT id. */
function chooseCanonicalId(
  goatosRecords: RawGoatOSAnimal[],
  legacyRecords: RawLegacyCptAnimal[],
): string {
  if (goatosRecords.length === 1) {
    return goatosRecords[0]!.animal_id;
  }
  if (goatosRecords.length === 0 && legacyRecords.length === 1) {
    return legacyRecords[0]!.legacy_id;
  }
  if (goatosRecords.length === 0 && legacyRecords.length > 0) {
    return legacyRecords[0]!.legacy_id;
  }
  return goatosRecords[0]!.animal_id;
}

/** Score identity confidence: high when GoatOS-backed or tag-linked; medium legacy-only. */
function assessConfidence(
  goatosRecords: RawGoatOSAnimal[],
  legacyRecords: RawLegacyCptAnimal[],
  linkedByTag: boolean,
): IdentityConfidence {
  if (goatosRecords.length === 1 && legacyRecords.length > 0 && linkedByTag) {
    return "high";
  }
  if (goatosRecords.length === 1 && legacyRecords.length === 0) {
    return "high";
  }
  if (goatosRecords.length === 0 && legacyRecords.length > 0) {
    return "medium";
  }
  return "low";
}

/** Assemble one CanonicalAnimal from a union-find cluster of GoatOS + legacy nodes. */
function buildCanonicalAnimal(
  nodeIds: string[],
  goatosById: Map<string, RawGoatOSAnimal>,
  legacyById: Map<string, RawLegacyCptAnimal>,
  clusterEvidence: ReturnType<typeof sourceEvidence>[],
  linkedByTag: boolean,
): CanonicalAnimal {
  const goatosRecords: RawGoatOSAnimal[] = [];
  const legacyRecords: RawLegacyCptAnimal[] = [];

  for (const nodeId of nodeIds) {
    const { kind, id } = parseNodeId(nodeId);
    if (kind === "goatos") {
      const rec = goatosById.get(id);
      if (rec) {
        goatosRecords.push(rec);
      }
    } else {
      const rec = legacyById.get(id);
      if (rec) {
        legacyRecords.push(rec);
      }
    }
  }

  const identityNotes: string[] = [];
  if (goatosRecords.length === 0 && legacyRecords.length > 0) {
    identityNotes.push(
      "Unmigrated CPT legacy record; no GoatOS match by RFID/prior tag",
    );
  }
  if (goatosRecords.length > 1) {
    identityNotes.push(
      "Cluster contains multiple GoatOS animal_ids — treated as unresolved; review required",
    );
  }

  const rfidTags = new Set<string>();
  const farmNumbers = new Set<string>();
  for (const g of goatosRecords) {
    rfidTags.add(g.rfid_tag);
    for (const t of g.prior_tags) {
      rfidTags.add(t);
    }
    farmNumbers.add(g.farm_number.toUpperCase());
  }
  for (const l of legacyRecords) {
    rfidTags.add(l.tag);
  }

  const primaryGoatos = goatosRecords.length === 1 ? goatosRecords[0]! : null;

  return {
    canonicalId: chooseCanonicalId(goatosRecords, legacyRecords),
    identityConfidence: assessConfidence(goatosRecords, legacyRecords, linkedByTag),
    sourceAnimalIds: goatosRecords.map((g) => g.animal_id),
    rfidTags: [...rfidTags],
    farmNumbers: [...farmNumbers],
    legacyIds: legacyRecords.map((l) => l.legacy_id),
    goatosRecord: primaryGoatos,
    legacySnapshots: legacyRecords.map(legacyToSnapshot),
    identityNotes,
    linkEvidence: clusterEvidence,
  };
}

/** Full identity pass: union-find merge by unique RFID tag, build registry (~200 goats). */
export function resolveIdentitiesFromContext(ctx: EngineContext): IdentityResolutionResult {
  const { animals, legacyCpt, fieldReports } = ctx.data;
  const aliases = buildTagAliasGroups(fieldReports);
  const tagIndex = goatosByTag(animals, aliases);
  const uf = new UnionFind();
  const ambiguousLinks: AmbiguousIdentityLink[] = [];
  const pendingMerges: MergeAttempt[] = [];

  const goatosById = new Map(animals.map((a) => [a.animal_id, a]));
  const legacyById = new Map(legacyCpt.map((l) => [l.legacy_id, l]));

  for (const animal of animals) {
    uf.add(goatosNodeId(animal.animal_id));
  }
  for (const legacy of legacyCpt) {
    uf.add(legacyNodeId(legacy.legacy_id));
    tryTagMerge(legacy, tagIndex, aliases, ambiguousLinks, pendingMerges);
  }

  const clusterEvidence = new Map<string, ReturnType<typeof sourceEvidence>[]>();
  const clusterLinkedByTag = new Set<string>();

  for (const merge of pendingMerges) {
    uf.union(merge.a, merge.b);
    const root = uf.find(merge.a);
    const existing = clusterEvidence.get(root) ?? [];
    clusterEvidence.set(root, [...existing, ...merge.evidence]);
    clusterLinkedByTag.add(root);
  }

  const groups = uf.groups();
  const canonicalAnimals: CanonicalAnimal[] = [];

  for (const nodeIds of groups.values()) {
    const roots = new Set(nodeIds.map((n) => uf.find(n)));
    const root = [...roots][0]!;
    const evidence = clusterEvidence.get(root) ?? [];
    const linkedByTag = clusterLinkedByTag.has(root);
    canonicalAnimals.push(
      buildCanonicalAnimal(nodeIds, goatosById, legacyById, evidence, linkedByTag),
    );
  }

  canonicalAnimals.sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));

  return {
    registry: new CanonicalRegistry(canonicalAnimals, ambiguousLinks),
    ambiguousLinks,
  };
}

let cachedResult: IdentityResolutionResult | undefined;

/** Public entry: resolve identities; caches result for the process lifetime. */
export function resolveIdentities(ctx?: EngineContext): IdentityResolutionResult {
  if (!ctx && cachedResult) {
    return cachedResult;
  }
  const context = ctx ?? loadEngineContext();
  const result = resolveIdentitiesFromContext(context);
  if (!ctx) {
    cachedResult = result;
  }
  return result;
}

/** Clear cached identity result (for tests or data reload). */
export function resetIdentityCache(): void {
  cachedResult = undefined;
}
