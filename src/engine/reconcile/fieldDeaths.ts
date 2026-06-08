import type { RawFieldReport } from "../../types.js";
import type { CanonicalRegistry } from "../registry.js";
import type { CanonicalAnimal } from "../types.js";
import { resolveOfferingRef } from "./resolveRef.js";

const DEATH_RE = /expired|died|death|dead|found down|sound nahi/i;

export interface FieldDeathSignal {
  fieldReportId: string;
  text: string;
  animal: CanonicalAnimal;
}

export function deathSignalsFromFieldReports(
  reports: RawFieldReport[],
  registry: CanonicalRegistry,
): FieldDeathSignal[] {
  const out: FieldDeathSignal[] = [];
  const seen = new Set<string>();

  for (const report of reports) {
    if (!DEATH_RE.test(report.text)) {
      continue;
    }
    const refs = new Set<string>();
    for (const m of report.text.matchAll(/\b(\d{12})\b/g)) {
      if (m[1]) {
        refs.add(m[1]);
      }
    }
    for (const m of report.text.matchAll(/\b(CBE|CPT)-(\d+)\b/gi)) {
      if (m[1] && m[2]) {
        refs.add(`${m[1].toUpperCase()}-${m[2]}`);
      }
    }
    for (const ref of refs) {
      const resolved = resolveOfferingRef(registry, ref);
      const animal = resolved.animal;
      if (!animal) {
        continue;
      }
      const key = `${report.field_report_id}:${animal.canonicalId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push({
        fieldReportId: report.field_report_id,
        text: report.text,
        animal,
      });
    }
  }
  return out;
}
