import type { AvailableAnimal } from "../../types.js";
import { loadEngineContext } from "../context.js";
import { formatBreedLabel, normalizeBreed } from "../pricing/lookup.js";
import { listAvailableAnimalsFromContext } from "./listAvailable.js";
import type { EngineContext } from "../types.js";

export interface InventoryQuery {
  breed?: string;
  priceMin?: number;
  priceMax?: number;
  page?: number;
  limit?: number;
}

export interface InventoryPageResult {
  items: AvailableAnimal[];
  total: number;
  page: number;
  limit: number;
  breeds: string[];
}

const DEFAULT_LIMIT = 15;

function uniqueBreeds(animals: AvailableAnimal[]): string[] {
  const seen = new Set<string>();
  const breeds: string[] = [];
  for (const animal of animals) {
    if (!animal.breed || animal.breed === "unknown") {
      continue;
    }
    const norm = normalizeBreed(animal.breed);
    if (seen.has(norm)) {
      continue;
    }
    seen.add(norm);
    breeds.push(formatBreedLabel(animal.breed));
  }
  return breeds.sort((a, b) => a.localeCompare(b));
}

function matchesBreed(animal: AvailableAnimal, breedFilter: string): boolean {
  return normalizeBreed(animal.breed) === normalizeBreed(breedFilter);
}

export function queryAvailableInventory(
  ctx: EngineContext,
  query: InventoryQuery = {},
): InventoryPageResult {
  const all = listAvailableAnimalsFromContext(ctx);
  const breeds = uniqueBreeds(all);

  let filtered = all;
  if (query.breed?.trim()) {
    filtered = filtered.filter((a) => matchesBreed(a, query.breed!));
  }
  if (query.priceMin !== undefined) {
    filtered = filtered.filter(
      (a) => a.price !== null && a.price.amountInr >= query.priceMin!,
    );
  }
  if (query.priceMax !== undefined) {
    filtered = filtered.filter(
      (a) => a.price !== null && a.price.amountInr <= query.priceMax!,
    );
  }

  const limit = Math.max(1, Math.min(query.limit ?? DEFAULT_LIMIT, 100));
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit) || 1);
  const page = Math.max(1, Math.min(query.page ?? 1, totalPages));
  const start = (page - 1) * limit;

  return {
    items: filtered.slice(start, start + limit),
    total: filtered.length,
    page,
    limit,
    breeds,
  };
}

export function queryAvailableInventoryPage(
  query: InventoryQuery = {},
): InventoryPageResult {
  return queryAvailableInventory(loadEngineContext(), query);
}
