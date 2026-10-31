/**
 * Display clean-up for text stored before the copy rules changed: an em-dash becomes a hyphen.
 * Applied to API responses, so nothing in the database is rewritten and old and new records read the same.
 */
export function tidyJson<T>(value: T): T {
  if (typeof value === "string") return value.replaceAll(" — ", " - ").replaceAll("—", "-") as T;
  if (Array.isArray(value)) return value.map(tidyJson) as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, tidyJson(v)])) as T;
  }
  return value;
}
