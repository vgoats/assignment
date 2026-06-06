/**
 * Minimal API + static server for the demo surface.
 *
 * The routes wire the engine to the UI. They return 501 until you implement the
 * corresponding engine functions. Keep the surface presentable, not polished.
 * You may replace this server, add routes, or swap the front-end — just keep one
 * command (`npm run dev`) bringing up something we can click through.
 */
import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSimulationConfig, loadFestivalRules } from "../config.js";
import {
  listAvailableAnimals, reconcileBookings, computeEligibility, priceAnimal, bookAnimal,
} from "../engine/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(HERE, "..", "..", "public")));

const notImplemented = (res: express.Response, e: unknown) =>
  res.status(501).json({ error: e instanceof Error ? e.message : "Not implemented" });

app.get("/api/config", (_req, res) => {
  res.json({ simulation: loadSimulationConfig(), rules: loadFestivalRules() });
});

app.get("/api/inventory", (_req, res) => {
  try { res.json(listAvailableAnimals()); } catch (e) { notImplemented(res, e); }
});

app.get("/api/discrepancies", (_req, res) => {
  try { res.json(reconcileBookings()); } catch (e) { notImplemented(res, e); }
});

app.get("/api/animals/:id", (_req, res) => {
  try {
    res.json({
      eligibility: computeEligibility(_req.params.id),
      price: priceAnimal(_req.params.id),
    });
  } catch (e) { notImplemented(res, e); }
});

app.post("/api/book", async (req, res) => {
  try {
    const { canonicalAnimalId, customer } = req.body ?? {};
    res.json(await bookAnimal(canonicalAnimalId, customer));
  } catch (e) { notImplemented(res, e); }
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Operation Promise Keeper — demo on http://localhost:${PORT}`);
});
