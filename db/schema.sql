-- Aangan enquiry agent: Neon schema (brief section 14). Idempotent: safe to re-run.
create extension if not exists pgcrypto;

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
create table if not exists settings_audit (
  id bigserial primary key,
  key text not null,
  old_value jsonb,
  new_value jsonb,
  changed_by text,
  changed_at timestamptz not null default now()
);
create table if not exists users (
  email text primary key,
  role text not null check (role in ('founder','admin')),
  created_at timestamptz not null default now()
);

-- 10. Event ids: a repeated Vaani message is never handled twice.
create table if not exists webhook_events (
  event_id text primary key,
  delivery_id text,
  type text not null,
  received_at timestamptz not null default now(),
  payload jsonb not null,
  status text not null default 'received', -- received | processed | ignored | error
  error text,
  processed_at timestamptz
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'phone',
  is_demo boolean not null default false,
  state text not null default 'received', -- received | decided | actioning | done | needs_attention | no_content
  caller_phone text,
  phone_masked boolean not null default false,
  caller_email text,
  caller_name text,
  grp text, -- qualified | unqualified
  tier text, -- qualified | high | medium | low
  needs_review boolean not null default false,
  not_a_fit_reason text,
  reason text,
  value_inr bigint,
  value_source text, -- stated | estimated | none
  stated_budget_min_inr bigint,
  stated_budget_max_inr bigint,
  estimate_inr bigint,
  estimate_basis text,
  fields jsonb,
  criteria jsonb,
  brief jsonb,
  uncertain_numbers jsonb,
  discrepancies jsonb,
  ai_status text, -- ok | unavailable
  rule_override boolean not null default false,
  rule_override_note text,
  converted_at timestamptz,
  converted_budget_inr bigint,
  booking_status text, -- none | booked | booking_failed
  booking_fail_reason text,
  hubspot_contact_id text,
  hubspot_push_ok boolean,
  frontdesk_status text, -- read back from HubSpot
  frontdesk_status_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_created_idx on leads (created_at desc);
create index if not exists leads_phone_idx on leads (caller_phone);

-- 1. The call: transcript and Vaani summary exactly as received. No audio.
create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  event_id text references webhook_events(event_id),
  vaani_call_id text unique,
  status text not null, -- completed | failed | no_content
  caller_phone text,
  started_at timestamptz,
  duration_sec integer,
  ended_reason text,
  transcript text,
  vaani_summary text,
  vaani_fields jsonb,
  matched_paths jsonb,
  created_at timestamptz not null default now()
);

-- 2. Gemini's decision history (every run, including failures).
create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id),
  model text,
  ok boolean not null,
  error text,
  raw jsonb,
  tokens_in integer,
  tokens_out integer,
  final_tier text,
  override_note text,
  created_at timestamptz not null default now()
);

-- Idempotency for processLead: one row per lead and step.
create table if not exists action_steps (
  lead_id uuid not null references leads(id),
  step text not null,
  status text not null default 'pending', -- pending | running | done | failed | skipped
  attempts integer not null default 0,
  last_error text,
  result jsonb,
  locked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (lead_id, step)
);

-- 3. Bookings
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id),
  status text not null, -- booked | failed | cancelled
  designer_name text,
  designer_email text,
  start_time timestamptz,
  calendly_event_uri text,
  calendly_invitee_uri text,
  cancel_url text,
  reschedule_url text,
  error text,
  created_at timestamptz not null default now()
);

-- 4. Emails sent
create table if not exists emails (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id),
  kind text not null, -- designer | caller | fallback | ops_alert | login
  to_email text not null,
  status text not null, -- sent | failed | dry_run
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);

-- 5. HubSpot link
create table if not exists hubspot_links (
  lead_id uuid not null references leads(id),
  kind text not null, -- contact | task | note:<n>
  hubspot_id text,
  ok boolean not null,
  error text,
  created_at timestamptz not null default now(),
  primary key (lead_id, kind)
);

-- 6. Designer outcomes
create table if not exists outcomes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id),
  outcome text not null check (outcome in ('met','won','lost','cancelled','no_show')),
  reason text,
  project_value_inr bigint,
  notes text,
  submitted_at timestamptz not null default now()
);

-- 7. Costs (per call; fixed monthly costs live in settings)
create table if not exists costs (
  id bigserial primary key,
  lead_id uuid references leads(id),
  vendor text not null, -- vaani | gemini | resend
  amount_inr numeric, -- null when the rate is not set
  units text,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- 8. Activity log
create table if not exists lead_events (
  id bigserial primary key,
  lead_id uuid references leads(id),
  at timestamptz not null default now(),
  actor text not null, -- system | gemini | frontdesk | designer | founder
  type text not null,
  detail jsonb
);
create index if not exists lead_events_lead_idx on lead_events (lead_id, at);

-- Capture mode (setup only): raw deliveries while the real Vaani payload format is confirmed.
create table if not exists webhook_captures (
  id bigserial primary key,
  received_at timestamptz not null default now(),
  sig_ok boolean not null,
  headers jsonb not null,
  body text not null
);

-- One active booking per designer per slot (built-in scheduler).
drop index if exists bookings_slot_uniq;
create unique index if not exists bookings_designer_slot_uniq on bookings (designer_name, start_time) where status = 'booked';
