/**
 * Minimal API + static server for the demo surface.
 */
import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSimulationConfig, loadFestivalRules } from "../config.js";
import {
  queryAvailableInventoryPage,
  reconcileBookings,
  computeEligibility,
  priceAnimal,
  bookAnimal,
  listBookings,
  getAnimalHistory,
  resolveIdentities,
  applyReplacement,
  getReplacementOffers,
  traceFeedExposure,
} from "../engine/index.js";
import { loadEngineContext } from "../engine/context.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(HERE, "..", "..", "public")));

function animalExists(id: string): boolean {
  const { registry } = resolveIdentities(loadEngineContext());
  return registry.getByCanonicalId(id) !== undefined;
}

app.get("/api/config", (_req, res) => {
  res.json({ simulation: loadSimulationConfig(), rules: loadFestivalRules() });
});

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseOptionalInt(value: unknown, fallback: number): number {
  const n = parseOptionalNumber(value);
  if (n === undefined) {
    return fallback;
  }
  return Math.max(1, Math.floor(n));
}

app.get("/api/inventory", (req, res) => {
  const breed = typeof req.query.breed === "string" ? req.query.breed : undefined;
  const priceMin = parseOptionalNumber(req.query.priceMin);
  const priceMax = parseOptionalNumber(req.query.priceMax);
  const page = parseOptionalInt(req.query.page, 1);
  const limit = parseOptionalInt(req.query.limit, 15);

  res.json(
    queryAvailableInventoryPage({
      breed,
      priceMin,
      priceMax,
      page,
      limit,
    }),
  );
});

app.get("/api/discrepancies/replacement-offers", (_req, res) => {
  res.json(getReplacementOffers());
});

app.get("/api/feed-exposure", (_req, res) => {
  res.json(traceFeedExposure());
});

app.get("/api/discrepancies", (_req, res) => {
  res.json(reconcileBookings());
});

app.get("/api/bookings", (_req, res) => {
  res.json(listBookings());
});

app.get("/api/animals/:id/history", (req, res) => {
  const id = req.params.id;
  const history = getAnimalHistory(id);
  if (!history) {
    res.status(404).json({ error: `Unknown canonical animal "${id}"` });
    return;
  }
  res.json(history);
});

app.get("/api/animals/:id", (req, res) => {
  const id = req.params.id;
  if (!animalExists(id)) {
    res.status(404).json({ error: `Unknown canonical animal "${id}"` });
    return;
  }
  let price = null;
  try {
    price = priceAnimal(id);
  } catch {
    price = null;
  }
  res.json({
    eligibility: computeEligibility(id),
    price,
  });
});

app.post("/api/replacements", async (req, res) => {
  const { issueId } = req.body ?? {};
  if (!issueId || typeof issueId !== "string") {
    res.status(400).json({ ok: false, reason: "issueId is required" });
    return;
  }
  const result = await applyReplacement(issueId);
  res.status(result.ok ? 200 : 409).json(result);
});

app.post("/api/book", async (req, res) => {
  const { canonicalAnimalId, customer } = req.body ?? {};
  if (!canonicalAnimalId || !customer?.name || !customer?.phone) {
    res.status(400).json({
      ok: false,
      reason: "canonicalAnimalId and customer { name, phone } are required",
    });
    return;
  }
  const result = await bookAnimal(canonicalAnimalId, customer);
  res.status(result.ok ? 200 : 409).json(result);
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Operation Promise Keeper — demo on http://localhost:${PORT}`);
});
