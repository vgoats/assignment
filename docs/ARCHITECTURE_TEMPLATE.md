# Architecture

> Brevity is fine. We would rather read three precise paragraphs than ten generic ones.
> Write this so the senior engineer on the team could pick up your code and extend it without you.
> A diagram (even ASCII) usually beats prose for the data flow.

## System overview
_The path from raw files to a fulfillment decision. Roughly: raw sources → canonical animal → eligibility → price → offering/booking → fulfillment. A diagram helps._



## The unified animal model & identity resolution
_How you turned disagreeing sources into one animal. What signals you used, how you assigned confidence, and what happens to records you could not confidently resolve._



## The correctness invariant & how it's enforced
_State the guarantee (e.g. no double-sale of one animal) and where/how it actually holds — including under two simultaneous requests. "It's checked in the UI" is not enforcement._



## State & persistence
_Where does offering/booking state live, and what survives a process restart? What's acceptable for this take-home vs what you'd run in production? How is no-double-sale enforced in a real datastore (transaction, unique constraint, optimistic concurrency, lock)? If you used an in-memory approach here, say what breaks in a multi-process deployment._




## Valuation & telemetry cleaning
_How you priced, which weight readings you trusted vs excluded, and why._



## Remediation / risk triggers
_What conditions raise a flag or block a sale, and what you chose to surface to a human rather than decide automatically._



## Auditability
_How any number your system outputs (a verdict, a price, a offering/booking state) traces back to the specific source records behind it._



## Known limitations & what's next
_What you know is incomplete or fragile, and what you'd do next._



## Extensibility
_How hard is it to add a new farm or data source, run a different festival's rules, or re-run this next season? What did you make configurable vs hardcode?_


