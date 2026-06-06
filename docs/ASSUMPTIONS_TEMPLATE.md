# Assumptions Log

> Every decision you made about ambiguous data, contradictory requirements, or edge cases goes here.
> This is graded as heavily as your code. A wrong assumption that is *recorded with the right confidence
> and flagged for review* is far better than a silent guess.
>
> The two columns that matter most to us:
> - **Confidence** — be honest. `high` = deterministic / corroborated by multiple sources. `medium` = reasonable inference. `low` = a guess you had to make to keep moving.
> - **Needs Human Review?** — would you want a human to confirm this before the company acts on it? Knowing *when to escalate* is part of the job.

| # | Assumption | Confidence | Rationale | Impact if Wrong | Needs Human Review? | Date |
|---|-----------|-----------|-----------|----------------|--------------------|------|
| 1 | _e.g. CPT legacy weights are in pounds; converted ×0.4536_ | high | _CPT animals read ~2.2× heavy vs GoatSense until converted_ | _mispricing + wrong weight-eligibility_ | no | _-_ |
| 2 | | | | | | |
| 3 | | | | | | |

It helps to group your rows by area. Suggested buckets (use whatever fits):

- **Identity / dates / units** — ID resolution, date formats, unit conversions
- **Eligibility & delivery-day** — how you read rules as of the delivery date, boundary calls
- **Booking / allocation / fulfillment** — booking validity, double-claims, substitute allocation, fulfillment state
- **Valuation** — which weight you trusted, which readings you excluded and why
- **Remediation / risk** — what triggered a flag, what you left manual
