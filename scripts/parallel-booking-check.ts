/**
 * Race two bookings for the same goat in parallel. Exactly one must succeed.
 *
 * Engine (no server needed):
 *   npx tsx scripts/parallel-booking-check.ts
 *
 * HTTP (dev server must be running on :4000):
 *   npx tsx scripts/parallel-booking-check.ts --http
 */
import { bookAnimal, listAvailableAnimals } from "../src/engine/index.js";
import { resetRuntimeBookings } from "../src/engine/booking/store.js";

const useHttp = process.argv.includes("--http");
const baseUrl =
  process.argv.find((arg) => arg.startsWith("--url="))?.slice(6) ??
  "http://localhost:4000";

const customerA = { name: "Customer A", phone: "9000000001" };
const customerB = { name: "Customer B", phone: "9000000002" };

async function runEngineRace(canonicalId: string) {
  resetRuntimeBookings();
  return Promise.all([
    bookAnimal(canonicalId, customerA),
    bookAnimal(canonicalId, customerB),
  ]);
}

async function postBook(canonicalId: string, customer: { name: string; phone: string }) {
  const res = await fetch(`${baseUrl}/api/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ canonicalAnimalId: canonicalId, customer }),
  });
  const data = (await res.json()) as { ok: boolean; bookingId?: string; reason?: string };
  return { httpStatus: res.status, ...data };
}

async function runHttpRace(canonicalId: string) {
  return Promise.all([
    postBook(canonicalId, customerA),
    postBook(canonicalId, customerB),
  ]);
}

async function main() {
  const animals = listAvailableAnimals();
  if (animals.length === 0) {
    console.error("No available goats to book.");
    process.exit(1);
  }

  const canonicalId = animals[0]!.canonicalId;
  console.log(`Goat: ${canonicalId}`);
  console.log(`Mode: ${useHttp ? `HTTP → ${baseUrl}/api/book` : "engine (in-process)"}`);
  console.log("Firing two parallel bookings…\n");

  const [r1, r2] = useHttp
    ? await runHttpRace(canonicalId)
    : await runEngineRace(canonicalId);

  console.log("Booking A:", r1);
  console.log("Booking B:", r2);

  const successes = [r1, r2].filter((r) => r.ok).length;
  console.log(`\nSuccesses: ${successes} (invariant expects exactly 1)`);

  if (successes === 1) {
    console.log("PASS — concurrent booking invariant held.");
    process.exit(0);
  }

  console.error("FAIL — both succeeded or both failed.");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
