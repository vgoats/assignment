# Operation Promise Keeper
## Repair the Truth Layer Behind Mesha's Live Festival Goat Offerings

> A take-home build for a Mesha engineer. Everything you need is in this document, the data in `/data`, the config files in the repo root, and a partially-built TypeScript scaffold. Read it all before you start — **especially the founder's brief in Section 2, which is messy on purpose.**

---

## TL;DR

Mesha is ten days from festival fulfillment. Customers have paid for **festival goat offerings**: specific living goats that are supposed to be identified, reared, verified, and handed over on the morning of the festival. The inherited offering ledger, booking sheet, GoatOS, the health ledger, the GoatSense telemetry, and the old farm's records do not agree with each other.

**Your job:** build **Promise Keeper** — the system that decides which customer promises can safely be *shown, priced, booked, assigned, and fulfilled* with a real goat for the festival — and that can **prove every decision with source evidence.**

This is deliberately larger than 48 hours. We are not testing whether you finish everything. We are testing what you build, what you choose not to build, and whether the parts you ship are correct enough to stake the company's word on. Your prioritization is part of what we grade — and you will write it down (see the Triage Note).

---

## Contents

1. The Assignment — situation, mission, the crisis surface, the rules, evaluation, getting started
2. The Founder's Brief — read carefully, contradictions and all
3. Data Manifest — the source files and config
4. Deliverable Docs — Triage Note, Assumptions, Architecture, AI-Usage

---

# SECTION 1 · THE ASSIGNMENT

## The Situation

Mesha sells **goat offerings**. Not pictures of goats, not generic livestock capacity, not a future claim on a herd — specific living goats that are born or procured, reared, weighed, treated, tracked, and one day fulfilled for a real person who is counting on that promise.

For the upcoming festival we launched something we have never done before at this scale: **a customer reserves a festival goat offering in advance, follows the goat on the farm, and receives the promised eligible goat on the morning of the festival.** Some customers selected a specific goat. Some were sold an offering from an available pool and the system assigned a goat behind the scenes. Either way, each customer promise must resolve to one real, eligible goat.

The product is already live. Customers have paid. Goats have been assigned. Proof screens have been shown. And last night someone noticed the numbers don't add up.

The offering ledger says we've promised goats we don't appear to physically have. A few goats look like they've been promised twice. At least one already-promised goat does not actually meet the festival's eligibility rules — which, if it reaches a customer, is not a refund problem; it is a breach of the most important promise we make. The person who maintained the first booking sheet by hand left three weeks ago and took the context with him.

The founder's working theory is that the first version of the offering system **counted goats as if every animal were generic, interchangeable capacity** — the way you'd count sacks of feed — when in fact each customer promise must resolve to *one specific eligible goat*. A shed of eighty goats is not eighty safe offerings if some are already promised, some are under medication, some can't be reliably identified, and some are dead in a system that never got the update. Whether that theory is right, and exactly where it bites, is for you to find out.

**Fulfillment day is fixed.** It is the festival. It does not move because our data is messy. You have until then to make the system correct, safe, and defensible — and you have 48 hours to build the part that proves you can.

## The Hard Truth You're Building Against

Everything a customer sees is a **promise about a future physical state**: *this specific goat will be alive, sound, eligible, and at the promised weight on fulfillment morning.* Underneath that promise is a farm — GoatOS records, GoatSense telemetry, a vet ledger, procurement batches — and the farm is a living system that does not always agree with itself. Goats die. Tags fail. Scales lie. Two systems disagree about whether a goat even exists.

Your work lives at the boundary between that messy physical truth and the clean, customer-facing promise layer on top of it. **A beautiful offering product built on numbers it can't defend is not a product — it's a liability.** We are hiring the person who can build the layer that *refuses to make a promise it can't back with evidence.*

## What "Offering" Means Here

To be unambiguous: in this assignment an **offering** is a customer promise that must be fulfilled by a real eligible goat. The data still contains legacy names like `festival_bookings.csv` and `exchange_listings.csv` because the first version of the product was stitched together from booking sheets and listing exports. Do not over-interpret the word "exchange": this is **not** a stock-market-style order book, bid/ask matching engine, wallet system, or trading venue. There is exactly one of each goat; a promise is either safely backed by that goat or it is not.

And on the interface itself: **it only needs to be presentable, not polished.** A clear, functional surface that lets us see Promise Keeper working — and lets us click into any number and see where it came from — is the goal. Do not spend your hours on visual design. Spend them on the logic underneath, which is the hard part and the reason this role exists.

## The Surface Area of the Crisis

Below is the full surface of what is going wrong. It is intentionally broader than 48 hours. **Do not treat this as a checklist.** Treat it as the founder's operating picture. Your job is to decide which promises must be made safe first, what can remain manual but visible, and what should be explicitly left for the next engineer — and to record those decisions in your Triage Note.

*The numbering below is for readability, not priority order. Deciding the priority order — and defending it in your Triage Note — is part of what we're evaluating.*

1. **The unified truth layer.** The same *physical goat* shows up under different IDs, tags, and hand-written names across systems. Resolve each into a single canonical record. Where you cannot confidently resolve an identity, say so — do not silently merge. A wrong merge is worse than an unresolved record.

2. **Eligibility — for the festival, not for today.** Determine which goats are actually fit to fulfill an offering on delivery day. The fitness rules are in `festival_rules.json` (you are not expected to know livestock or religious requirements). What is *not* given is how to reason about a goat whose state changes between now and delivery day. That reasoning is the job.

3. **Offering reconciliation.** Produce a discrepancy report against reality: customer promises that don't resolve to a live goat, goats promised more than once, promises backed by goats that are dead / sold / ineligible / under-weight, listings that shouldn't exist, prices built on bad data. Rank them by company risk and name the customer affected.

4. **Safe promise creation.** A booking/assignment flow that cannot promise the same goat twice — a guarantee that holds at the data layer, not by hiding a button in the UI, and that holds when two buyers reach for the same goat at the same instant. Promised means gone; available means genuinely available.

5. **Trusted-weight pricing.** Value goats from their real current weight (cleaned of sensor noise) times the rate effective on the valuation date, with breed premium and festival surge. A bad scale reading must never reach a price. Show the evidence.

6. **Traceability.** Every eligibility verdict, price, and offering state drillable back to the exact source records, the records you ignored, and the assumptions you applied. This is the reason the role exists, not decoration.

7. **Fulfillment-risk remediation.** Some promised goats won't make delivery — died, fell short of promised weight, drifted ineligible. Detect them early and, where you can, resolve them (ideally a valid substitute goat under the same constraints); surface the rest to ops. The worst outcome is silence on delivery morning.

8. **The wrinkles the founder will mention** — a contaminated-feed recall that must be traced through where goats physically were over time, and a pile of unstructured field messages that may contain events the structured systems never recorded. Real, and where the surface exceeds the clock. Choose deliberately.

A minimal demo surface should, at least, let us: see the eligible goats; see the offering discrepancies; open a goat and inspect its history, growth, and lineage; trigger a promise/booking that cannot double-assign; and click any verdict or price to see the evidence behind it.

## The Clock and the Rules (read these files)

- **`simulation_config.json`** fixes the simulation clock: `now` and the immovable `deliveryDate`, with timezone. **Reason from these values — never from the machine clock** — so your results are reproducible and your tests deterministic.
- **`festival_rules.json`** encodes the festival's fitness rules. **No religious or livestock expertise is expected of you — the rules are provided.** Your job is to model and enforce them correctly, with evidence, and to handle the cases where the data makes a rule genuinely hard to evaluate.

## Clarifications

You may make reasonable assumptions without asking us. Document them in your Assumptions Log. We are deliberately testing whether you can keep moving under ambiguity.

Ask only if the repo genuinely cannot run, a file appears missing or corrupt, or the assignment is literally impossible to start. For product or data ambiguity — what to count, how to resolve a tie, which weight to trust — make a call, record it, and move. Pausing to ask us about every ambiguity is itself a signal, and not the one you want to send.

## Defaults You Can Assume

To keep you out of pointless rabbit holes. These are defaults, not constraints — use a different approach if you prefer, just document it in your Assumptions Log. None of these is the hard part of the assignment.

- **Pricing.** Unless you document otherwise, price multiplicatively: `price = trustedWeightKg × muttonRateInrPerKg × (1 + breedPremiumPct/100) × (1 + festivalSurgePct/100)`. The exact arithmetic is not what we're testing; defending *which weight and which rate* you fed it is.
- **Valuation date.** For a goat shown/priced *now*, use `simulation_config.now` as the valuation date. For an offering-discrepancy check, compare the quoted price against the rate effective on that booking's `booked_on` date. Document any other choice.
- **Trusted weight.** You do **not** need to forecast delivery-day weight. Define and document your trusted-*current*-weight model (how you pick a believable weight out of noisy telemetry, and what you do when you can't). If you use current trusted weight for the minimum-weight rule, say so. If a goat is under its *promised* booking weight today but could plausibly grow by delivery, surface that as a fulfillment risk rather than silently passing or failing it.

## What Not To Build

Do not spend time on authentication, payment-gateway integration, wallets, stock-market-style order books, mobile-app polish, production deployment, or real notification infrastructure. The demo UI does not need visual polish.

Everything else in the brief is fair game. Decide what matters most.

## What We're Evaluating

This is **not** a speed test, and it is **not** a data-cleaning test. We care about:

1. **Judgment at the boundary** — where does messy physical reality stop and a binding promise begin, and how did you decide?
2. **Correctness you can defend** — invariants that hold under concurrency and failure, not a happy path that demos well and breaks quietly.
3. **What you discovered** — the data lies in specific ways. Finding the lies, and deciding which are material, is the job.
4. **Domain reasoning** — you don't need prior livestock knowledge (the rules are in config), but you do need to actually model the system you're given rather than pattern-matching it to a generic store.
5. **Prioritization under pressure** — what you chose to build, what you cut, and whether your reasoning holds up (this is the Triage Note).
6. **Communication** — if we can't trust your output, and can't trace it, it doesn't exist.

## On AI Tools

Use anything — Claude, Claude Code, Copilot, Cursor, whatever you reach for. We are AI-native and we expect you to be too. We are not testing whether you typed every character. We are testing your judgment: what you ask the tools to build, how you integrate it, and what you catch that the tools won't catch unprompted.

**You will walk us through your code and decisions live.** Understand everything you submit, especially the parts an AI wrote. "The model generated it" is not an answer to "why does this hold under a race condition?"

## Time Expectation and Prioritization

48 hours. This is deliberately more than can be finished perfectly.

We are not grading how many bullets you touched. We are grading whether the slice you chose materially reduces the highest-risk customer promise failures, whether the invariants you claim actually hold, and whether the remaining risk is *visible* instead of hidden. A strong submission is coherent and defensible. A weak submission is broad but shallow.

## Getting Started

```bash
npm install
npm run dev            # serves the demo + API on http://localhost:4000
npm run check:starter  # typecheck + smoke tests — passes on the untouched scaffold
npm test               # full public tests: smoke pass; two target tests are red until you build them
npm run check          # typecheck + full tests — aim for green before you submit
```

The scaffold gives you: strict TypeScript, working data loaders for every source file (`src/data/loader.ts`), config loaders (`src/config.ts`), the output-contract types (`src/types.ts`), engine stubs to implement (`src/engine/`), a minimal API + demo shell (`src/server/`, `public/`), and public tests (`tests/`). Build inside it or restructure — just keep one command bringing up something we can click through.

**If we cannot run your submission with the documented command, we cannot evaluate the parts that don't run.** A brilliant architecture doc does not compensate for a repo that won't start.

## Submission

Push to this repo. `npm install && npm run dev` must start the demo and API. Include your completed docs in `/docs`.

---

# SECTION 2 · THE FOUNDER'S BRIEF

*Written at 1am. I've been on the farm since 5. Forgive the mess — I'm dictating half of this.*

## What's going on

We've never sold goat offerings this way before and I think we got ahead of our systems. The idea was beautiful: a customer reserves a real goat now, watches it grow on the farm through the app, and receives that goat on the morning of the festival. People love it. Offerings are ahead of plan. That's the problem.

Vivek ran the first offering sheet by hand before he left. I trusted it. Last night Manju was cross-checking against GoatOS and the live count on the farm and nothing lined up. We have promises against goats that I can't find on the farm. I think — I'm not sure — that a couple of goats got promised to two different customers. And the thing that's keeping me up: I'm worried at least one goat we've already promised to someone isn't actually fit for the festival.

I keep coming back to one nagging thought: I think the first cut of this just counted how many goats were in a shed and called that "how many offerings we can sell." But people aren't buying *a* goat, they're buying *that* goat — and some of those goats are spoken for, or on medication, or honestly I'm not even sure we've got them identified right. A number on a shed board is not a promise we can keep.

I need you to make this right. The festival is the festival — it's on the 6th, it does not move. I need a system that gives me numbers I can stand behind, catches the problems before a customer does, and that we can re-run every festival without holding my breath.

I'm not an engineer. Some of what I write below is going to be contradictory or vague. When that happens, make a call, write down what you assumed and why, and move on. I'd rather you decide and tell me than wait for me.

## 1. Tell me what we can actually offer

First thing: how many goats can we *actually* fulfill for the festival? Not what's on Vivek's sheet — what's real, alive, on the farm, and fit. Show me the clean inventory, and the gap between that and what we've already promised, because if we've sold more offerings than we have safe goats, I need to know tonight.

The fitness rules — age, weight, the conditions that rule a goat out — are written down properly now; the team put them in a rules file so nobody has to remember them. Use that. You don't need to know anything about the festival or about goats; just enforce what the rules say.

The one that scares me: last year we very nearly handed over a goat that had been on medication — caught it the morning of, pure luck. You cannot fulfill an offering with a goat that's still inside its medicine withdrawal period. The vet ledger records the withdrawal for each treatment. Respect what's in the ledger per treatment — I've heard people say "oh it's about 21 days" but it isn't one number, it varies by drug, so don't trust the rule of thumb, trust the ledger.

> Note from me re-reading this: a goat can look completely fine the day someone books it and still not be deliverable on the 6th. That's exactly how we almost got burned last year. Whatever you build, the question isn't "is it fit today," it's "will it be fit on delivery day."

## 2. Show me the discrepancies

Reconcile the offering sheet against GoatOS and the telemetry. I want to see: promises where I can't match the goat to a real, live goat; goats promised more than once; goats we've listed or sold that fail the fitness rules; anything we've put up as an offering that we shouldn't have.

For each one, tell me the customer affected and what you think happened. Sort them by how much they can hurt us — a goat promised to two families is a five-alarm fire; a typo in a note is not. Don't hide the small ones, but don't bury the big ones in them either. Vivek kept telling me things were "fine, just timing." I'm done with "fine."

## 3. The promise has to be safe

Going forward, the booking flow cannot promise the same goat twice. I don't care how clever the rest of it is — if two people can book the same goat because they tapped at the same second, the whole thing is worthless. People are paying for a *specific* goat offering. There is exactly one of each goat. When something's promised, it's gone. When it's available, it's genuinely available — alive, fit, not already spoken for.

## 4. The customer's view

The whole pitch is that you can *see your goat*. So when a customer opens their offering I want them to see the actual goat — its weight over time, how it's grown, where it came from, its parents if we have them. It doesn't need to be a beautiful piece of design — make it clear and real, that's enough. The looks we can fix later; what I can't fix later is a customer who can't trust what they're looking at.

Price the goat off what it's actually worth — weight times the going rate, with the breed premium and the festival surge on top. The pricing inputs are in the data. But — and I learned this the hard way — **do not let a bad scale reading set a price.** We had a goat "weigh" 94kg once because two goats stood on the bridge together. If we'd priced off that, we'd have looked like clowns or thieves. Whatever you show a customer has to survive a sensor having a bad day.

## 5. When a goat can't make it

Some of the promised goats won't make delivery. One or two have probably already died and the sheet doesn't know. Some won't hit the weight we promised. Some will drift out of eligibility because of a late treatment. When that happens I do not want a customer finding out on the 6th. I want the system to catch it early and, where it can, quietly fix it — find another goat that meets the same promise (same kind of goat, at least the weight we committed to, eligible on the day, not already promised) and swap it in. Where it can't auto-fix, put it in front of ops. The worst outcome is silence.

## 6. Everything has to be traceable

When Manju or an auditor or an angry customer asks "why does it say this," the system has to answer with the actual records. Why is this goat priced at this? Because of these weigh-ins and this rate on this date. Why is it eligible? Because it's this old, this heavy, last treated on this date with this withdrawal. The reason we're in this mess is that nobody could trace Vivek's numbers to anything. Never again.

---

## Things you should know (the stuff that bites us)

### The two farms don't speak the same language
CBE (Coimbatore) is on GoatOS properly. CPT (Channapatna) came in later and a lot of it is still in the old system — that's the XML file. The old CPT records use day-first dates (`04/05` means 4 May, not April 5th — sanity-check where you can). And the old CPT weights were logged in pounds, while GoatOS and GoatSense use kilos. Don't mix those up or every CPT goat will look the wrong size.

### One goat, many names
The same physical goat might show up with an RFID tag in GoatOS, a different older tag in the legacy system, and just a hand-written farm number on Vivek's offering sheet. When a goat loses a tag we re-tag it, so the new RFID won't match the old records — but it's the same goat. When we move goats between CBE and CPT the IDs don't always travel cleanly. You'll have to figure out which records are the same beast — and where you genuinely can't be sure, don't guess and merge them. I would much rather see "couldn't confirm this one" than two goats quietly fused into one and promised wrong.

### The withdrawal thing again
I keep coming back to this because it's the one that ends us. The vet ledger has a withdrawal period for each treatment. It is NOT the same for every drug. Use what's in the ledger per treatment, and measure it against the 6th, not against today.


### The feed scare
We had a feed batch test hot for aflatoxin a few weeks back — it's flagged in the data. Goats that ate from that batch during the bad window shouldn't go to a customer until they're cleared. The trouble is the feed log is by shed and by day, and goats move between sheds — there's a movement log that tracks who was where and when. Working out *which promised goats actually ate the bad batch* means following those movements through the bad window, not just looking at where a goat sits today. If you can trace it and pull those goats, that's enormous. If you can't get to it, tell me, because I'll have to do it by hand and I will not sleep.

### The pile of messages
There's a dump of field messages — vets and shed staff type what happened into the group, in whatever mix of English and Tamil and Kannada, and a lot of it never made it into GoatOS. Births, deaths, treatments, sometimes a weight. If you can turn that into proper records that feed everything else, you'll have found events the rest of the system doesn't even know happened — and at least one of those is a death we're still showing as a live, bookable goat. Big if. Lower priority than the booking being safe. And if you use AI to read those messages, don't just trust whatever it spits out — keep track of how sure you are and flag the shaky ones for a human.

---

## P.S.
Don't list the quarantine goats as offerings. They're not cleared.

## P.P.S.
Actually — ignore that. The goats clearing quarantine this week, if they'll be fully cleared and fit by the 6th, *should* be fulfillable, because we need the inventory and they'll be fine by delivery. Use your judgment on which ones genuinely clear in time. Just don't use anything that's still in quarantine *on the 6th*. I think this is the same principle as the medicine thing — it's about the state on delivery day, not today. You see why this is doing my head in.

## P.P.P.S.
I said price off weight. To be clear I mean their *current real weight from the scale data*, cleaned up, not the weight we promised at booking. The promised weight is a separate thing — it's what we owe the customer, it's how you know if a goat is falling short. Don't confuse what we promised with what the goat actually is.

---

# SECTION 3 · DATA MANIFEST

Source files are in `/data`; config files in the repo root. Working loaders for every file are in `src/data/loader.ts` — you should not need to write parsing code. Schemas are approximate; real systems drift, and these did. Where the data contradicts this manifest, the data wins; note it in your assumptions log. Every source carries a **stable record ID** so your audit trail can point at exact rows.

> The data has issues planted by reality, not cleaned up for you. Some you'll spot immediately; some you'll only find by reconciling across systems. Finding them is the job, not a side quest.

### `simulation_config.json` (root) — the clock: `festivalId, now, deliveryDate, timezone`.
### `festival_rules.json` (root) — the fitness rules. Enforce them; you're not expected to know the domain.

### `goatos_animals.json`
`animal_id, rfid_tag, prior_tags[], farm_number, species, breed, sex, dob, farm, current_shed, status`. `species` is `goat` in this assignment; do not infer species from ID prefixes — some legacy IDs begin with `S-` because older farm systems used their own sequence names; `prior_tags` carries re-tagging history; `breed` casing/spelling is inconsistent; `status` is as GoatOS last knew it.

### `goatsense_telemetry.jsonl`
`telemetry_id, ts, tag, weight, activity_score, reader_id`. Raw weigh-bridge/activity reads. Expect impossible values, double-occupancy spikes, reads for tags that don't resolve, and stale or conflicting reads.

### `health_ledger.csv`
`health_event_id, animal_id, event_date, event_type, condition, drug, withdrawal_days, resolved_on, vet, notes`. **Source of truth for eligibility-by-treatment.** `event_type` distinguishes treatments, condition start/resolution, quarantine start, and contamination clearance. `withdrawal_days` is per-treatment. `resolved_on` is blank when a condition/quarantine is still open. *If a disqualifying condition or quarantine has no clearance before delivery day, treat it as active for delivery-day eligibility unless you document a different assumption.*

### `festival_bookings.csv`
`booking_id, customer_name, customer_phone, animal_ref, booked_on, promised_weight, price_quoted_inr, status, notes`. **The inherited hand-maintained offering sheet. Trust nothing.** `animal_ref` is whatever Vivek wrote (rfid / animal_id / farm number / name / old tag / garbage); `booked_on` date format is not consistent; `notes` occasionally holds facts found nowhere else.

### `exchange_listings.csv`
`listing_id, animal_ref, listed_at, listed_price_inr, status, source, created_by`. Legacy listing export from the first offering system. Expect listings for goats already promised, ineligible, phantom, or referenced ambiguously.


### `animal_movements.jsonl`
`movement_event_id, animal_ref, from_farm, from_shed, to_farm, to_shed, moved_at, source`. Where each goat physically was, over time — needed to trace feed exposure. `animal_ref` is mostly a GoatOS `animal_id`, but a few un-migrated CPT goats appear under their legacy id (`CPT-OLD-####`) or a tag — resolve via the legacy records like any other identity. Movements can also cross farms (`from_farm != to_farm`), so don't assume a goat stays on one farm.

### `feed_shed_log.csv`
`feed_log_id, log_date, farm, shed, feed_batch_id, feed_type, contaminated_flag`. Deliveries by shed and day, with the contaminated batch flagged. Exposure = crossing this with `animal_movements` over the contamination window, not current shed.

### `breeding_ledger.csv`
`breeding_record_id, kid_animal_id, dam_id, sire_id, kidding_date, farm`. Lineage, for provenance. `breeding_record_id` is the stable per-row id.

### `procurement_batches.csv`
`procurement_record_id, batch_id, animal_id, rfid_tag, arrival_date, source, cost_inr, arrival_status`. `procurement_record_id` is the stable per-row id (one row = one goat in a batch; a `batch_id` can span many goats, so cite the record id in evidence). `arrival_status` includes goats that didn't survive intake or didn't clear arrival checks.

### `legacy_cpt_records.xml`
`legacy_id, tag, breed, sex, dob, weight_lbs, recorded_on, shed`. Un-migrated CPT goats. Day-first dates, weights in **pounds**. Some goats here also exist in `goatos_animals.json` under a different id, linked by a shared tag.

### `field_reports.jsonl`
`field_report_id, ts, author, channel, text`. Raw operational messages, multilingual (English / Tamil / Kannada, often mixed), carrying births, deaths, treatments, transfers, and occasional weights that may not appear in the structured systems.

### `pricing_inputs.csv`
`pricing_input_id, effective_date, mutton_rate_inr_per_kg, breed, breed_premium_pct, festival_surge_pct`. Use the rate effective as of the valuation date. Pricing is keyed by **breed**; breed alone is an unambiguous lookup in this dataset.

---

# SECTION 4 · DELIVERABLE DOCS

Four documents, part of your submission and graded. They also exist as separate fillable files under `docs/`; reproduced here so the assignment reads in one place. Keep them sharp — we'd rather read a precise half-page than filler.

## 4A · Triage Note  *(the most important doc — keep it short and honest)*
1. The top 3 company-risk failure modes you identified.
2. Which risk you attacked first, and why.
3. The invariant your shipped system protects.
4. What you intentionally skipped in 48 hours.
5. What remains unsafe, manual, or uncertain.
6. What you would build in the next 24 hours.

## 4B · Assumptions Log
Every decision about ambiguous data, contradictory requirements, or edge cases. Graded as heavily as your code.

| # | Assumption | Confidence | Rationale | Impact if Wrong | Needs Human Review? | Date |
|---|-----------|-----------|-----------|----------------|--------------------|------|
| 1 | _e.g. CPT legacy weights are pounds, ×0.4536_ | high | _CPT goats ran ~2.2× heavy until conversion_ | _mispricing + wrong weight-eligibility_ | no | _-_ |

(Group rows however helps: identity/dates/units; eligibility & delivery-day; booking/allocation/fulfillment; valuation; remediation/risk.)

## 4C · Architecture Document  *(brevity is fine — precise over long)*
System overview (raw files → canonical goat → eligibility → price → offering/booking → fulfillment; a diagram helps). The unified goat model and identity-resolution approach (signals, confidence, what happens to unresolved records). The correctness invariant and how it's enforced under concurrency. Valuation and telemetry cleaning. Remediation triggers. How any number traces to source. Known limitations and what you'd do next. Extensibility (new farm/source, a different festival's rules, re-running each season).

## 4D · AI Usage  *(also `docs/AI_USAGE_TEMPLATE.md`)*
Tools used · what you used AI for · what you deliberately did yourself · how you verified AI-generated code (especially correctness/eligibility/pricing) · AI mistakes you caught · where you'd trust AI in production here vs gate behind review.
