/**
 * Engine context — loads config and raw data once for downstream modules.
 * No business logic; no derived state.
 */
import { loadFestivalRules, loadSimulationConfig } from "../config.js";
import { loadAll } from "../data/loader.js";
import type { EngineContext } from "./types.js";

let cached: EngineContext | undefined;

/** Load (or return cached) simulation config, rules, and raw source data. */
export function loadEngineContext(options?: { refresh?: boolean }): EngineContext {
  if (!options?.refresh && cached) {
    return cached;
  }
  cached = {
    simulation: loadSimulationConfig(),
    rules: loadFestivalRules(),
    data: loadAll(),
  };
  return cached;
}

/** Clear cached context — useful for tests that reload fixtures. */
export function resetEngineContextCache(): void {
  cached = undefined;
}
