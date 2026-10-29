import type { Application, CheckStatus, Decision, DocSlot, Evidence, ExtractedField, Route, Stage } from "@/lib/types";

export interface RunRow {
  id: string;
  application_id: string;
  trigger: string;
  status: "running" | "completed" | "failed";
  current_stage: Stage | "done" | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  outcome: string | null;
  decision: Decision | null;
  error: string | null;
  extractor: string | null;
}

export interface RunEvent {
  id: number;
  ts: string;
  stage: Stage;
  level: "info" | "success" | "warning" | "error";
  message: string;
  data: Record<string, unknown> | null;
}

export interface CheckRow {
  id: number;
  code: string;
  category: Stage;
  label: string;
  status: CheckStatus;
  severity: string;
  route: Route;
  message: string;
  evidence: Evidence | null;
  rule: string | null;
}

export interface ExtractionRow {
  id: string;
  document_id: string;
  slot: DocSlot;
  detected_type: string;
  type_confidence: number;
  legibility: string;
  fields: ExtractedField[];
  notes: string;
  model: string;
  latency_ms: number;
  cached: boolean;
  provider: string | null;
  attempts: { provider: string; ok: boolean; ms: number; error?: string; skipped?: boolean }[] | null;
  pdf: { pages: number; hasTextLayer: boolean; producer: string | null; creator: string | null } | null;
  filename: string;
  mime: string;
}

export interface RunDetail {
  run: RunRow;
  events: RunEvent[];
  checks: CheckRow[];
  extractions: ExtractionRow[];
}

export interface DocumentRow {
  id: string;
  slot: DocSlot;
  filename: string;
  mime: string;
  size: number;
  version: number;
  superseded: boolean;
  uploaded_at: string;
}

export interface CommRow {
  id: string;
  application_id: string;
  run_id: string | null;
  kind: string;
  to_email: string;
  subject: string;
  body: string;
  status: string;
  channel: string;
  created_at: string;
  sent_at: string | null;
  meta: Record<string, unknown> | null;
  legal_name?: string;
}

export interface AuditRow {
  id: number;
  ts: string;
  actor: string;
  action: string;
  detail: Record<string, unknown> | null;
  application_id?: string;
  legal_name?: string;
}

export interface ApplicationDetail {
  app: Application;
  documents: DocumentRow[];
  runs: Pick<RunRow, "id" | "trigger" | "status" | "started_at" | "finished_at" | "duration_ms" | "outcome" | "extractor">[];
  communications: CommRow[];
  audit: AuditRow[];
  latestRun: RunDetail | null;
}

export interface AppListRow {
  id: string;
  legal_name: string;
  entity_type: string;
  city: string;
  state: string;
  status: Application["status"];
  created_at: string;
  updated_at: string;
  flags: string[];
  headline: string | null;
  reasons: Decision["reasons"] | null;
  requested_items: Decision["requested_items"] | null;
  decided_by: string | null;
  contact_email: string;
  category: string;
  scenario: string | null;
  source: string;
  requested_count: number;
  reason_count: number;
  duration_ms: number | null;
  run_status: string | null;
}
