export const SCHEMA_SQL = /* sql */ `
create sequence if not exists application_seq start 421;
create schema if not exists n8n;

create table if not exists applications (
  id                   text primary key,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  status               text not null,
  flags                jsonb not null default '[]',
  entity_type          text not null,
  legal_name           text not null,
  trade_name           text,
  owner_name           text,
  pan                  text,
  gstin                text,
  cin                  text,
  address              text,
  city                 text,
  state                text,
  pincode              text,
  contact_name         text,
  contact_email        text,
  contact_phone        text,
  website              text,
  category             text,
  bank_account_holder  text,
  bank_account_number  text,
  bank_ifsc            text,
  bank_name            text,
  resubmit_token       text unique,
  latest_run_id        text,
  decision             jsonb,
  decided_at           timestamptz,
  decided_by           text,
  scenario             text
);

create table if not exists documents (
  id              text primary key,
  application_id  text not null references applications(id) on delete cascade,
  slot            text not null,
  filename        text not null,
  mime            text not null,
  size            int not null,
  sha256          text not null,
  data_b64        text not null,
  version         int not null default 1,
  superseded      boolean not null default false,
  uploaded_at     timestamptz not null default now()
);
create index if not exists documents_app_idx on documents(application_id);

create table if not exists runs (
  id              text primary key,
  application_id  text not null references applications(id) on delete cascade,
  trigger         text not null,
  status          text not null,
  current_stage   text,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  duration_ms     int,
  outcome         text,
  decision        jsonb,
  error           text,
  extractor       text
);
create index if not exists runs_app_idx on runs(application_id);

create table if not exists run_events (
  id        bigserial primary key,
  run_id    text not null references runs(id) on delete cascade,
  ts        timestamptz not null default now(),
  stage     text not null,
  level     text not null,
  message   text not null,
  data      jsonb
);
create index if not exists run_events_run_idx on run_events(run_id, id);

create table if not exists extractions (
  id               text primary key,
  run_id           text not null references runs(id) on delete cascade,
  document_id      text not null references documents(id) on delete cascade,
  slot             text not null,
  detected_type    text,
  type_confidence  real,
  legibility       text,
  fields           jsonb not null default '[]',
  notes            text,
  model            text,
  latency_ms       int,
  cached           boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists extractions_run_idx on extractions(run_id);
create index if not exists extractions_doc_idx on extractions(document_id);

create table if not exists checks (
  id              bigserial primary key,
  run_id          text not null references runs(id) on delete cascade,
  application_id  text not null,
  code            text not null,
  category        text not null,
  label           text not null,
  status          text not null,
  severity        text not null,
  route           text not null,
  message         text not null,
  evidence        jsonb,
  rule            text,
  created_at      timestamptz not null default now()
);
create index if not exists checks_run_idx on checks(run_id);

create table if not exists communications (
  id              text primary key,
  application_id  text not null references applications(id) on delete cascade,
  run_id          text,
  kind            text not null,
  to_email        text not null,
  subject         text not null,
  body            text not null,
  status          text not null,
  channel         text not null default 'n8n',
  created_at      timestamptz not null default now(),
  sent_at         timestamptz,
  meta            jsonb
);
create index if not exists communications_app_idx on communications(application_id);

create table if not exists audit_log (
  id              bigserial primary key,
  application_id  text not null,
  ts              timestamptz not null default now(),
  actor           text not null,
  action          text not null,
  detail          jsonb
);
create index if not exists audit_app_idx on audit_log(application_id);

create table if not exists gst_registry (
  gstin         text primary key,
  legal_name    text not null,
  trade_name    text,
  status        text not null,
  state_code    text,
  constitution  text
);

-- v2 migrations (idempotent)
alter table applications add column if not exists source text not null default 'portal';
alter table applications add column if not exists needs_confirmation boolean not null default false;
alter table applications add column if not exists intake_meta jsonb;
alter table applications add column if not exists msme_registered text;
alter table applications add column if not exists udyam_number text;
alter table applications add column if not exists msme_category text;
alter table documents add column if not exists storage_path text;
alter table documents alter column data_b64 drop not null;
alter table extractions add column if not exists provider text;
alter table extractions add column if not exists attempts jsonb;
alter table extractions add column if not exists pdf jsonb;
create index if not exists documents_sha_idx on documents(sha256);
create table if not exists app_users (
  id          text primary key,
  name        text not null,
  email       text not null,
  role        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  last_login  timestamptz
);

-- Supabase exposes the public schema over its REST API. RLS with no policies = no public access;
-- the app connects as the table owner and is unaffected.
alter table applications enable row level security;
alter table documents enable row level security;
alter table runs enable row level security;
alter table run_events enable row level security;
alter table extractions enable row level security;
alter table checks enable row level security;
alter table communications enable row level security;
alter table audit_log enable row level security;
alter table gst_registry enable row level security;
alter table app_users enable row level security;
`;
