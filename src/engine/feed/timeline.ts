/**
 * Reconstruct goat shed location from movement history (not current_shed).
 */
import type { RawMovement } from "../../types.js";
import type { CanonicalRegistry } from "../registry.js";
import { resolveOfferingRef } from "../reconcile/resolveRef.js";
import { isOnOrBefore, toCalendarDate } from "../time.js";
import type { CalendarDate } from "../types.js";

export interface ShedLocation {
  farm: string;
  shed: string;
  movementEventId: string;
}

export function buildMovementIndex(
  movements: RawMovement[],
  registry: CanonicalRegistry,
): Map<string, RawMovement[]> {
  const index = new Map<string, RawMovement[]>();
  for (const movement of movements) {
    const resolved = resolveOfferingRef(registry, movement.animal_ref);
    if (!resolved.animal) {
      continue;
    }
    const id = resolved.animal.canonicalId;
    const list = index.get(id) ?? [];
    list.push(movement);
    index.set(id, list);
  }
  for (const list of index.values()) {
    list.sort((a, b) => a.moved_at.localeCompare(b.moved_at));
  }
  return index;
}

/** Goat location on calendar date D = last movement on/before D (to_farm + to_shed). */
export function locationAtDate(
  movements: RawMovement[],
  date: CalendarDate,
): ShedLocation | null {
  let location: ShedLocation | null = null;
  for (const movement of movements) {
    if (!isOnOrBefore(toCalendarDate(movement.moved_at), date)) {
      break;
    }
    if (movement.to_farm && movement.to_shed) {
      location = {
        farm: movement.to_farm,
        shed: movement.to_shed,
        movementEventId: movement.movement_event_id,
      };
    }
  }
  return location;
}
