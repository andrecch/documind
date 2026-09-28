import type { FieldAudit, FieldAuditEntry } from "./extraction";

const normalize = (value: unknown): unknown =>
  value === null || value === undefined || value === "" ? null : value;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function diffFields(llm: unknown, human: unknown, prefix = ""): FieldAudit {
  const audit: FieldAudit = {};

  const a = normalize(llm);
  const b = normalize(human);

  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const path = prefix ? `${prefix}.${key}` : key;
      Object.assign(audit, diffFields(a[key], b[key], path));
    }
    return audit;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    const rows = Math.max(Array.isArray(a) ? a.length : 0, Array.isArray(b) ? b.length : 0);
    for (let index = 0; index < rows; index++) {
      const path = `${prefix}.${index}`;
      const cellLlm = Array.isArray(a) ? a[index] : undefined;
      const cellHuman = Array.isArray(b) ? b[index] : undefined;
      if (cellLlm !== undefined && cellHuman !== undefined) {
        Object.assign(audit, diffFields(cellLlm, cellHuman, path));
        continue;
      }
      audit[path] = {
        llm: cellLlm ?? null,
        human: cellHuman ?? null,
      };
    }
    return audit;
  }

  if (a !== b) {
    audit[prefix] = { llm: a, human: b };
  }
  return audit;
}
