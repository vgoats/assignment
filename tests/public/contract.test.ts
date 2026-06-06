/**
 * PUBLIC TESTS.
 *
 * Two kinds:
 *  - SMOKE (already green): the environment, config, and data load correctly.
 *    If these fail, your repo is broken before any logic runs.
 *  - TARGET (currently red): non-negotiable behaviours from the brief. Make them
 *    pass. They check the *interface and the invariant*, not the full solution —
 *    most business-correctness checks are hidden and run during review.
 */
import { describe, it, expect } from "vitest";
import { loadSimulationConfig, loadFestivalRules } from "../../src/config.js";
import { loadAll } from "../../src/data/loader.js";
import { bookAnimal, listAvailableAnimals } from "../../src/engine/index.js";

describe("smoke: environment loads", () => {
  it("simulation config has now + deliveryDate", () => {
    const c = loadSimulationConfig();
    expect(c.deliveryDate).toBe("2026-06-06");
    expect(Date.parse(c.now)).not.toBeNaN();
  });

  it("festival rules expose the constants the engine needs", () => {
    const r = loadFestivalRules();
    expect(r.minWeightKg).toBeGreaterThan(0);
    expect(r.minAgeDays).toBeGreaterThan(0);
    expect(["inclusive", "exclusive"]).toContain(r.withdrawalBoundary);
  });

  it("every source file parses and is non-empty", () => {
    const d = loadAll();
    expect(d.animals.length).toBeGreaterThan(100);
    expect(d.telemetry.length).toBeGreaterThan(1000);
    expect(d.bookings.length).toBeGreaterThan(20);
    expect(d.legacyCpt.length).toBeGreaterThan(0);
    expect(d.fieldReports.length).toBeGreaterThan(0);
  });
});

describe("target: availability contract", () => {
  it("listAvailableAnimals returns goats carrying an eligibility verdict with evidence", () => {
    const animals = listAvailableAnimals();
    expect(Array.isArray(animals)).toBe(true);
    for (const a of animals) {
      expect(a.eligibility).toBeDefined();
      expect(a.eligibility.asOfDate).toBeTruthy();
      expect(Array.isArray(a.eligibility.evidence)).toBe(true);
      // a goat shown as available must be eligible
      expect(a.eligibility.status).toBe("eligible");
    }
  });
});

describe("target: booking invariant under concurrency", () => {
  it("two simultaneous bookings for the same goat cannot both succeed", async () => {
    const animals = listAvailableAnimals();
    expect(animals.length).toBeGreaterThan(0);
    const id = animals[0]!.canonicalId;
    const c1 = { name: "Race A", phone: "9000000001" };
    const c2 = { name: "Race B", phone: "9000000002" };
    const [r1, r2] = await Promise.all([
      bookAnimal(id, c1),
      bookAnimal(id, c2),
    ]);
    const successes = [r1, r2].filter((r) => r.ok).length;
    expect(successes).toBe(1);
  });
});
