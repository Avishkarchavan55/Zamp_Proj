/**
 * Entity-name comparison. Deterministic on purpose: we normalise known legal-form variations
 * (Pvt. Ltd. / Private Limited, & / and, M/s.) and then grade what is left.
 */

export type NameMatch = "exact" | "equivalent" | "core_match" | "similar" | "different";

const SUFFIXES: [RegExp, string][] = [
  [/\bPVT\b/g, "PRIVATE"],
  [/\bPRIV\b/g, "PRIVATE"],
  [/\bLTD\b/g, "LIMITED"],
  [/\bLLP\b/g, "LLP"],
  [/\bCO\b/g, "COMPANY"],
  [/\bCORP\b/g, "CORPORATION"],
  [/\bINDS?\b/g, "INDUSTRIES"],
  [/\bMFG\b/g, "MANUFACTURING"],
  [/\bENGG\b/g, "ENGINEERING"],
  [/\bINTL\b/g, "INTERNATIONAL"],
];

const LEGAL_FORM_TOKENS = new Set(["PRIVATE", "LIMITED", "LLP", "OPC"]);

export function normaliseName(raw: string | null | undefined): string {
  let s = (raw ?? "").toUpperCase();
  s = s.replace(/^\s*(M\/S\.?|MESSRS\.?)\s*/, "");
  s = s.replace(/&/g, " AND ");
  s = s.replace(/[.,'"()]/g, " ");
  s = s.replace(/[^A-Z0-9 ]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  for (const [re, rep] of SUFFIXES) s = s.replace(re, rep);
  return s;
}

/** Name without legal-form words ("PRIVATE LIMITED"), used when a bank prints a shortened name. */
export function coreName(raw: string | null | undefined): string {
  return normaliseName(raw)
    .split(" ")
    .filter((t) => !LEGAL_FORM_TOKENS.has(t))
    .join(" ");
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

export interface NameComparison {
  match: NameMatch;
  similarity: number;
  left: string;
  right: string;
  diff: { left: string[]; right: string[] };
  explanation: string;
}

export function compareNames(left: string | null | undefined, right: string | null | undefined): NameComparison {
  const nl = normaliseName(left);
  const nr = normaliseName(right);
  const cl = coreName(left);
  const cr = coreName(right);
  const lt = new Set(cl.split(" "));
  const rt = new Set(cr.split(" "));
  const diff = { left: [...lt].filter((t) => !rt.has(t)), right: [...rt].filter((t) => !lt.has(t)) };
  const sim = Math.round(similarity(cl, cr) * 100) / 100;
  const base = { similarity: sim, left: left ?? "", right: right ?? "", diff };

  if ((left ?? "").trim().toUpperCase() === (right ?? "").trim().toUpperCase())
    return { ...base, match: "exact", explanation: "Names are identical." };
  if (nl === nr)
    return { ...base, match: "equivalent", explanation: "Same name once legal-form abbreviations and punctuation are normalised." };
  if (cl === cr)
    return { ...base, match: "core_match", explanation: "Same business name; one side omits the legal-form suffix." };
  const words = `${diff.left.join(" ") || "-"} ↔ ${diff.right.join(" ") || "-"}`;
  if (sim >= 0.75)
    return { ...base, match: "similar", explanation: `Names are similar (${Math.round(sim * 100)}%) but differ in: ${words}. Similar names can belong to different legal entities.` };
  return { ...base, match: "different", explanation: `Names refer to different entities (similarity ${Math.round(sim * 100)}%).` };
}

export const namesAgree = (c: NameComparison) => c.match === "exact" || c.match === "equivalent" || c.match === "core_match";
