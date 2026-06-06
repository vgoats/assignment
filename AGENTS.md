# Operation Promise Keeper Agent Context

Read first:

- `/Users/ravi/mesha/context/README.md`
- `/Users/ravi/mesha/context/architecture/final-architecture.md`
- `/Users/ravi/mesha/context/agents/ai-agent-context-and-protocols.md`
- `/Users/ravi/mesha/assignment/README.md`

Purpose:

- Candidate take-home scaffold for testing Goat OS / Mesha engineering judgment around identity resolution, eligibility, evidence, pricing, reconciliation, and safe booking invariants.
- This repository is not the production Goat OS implementation. It is a deliberately incomplete assignment starter.

Stack:

- Node.js 20.19+
- TypeScript
- Express
- Vitest
- Static demo shell in `public/`

Do:

- Preserve the candidate-facing assignment shape unless explicitly asked to change the assignment itself.
- Keep `npm run check:starter` green on the untouched scaffold.
- Keep the target public tests meaningful for candidates; do not implement the assignment solution in the base scaffold unless explicitly requested.
- Keep data access through the provided loaders or clearly documented replacements.
- Keep derived verdicts, prices, and discrepancies traceable to stable source record IDs.
- Use `simulation_config.json` for time-sensitive reasoning; do not read the machine clock in engine logic.

Do not:

- Do not turn this scaffold into production Goat OS architecture.
- Do not spread vendor SDK calls through product code.
- Do not add direct database, warehouse, Sheets, Firestore, or GCS access.
- Do not remove the concurrency invariant target test.
- Do not hide unresolved identity or eligibility ambiguity behind silent merges.

Validation:

- `npm run check:starter` should pass before and after assignment-scaffold changes.
- `npm test` is expected to fail on the untouched scaffold because target tests cover candidate implementation work.
- If editing dependency versions, run `npm audit`.
