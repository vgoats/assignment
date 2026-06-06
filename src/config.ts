/**
 * Loads the simulation clock and festival rules.
 * RULE: never read the machine clock in the engine. Reason from `now` here.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

export interface SimulationConfig {
  festivalId: string;
  now: string;          // ISO datetime — treat as "current moment"
  deliveryDate: string; // ISO date — the festival; immovable
  timezone: string;
}

export interface FestivalRules {
  festivalId: string;
  minAgeDays: number;
  minWeightKg: number;
  disallowedStatuses: string[];
  quarantineDisqualifies: boolean;
  requiresResolvedIdentity: boolean;
  minIdentityConfidenceForSale: string;
  requiresTrustedWeight: boolean;
  withdrawalBlocksDelivery: boolean;
  withdrawalBoundary: "inclusive" | "exclusive";
  disqualifyingConditions: string[];
}

export const loadSimulationConfig = (): SimulationConfig =>
  JSON.parse(readFileSync(join(ROOT, "simulation_config.json"), "utf-8"));

export const loadFestivalRules = (): FestivalRules =>
  JSON.parse(readFileSync(join(ROOT, "festival_rules.json"), "utf-8"));
