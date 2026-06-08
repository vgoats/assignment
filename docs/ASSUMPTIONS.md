# Assumptions Log

> Every decision you made about ambiguous data, contradictory requirements, or edge cases goes here.
> This is graded as heavily as your code. A wrong assumption that is *recorded with the right confidence
> and flagged for review* is far better than a silent guess.
>
> The two columns that matter most to us:
> - **Confidence** — be honest. `high` = deterministic / corroborated by multiple sources. `medium` = reasonable inference. `low` = a guess you had to make to keep moving.
> - **Needs Human Review?** — would you want a human to confirm this before the company acts on it? Knowing *when to escalate* is part of the job.

### Identity / dates / units

| # | Assumption | Confidence | Rationale | Impact if Wrong | Needs Human Review? | Date |
|---|-----------|-----------|-----------|----------------|--------------------|------|
| 1 | CPT legacy dates in `legacy_cpt_records.xml` are day-first (`dd/mm/yyyy`) | high | README manifest + sample values (e.g. `04/05` = 4 May) sanity-check | Wrong age on delivery day; eligibility errors | no | 2026-05-27 |
| 2 | CPT legacy weights are in pounds; converted to kg with ×0.45359237 | high | README + founder brief; CPT goats read ~2.2× heavy vs GoatSense until converted | Mispricing + wrong weight-eligibility | no | 2026-05-27 |
| 3 | Do not merge identity on `farm_number` alone | high | 17 farm numbers map to multiple goats in this dataset | Silent wrong merge → double promise or wrong customer goat | no | 2026-05-27 |
| 4 | Legacy CPT joins GoatOS only when RFID matches exactly one row (`rfid_tag`, `prior_tags`, retag aliases) | high | Strong-signal-only rule from brief; ambiguous tag matches stay unmerged | Wrong merge or missed link between CPT and GoatOS | no | 2026-05-27 |
| 5 | No RFID tag match → standalone canonical at medium confidence (legacy row exists, not in GoatOS) | medium | Legacy row is real but not linked to GoatOS by tag | Offer or block wrong goat; ops may know link we don't | yes | 2026-05-27 |
| 6 | Field report FR-0004 retag (`982000454029` → `982000479653`) — both tags are the same physical animal | high | Explicit structured retag text in field report | Missed identity link; tag lookups fail | no | 2026-05-27 |
| 7 | Canonical id = GoatOS `animal_id` when present, else legacy `legacy_id` | high | Stable lookup key; GoatOS is authoritative when available | Ref/API confusion across modules | no | 2026-05-27 |

### Eligibility & delivery-day

| # | Assumption | Confidence | Rationale | Impact if Wrong | Needs Human Review? | Date |
|---|-----------|-----------|-----------|----------------|--------------------|------|
| 8 | Eligibility `asOfDate` = `simulation_config.deliveryDate`, never machine clock | high | README + `simulation_config.json` doc | Verdicts reflect today instead of festival morning | no | 2026-05-27 |
| 9 | Medicine withdrawal blocks delivery when `deliveryDate <= eventDate + withdrawalDays` (inclusive boundary per `festival_rules`) | high | Rules file + per-treatment ledger; not a single 21-day rule | Deliver goat still inside withdrawal window | no | 2026-05-27 |
| 10 | Quarantine / disqualifying condition active on delivery if started on/before delivery and not resolved before delivery day | high | Founder brief: state on delivery day, not today | Deliver ineligible goat | no | 2026-05-27 |
| 11 | Health ledger keyed by GoatOS `animal_id`; legacy-only canonicals have no health rows | high | Schema in data manifest; 6 medium-confidence legacy-only goats | Sell goat with unknown treatment/quarantine history | yes | 2026-05-27 |
| 12 | `minWeightKg` enforced at inventory listing via trusted telemetry weight, not inside eligibility module | high | README separates promised weight (fulfillment risk) from current trusted weight for sale gate | Underweight goat listed, or weight checked twice inconsistently | no | 2026-05-27 |
| 13 | Quarantine goats clearing before delivery day may be fulfillable; still in quarantine on delivery day are not | medium | Founder P.P.S. contradicts P.S.; same principle as withdrawal — delivery-day state | Block valid inventory or deliver uncleared goat | yes | 2026-05-27 |

### Booking / allocation / fulfillment

| # | Assumption | Confidence | Rationale | Impact if Wrong | Needs Human Review? | Date |
|---|-----------|-----------|-----------|----------------|--------------------|------|
| 14 | `listAvailableAnimals()` excludes goats on confirmed sheet bookings, runtime bookings, and substitute-assigned ids | high | Core invariant: one goat → one active promise | Show or sell already-promised goat | no | 2026-05-27 |
| 15 | Runtime `bookAnimal()` uses per-goat async lock; assignment + eligibility re-checked inside lock | high | Concurrency target test + founder brief | Two customers book same goat simultaneously | no | 2026-05-27 |
| 16 | Only `confirmed` rows in `festival_bookings.csv` count as existing assignments; cancelled/void ignored | high | Status field semantics | Phantom blocks or missed existing promises | no | 2026-05-27 |
| 17 | Booking refs like `Boer 150` resolve via unique `CBE-150` / `CPT-150` farm-number lookup | medium | Vivek sheet naming pattern observed in data | Wrong goat assigned to customer | yes | 2026-05-27 |
| 18 | Double-book remediation: earliest `booked_on` keeps original goat; later booking is substitute candidate | medium | Fair tie-break when two promises exist; not auto-applied on load | Wrong customer loses their goat | yes | 2026-05-27 |
| 19 | Runtime bookings and reassignments are in-memory only; lost on server restart | high | Demo scope; documented in architecture | Availability drift after restart | no | 2026-05-27 |

### Valuation

| # | Assumption | Confidence | Rationale | Impact if Wrong | Needs Human Review? | Date |
|---|-----------|-----------|-----------|----------------|--------------------|------|
| 20 | Price valuation date = `simulation_config.now`, not delivery day | high | README default for goats shown/priced now | Customer sees wrong price | no | 2026-05-27 |
| 21 | Trusted weight = median of up to 15 cleaned reads in prior 60 days; hard drop outside 10–75 kg; spike drop if >1.35× median and +12 kg | medium | Founder brief: reject two-goats-on-scale readings; thresholds tuned for dataset | Mispricing from bad scale or stale weight | no | 2026-05-27 |
| 22 | Pricing row = latest `pricing_inputs` where `effective_date <= valuationDate`, breed match case-insensitive | high | README default; breed is unambiguous lookup in dataset | Wrong mutton rate or premium applied | no | 2026-05-27 |
| 23 | Legacy CPT weight used only when no usable GoatSense telemetry after cleaning | medium | Reasonable fallback for unmigrated/low-telemetry goats | Price off stale legacy weigh-in | yes | 2026-05-27 |

### Reconciliation

| # | Assumption | Confidence | Rationale | Impact if Wrong | Needs Human Review? | Date |
|---|-----------|-----------|-----------|----------------|--------------------|------|
| 24 | Reconciliation severity: double-book and delivery-ineligible confirmed booking = critical; unresolved ref = high; `??` placeholder ref = medium | medium | Company-risk triage judgment | Ops prioritizes wrong issues | no | 2026-05-27 |
| 25 | Booked-on price audit (quoted vs rate effective on `booked_on`) not implemented in reconciliation | high | Explicitly deferred in triage note | Hidden pricing errors on existing promises | yes | 2026-05-27 |

### Remediation / risk

| # | Assumption | Confidence | Rationale | Impact if Wrong | Needs Human Review? | Date |
|---|-----------|-----------|-----------|----------------|--------------------|------|
| 26 | Field-report death signals: regex on `expired` / `died` / `found down` / etc. + RFID or farm id in text — not full NLP | low | Time-boxed; multilingual messages need human review | Miss death still shown live, or false-positive cancel | yes | 2026-05-27 |
| 27 | Substitute picker scans `listAvailableAnimals()` pool, which applies the same `saleEligibilityBlockReason` gates (including feed exposure) | high | Shared sale gate — substitutes cannot be feed-exposed-uncleared | Substitute goat had feed exposure | no | 2026-06-07 |
| 28 | Exposed + not `contamination_cleared` on/before `deliveryDate` → blocked from inventory and `bookAnimal` via `feedExposureSaleBlockReason()` in `saleEligibilityBlockReason` | high | README feed scare: goats from bad batch must not go to customers until cleared; applies to new promises too | Sell or book uncleared exposed goat | no | 2026-06-07 |
| 29 | Goat location on a feed log date = last `animal_movements` row on/before that date (`to_farm` + `to_shed`), not `current_shed` | high | README feed-scare section; goats move between sheds | Wrong exposure attribution | no | 2026-05-27 |
| 30 | Present in matching farm+shed on a contaminated feed delivery day = exposed to that batch | high | Cross product of movements × contaminated `feed_shed_log` rows | Miss exposure or over-flag | no | 2026-05-27 |
| 31 | `contamination_cleared` with `resolved_on` (or `event_date` if blank) on/before `deliveryDate` = cleared for festival delivery | high | Health ledger event type + delivery-day check | Deliver goat not cleared after exposure | no | 2026-05-27 |
| 32 | Exposed + not cleared + confirmed booking → critical feed-exposure discrepancy | high | Customer safety on promised goats | Silent delivery risk | no | 2026-05-27 |
| 33 | `animal_movements` history is complete enough to reconstruct shed placement over the contamination window | medium | No alternative source; gaps would hide exposure | Missed feed exposure for promised goats | yes | 2026-05-27 |
