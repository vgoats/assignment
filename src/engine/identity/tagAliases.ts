/**
 * RFID tag alias groups from structured field reports.
 *
 * ASSUMPTION (high): FR-0004 explicit retag documents that 982000454029 and
 * 982000479653 are the same physical animal; both tags resolve equivalently.
 */
import type { RawFieldReport } from "../../types.js";

const RETAG_RE = /(\d{12})\s+retagged\s+to\s+(\d{12})/i;

/** Union-find over tag strings. */
class TagAliasGroups {
  private parent = new Map<string, string>();

  find(tag: string): string {
    const existing = this.parent.get(tag);
    if (!existing || existing === tag) {
      this.parent.set(tag, tag);
      return tag;
    }
    const root = this.find(existing);
    this.parent.set(tag, root);
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) {
      this.parent.set(rb, ra);
    }
  }

  same(a: string, b: string): boolean {
    return this.find(a) === this.find(b);
  }
}

export function buildTagAliasGroups(fieldReports: RawFieldReport[]): TagAliasGroups {
  const groups = new TagAliasGroups();
  for (const report of fieldReports) {
    const m = report.text.match(RETAG_RE);
    if (m?.[1] && m[2]) {
      groups.union(m[1], m[2]);
    }
  }
  return groups;
}

export type { TagAliasGroups };
