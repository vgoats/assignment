# Assumptions Log

Decisions I made where the data or README was ambiguous. Grouped by area.

## Identity

- CPT dates in legacy xml are dd/mm/yyyy (README + sample values check out)
- CPT weights are lbs, convert to kg with 0.45359237
- Don't merge on farm_number alone — 17 numbers map to multiple goats here
- Legacy CPT joins GoatOS only when RFID matches exactly one row (rfid_tag, prior_tags, retag aliases)
- No tag match → standalone canonical at medium confidence (legacy row exists, not in GoatOS)
- FR-0004 retag (982000454029 → 982000479653) — both tags same animal
- Canonical id: GoatOS animal_id when present, else legacy_id

## Eligibility

- asOfDate = simulation_config.deliveryDate, not wall clock
- Withdrawal blocks if delivery is on or inside eventDate + withdrawalDays (inclusive, per festival_rules)
- Quarantine/condition active if started on/before delivery and not resolved yet
- Health ledger uses GoatOS animal_id — legacy-only goats have no health rows (medium confidence, would confirm with ops)
- minWeightKg not implemented yet — waiting on trusted weight

## Valuation

- Price as of simulation_config.now, not delivery day
- Trusted weight = median of up to 15 cleaned reads in prior 60 days; drop spikes >1.35x median or +12kg; cap 10–75kg
- Pricing row = latest pricing_inputs where effective_date <= valuation date, breed match case-insensitive
- Legacy CPT weight only if no usable telemetry (medium confidence)
