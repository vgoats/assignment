# AI Usage

Used Cursor (Claude) basically the whole time for this take-home. Not gonna pretend I typed every line by hand, that would be lying. But I did make the calls on what to build first, what to skip, and I ran the tests / clicked through the demo until I actually understood every parts.

---

## Tools used

- **Cursor** — main thing. Chat + inline edits on the repo.
- **Claude** (through Cursor) — architecture questions, reading README, explaining data files, writing boilerplate in `src/engine/`.

---

## What I used AI for

**Most leverage:**

- Getting oriented on the assignment fast — what "offering" means CPT legacy xml vs GoatOS, etc.
- Scaffolding engine modules — identity union-find, eligibility checks, telemetry spike filtering, reconcile loops, feed exposure trace.
- Wiring the Express API + demo UI to engine functions.
- Writing docs (`ASSUMPTIONS.md`, `ARCHITECTURE.txt`, triage note) in a structure that matches the templates.

**Medium leverage:**

- CSV/XML loader was already there so I didn't touch that much.
- Some regex for field report deaths — AI suggested the pattern, I kept it minimal on purpose.
- Sorting / evidence helper stuff — boring code, fine for AI.

**Low / didn't really use AI for:**

- Deciding priority order (identity → eligibility → reconcile → safe booking). That came from README + triage thinking.
- Whether to merge on farm_number — README basically warns you; I didn't let AI talk me into merging on it.

---

## What I deliberately did myself

- **Triage / what to cut in 48 hours** — AI will happily build you 12 features. I had to decide reconciliation + booking lock mattered more than full field report NLP.
- **Reading the actual data** — spot checking goats like `G-CPT-0097`, double-book on `G-CBE-0053`, contaminated feed rows in `feed_shed_log.csv`. AI can miss planted bugs if you don't look.
- **Concurrency invariant** — I made sure I could explain `withGoatLock` and why check-then-commit has to be inside the lock. Didn't just trust "it passes tests."
- **Assumptions that affect customers** — withdrawal inclusive boundary, delivery day vs today for eligibility vs price, earliest booking keeps original goat on double-book. Wrote those in ASSUMPTIONS even when AI suggested shortcuts.
- **Double-book replacement policy** — talked through with AI whether to give substitute to first or second customer; kept earliest-keeps-original because that's what README/triage says. Didn't change code just because the UX felt weird.

---

## How I verified AI-generated code

- `npm run check` — typecheck + tests. The concurrent booking test was non-negotiable; if that fails the whole submission is kind of pointless.
- `npm run dev` — clicked inventory, discrepancies, book form, replacement button. If the UI can't show evidence I consider it broken even if tests pass.
- **Cross-checking counts** — e.g. ~132 available, ~36 reconcile issues, 6 feed exposure, 15 replacement offers. Ran small scripts / looked at output so numbers weren't made up.
- **Trace one row end-to-end** — pick a discrepancy, follow evidence to `health_event_id` / `telemetry_id` / booking row. AI loves plausible fake explanations; source record ids don't lie.
- **Eligibility** — manually checked a withdrawal case (treatment date + days vs June 6). Easy to off-by-one dates.
- **Pricing** — checked that 94kg-style readings get dropped and median weight isn't stupid for a goat I clicked in the UI.
- **Feed trace** — confirmed it uses movements not `current_shed` (founder brief is explicit about this).

If AI wrote it and I couldn't explain it in an interview, I either fixed it or cut it.

---

## AI mistakes I caught

1. **Treating `exchange_listings.csv` like inventory** — early confusion (mine + AI explanations). Listings are stale v1 export; available goats come from engine rules. Important for not building the wrong product.

2. **Farm number merges** — AI-style "helpful" identity resolution might merge on `CBE-150` style refs. Data has duplicates; README says don't. Kept merge on unique RFID/tag only.

3. **Eligibility vs inventory weight** — easy to put minWeightKg in eligibility module. Split it on purpose: eligibility = delivery day fitness; inventory/book = trusted weight today.

4. **Double-book remediation** — almost overthought giving the one substitute goat to the first customer. Code/docs say secondary gets substitute, primary keeps original. Changing that would contradict assumptions without updating them.

5. **Field reports** — AI wanted to "parse everything." Scope cut to death regex only; full WhatsApp NLP is high risk for false positives. Documented as manual / needs review.

6. **Comments** — AI added a bunch of function-top comments in reconcile; removed them later because the code should read clean without essay comments on every helper.

---

## Where I'd trust AI in production here — vs human review

**OK for AI (with normal code review):**

- Boilerplate loaders, API wiring, UI formatting
- Drafting architecture/assumptions docs
- Generating test fixtures or extra unit tests
- Exploring "how many goats fail gate X" type analysis

**Human must review / sign off:**

- Any **customer-facing promise** — book, replace, show as available
- **Identity merges** — wrong merge = wrong goat to wrong person
- **Eligibility on delivery day** — especially withdrawal math and quarantine clearing
- **Pricing** — which weigh-ins count; money on the line
- **Field report ingestion** — multilingual, easy to hallucinate events
- **Substitute choice** when pool is tight — who gets the goat when two bookings conflict
- **Feed exposure clearance** — health/safety, not just a flag

**Would NOT let AI run autonomously:**

- Auto-cancel bookings
- Auto-merge canonical goats
- Auto-apply replacement without ops clicking confirm
- Silent fixes to Vivek's sheet on startup

---

Bottom line: AI got me to a working Promise Keeper way faster than solo. The part I'm staking the submission on is judgment  what I shipped, what I left visible as broken, and that the booking lock + evidence trail are real. I'd rather explain a known gap in triage than ship something AI said was fine that I never tested.
