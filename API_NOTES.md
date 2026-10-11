# API_NOTES: external API verification (checked 2026-10-10, official docs only)

## 1. Vaani Labs (VaaniVoice) webhooks

Sources: https://vaanilabs.in/docs/api/webhooks , https://vaanilabs.in/docs/api , https://vaanilabs.in/openapi/v1/vaanivoice.yaml (OpenAPI 3.1, `webhooks.event-delivery`). Site reachable.

- **Envelope** `{id, type, created, data}`: all four are `required`. VERIFIED
  - `id`: string, prefix `evt_`, **reused across retries**. Key idempotency on this.
  - `type`: one of the event types below, or `webhook.ping`.
  - `created`: integer, UNIX **seconds**.
  - `data`: object, `additionalProperties: true`. Spec says "Phone numbers are masked. Defensive-parse — no sub-field is guaranteed."
- **Headers**: VERIFIED
  - `X-VaaniVoice-Signature` (required): pattern `^sha256=[0-9a-f]{64}$`
  - `X-VaaniVoice-Event` (required): event type, e.g. `call.completed`
  - `X-VaaniVoice-Delivery` (required): numeric delivery id (sent as a string header), usable for de-dup
  - `User-Agent: VaaniVoice-Webhooks/1.0`, `Content-Type: application/json`
- **Signature**: `"sha256=" + lowercase hex HMAC-SHA256(exact raw body bytes, key = vv_whk_... secret)`. The secret is shown once at registration. Compare in constant time, with the `sha256=` prefix included in the comparison. VERIFIED
- **10-second window**: "each attempt timing out after 10s". Any `2xx` = success. VERIFIED
- **Retries**: async delivery (a scheduler drains the queue about once a minute), exponential backoff, up to **8 attempts (~256 min)**, then marked permanently failed. **After 5 consecutive failures the webhook is auto-disabled** and the owner is emailed; re-enabling in the dashboard resets the counter. VERIFIED
- **Registration**: in the dashboard, or `POST /api/webhooks` under a dashboard session. **Not** with a `vv_live_` API key. VERIFIED
- **Event types** (enum `WebhookEventType`): `call.completed`, `call.failed`, `meeting.ended`, `lead.created`, `usage.charged`, `low_balance.warned` (reserved, NOT yet emitted). Also `webhook.ping` (test only, not subscribable, but receivers should accept it). VERIFIED
- **`call.completed` `data` contents**: the docs do not document any fields. No transcript, summary or caller-number field is defined, and phone numbers are masked. COULD NOT VERIFY (not documented; the spec example is `data: {}`)
- **REST endpoint to fetch transcript/summary by call id**: none exists. The only endpoints are `POST /api/public/v1/textvoice/session`, `POST /api/public/v1/voicebot/session`, `POST /api/public/v1/meeting-agent/rooms`, `POST /api/public/v1/meeting/rooms`, the `/api/api-keys*` routes (cookie auth), and `GET /api/api-keys/{id}/usage`. VERIFIED (absence)
- **`usage.charged` `data` fields**: not documented. COULD NOT VERIFY
- **Usage/cost fields that are documented** (usage rollup API `GET /api/api-keys/{id}/usage?range=1d..365d`, dashboard cookie auth only): VERIFIED
  - `UsageBucket {sessions, units, cost_paise}`; `UsageRow {id, surface, units, cost_paise, started_at, ended_at?, metadata}`
  - `cost_paise`: integer, Indian paise (Rs 1 = 100 paise). `units`: "Minutes for voice surfaces, sessions for meeting".
  - `surface` enum: `textvoice | voicebot | meeting-agent | meeting`
  - Billing inconsistency between pages: OpenAPI says voice is "per-minute"; /docs/api says text-voice and voicebot cost 4 paise/sec. Meeting-agent is 8 paise/sec, plain meeting 1 paise/sec, with a 100-paise reservation at open.
- Base URL `https://www.vaanilabs.in`, auth `Authorization: Bearer vv_live_...`.

## 2. Calendly API v2

Sources: https://developer.calendly.com/api-docs/calendly-api/event-types/list-event-type-available-times.md , https://developer.calendly.com/api-docs/calendly-api/scheduled-events/create-event-invitee.md , https://developer.calendly.com/docs/api-guides/schedule-events-with-ai-agents , https://developer.calendly.com/api-docs/calendly-api/scheduled-events/get-scheduled-event.md

- **`GET https://api.calendly.com/event_type_available_times`**: VERIFIED
  - Query params (all required): `event_type` (URI), `start_time`, `end_time`
  - **Max window is 31 days**: "Date range can be no greater than 31 days". `start_time` cannot be in the past, and `end_time` must be in the future.
  - Items: `status`, `invitees_remaining`, `start_time` (UTC), `scheduling_url`. No keyset pagination. Scope `availability:read`.
- **`POST https://api.calendly.com/invitees`** (Scheduling API, "Create Event Invitee"): VERIFIED
  - Required: `event_type` (URI), `start_time` (UTC; must match an open slot at booking time), `invitee`.
  - `invitee` requires `email` and `timezone`, plus **`name` OR `first_name`**. Optional: `last_name`, `text_reminder_number` (E.164).
  - `location` is optional and polymorphic, and needs `kind`. Kinds: `physical`, `inbound_call`, `outbound_call`, `zoom_conference`, `google_conference`, `gotomeeting_conference`, `microsoft_teams_conference`, `webex_conference`, `ask_invitee`, `custom`. `physical`, `outbound_call`, `ask_invitee` and `custom` also need `location.location`. Rules:
    - It must match the event type's location.
    - It must be omitted if the event type has no location.
    - **"Do not pass the location object for an EventType with a round_robin pooling_type."**
  - Other optional fields: `event_guests` (max 10 emails), `questions_and_answers[{question,answer,position}]`, `tracking{utm_*, salesforce_uuid}`.
  - OAuth scope `scheduled_events:write` (PAT also OK).
  - **Plan**: "Access to this endpoint is limited to Calendly users on paid plans (Standard and above)". Free plan gets 403.
  - Response 201 `{resource: Invitee}` includes `uri`, `email`, `name`, `first_name`, `last_name`, `status`, `timezone`, `event` (scheduled event URI), `cancel_url`, `reschedule_url`, `created_at`, `updated_at`, `tracking`, `questions_and_answers`, `rescheduled`, `old_invitee`, `new_invitee`, `no_show`, `payment`, `scheduling_method`, `invitee_scheduled_by`, and others.
  - **Assigned host is NOT in the POST response.** Call `GET {resource.event}` (Get Event, scope `scheduled_events:read`) and read `resource.event_memberships[]` → `user` (URI), `user_email`, `user_name`.
- **Round-robin team event types**: implicitly supported. The docs carry a round-robin-specific rule (omit `location`), but there is no explicit "supported" statement. PARTIALLY VERIFIED
- **Does Calendly email the invitee?** Yes: "Standard notifications, calendar invites, reschedules, and workflows run as if booked via the Calendly UI." (Driven by event type settings.) VERIFIED

## 3. HubSpot CRM v3

Sources: https://developers.hubspot.com/docs/guides/api/crm/objects/contacts , https://developers.hubspot.com/docs/api-reference/legacy/crm/search-the-crm (search via web search snippets), https://developers.hubspot.com/docs/guides/api/crm/properties , https://developers.hubspot.com/docs/api-reference/legacy/crm/properties/groups/create-property , https://developers.hubspot.com/docs/guides/api/crm/engagements/tasks , https://developers.hubspot.com/docs/guides/api/crm/engagements/notes , https://developers.hubspot.com/docs/guides/api/crm/associations/associations-v4

- Note: the HubSpot API reference now lists `/crm/v3/...` under "legacy" and has date-versioned paths (e.g. `/crm/objects/2026-09/contacts/search`). The v3 guides are still current and v3 still works.
- **Batch upsert**: `POST /crm/v3/objects/contacts/batch/upsert`, body `{inputs:[{id:"a@b.com", idProperty:"email", properties:{...}}]}`. VERIFIED
  - `idProperty` must be `email` or a **custom unique-value property** (`hasUniqueValue: true`). **`phone` is not a valid idProperty.**
  - "Partial upserts are not supported when using `email` as the `idProperty` for contacts."
- **Search**: `POST /crm/v3/objects/contacts/search`, body `{filterGroups:[{filters:[{propertyName:"email"|"phone", operator:"EQ", value}]}], properties, limit, after}`. Filters inside a group are combined with AND, and groups are combined with OR. Limits are 5 groups, 6 filters per group and 18 filters in total. `phone` and `mobilephone` are searchable by default. VERIFIED (via official search snippets; the guide URL /guides/api/crm/search returned 404)
- **Custom property**: `POST /crm/v3/properties/contacts` with required `groupName`, `name`, `label`, `type` (`string|number|date|datetime|enumeration|bool`), `fieldType` (`text|textarea|number|date|select|radio|checkbox|booleancheckbox|phonenumber|html|file|calculation_equation`). `hasUniqueValue: true` makes the property unique (max 10 per object). VERIFIED
- **Property group**: `POST /crm/v3/properties/contacts/groups` with `{name, label, displayOrder?}` (-1 puts the group last). Only 201 is documented. Behaviour when the group already exists is not documented, so treat 409 as "exists". VERIFIED (409 not documented)
- **Task**: `POST /crm/v3/objects/tasks`. VERIFIED
  - `hs_timestamp` is **required** (due date).
  - `hs_task_subject` is used but not marked required.
  - `hs_task_priority`: `LOW | MEDIUM | HIGH`
  - `hs_task_status`: documented values `NOT_STARTED | COMPLETED`. The docs' own example uses `WAITING`.
  - `hs_task_type`: `EMAIL | CALL | TODO`
- **Note**: `POST /crm/v3/objects/notes`. `hs_timestamp` is **required**; `hs_note_body` is limited to 65,536 chars. VERIFIED
- **Associations in the create call**: `associations:[{to:{id:<contactId>}, types:[{associationCategory:"HUBSPOT_DEFINED", associationTypeId:N}]}]`. VERIFIED
  - **Note→contact = 202**, **Task→contact = 204** (contact→note 201, contact→task 203). VERIFIED (associations v4 default table)
- **Private app scopes**: `crm.objects.contacts.read` and `crm.objects.contacts.write` (the tasks and notes guides list these). For properties and groups: `crm.schemas.contacts.write` (plus `crm.schemas.contacts.read` to read). VERIFIED

## 4. Resend

Sources: https://resend.com/docs/api-reference/emails/send-email , https://resend.com/docs/dashboard/emails/idempotency-keys

- **Send**: `resend.emails.send({ from, to, subject, html, text, replyTo, cc, bcc, tags, headers, scheduledAt, ... })`. VERIFIED
  - The Node SDK uses **`replyTo`**; REST uses `reply_to`. `to` is a string or array (max 50).
  - The call returns `{ data, error }` (`data.id`). Check `error`; don't rely on a throw.
  - `headers` in the payload = **custom email (MIME) headers**, not HTTP request headers.
- **Idempotency**: HTTP header `Idempotency-Key` (SMTP uses `Resend-Idempotency-Key`). VERIFIED
  - Node SDK: **second options arg**: `resend.emails.send({...}, { idempotencyKey: 'welcome-user/123' })`
  - Key length 1-256 chars, retained 24h. A duplicate returns the original response without resending.
  - Errors:
    - 409 `invalid_idempotent_request`: same key, different payload
    - 409 `concurrent_idempotent_requests`: same key still in flight
    - 400 `invalid_idempotency_key`
  - Supported on `POST /emails` and `/emails/batch`, among others.

## 5. Google Gemini API

Sources: https://ai.google.dev/gemini-api/docs/libraries , https://ai.google.dev/gemini-api/docs/models , https://ai.google.dev/gemini-api/docs/deprecations , https://ai.google.dev/gemini-api/docs/migrate-to-interactions , https://ai.google.dev/gemini-api/docs/generate-content/structured-output , https://ai.google.dev/gemini-api/docs/generate-content/tokens , https://ai.google.dev/api/generate-content

- **SDK**: `@google/genai` (`npm install @google/genai`, `import { GoogleGenAI } from "@google/genai"`). Legacy libraries were "deprecated as of November 30th, 2025". VERIFIED
- **API status**: Google now recommends the **Interactions API** (`client.interactions.create`) for new work. `generateContent` is labelled legacy but "remains fully supported". VERIFIED
- **JSON output with generateContent**: VERIFIED
  - The migration guide (generateContent side) shows `config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, ... } }`. Note this uses the SDK **`Type` enum** (OpenAPI-subset schema).
  - The current generateContent structured-output page instead shows `config: { responseFormat: { text: { mimeType: "application/json", schema: <JSON Schema> } } }`, then `JSON.parse(response.text)`.
  - `responseJsonSchema` appears only in the Go example (`ResponseJsonSchema`), not in the JS docs. PARTIALLY VERIFIED
- **Token usage**: `response.usageMetadata.{promptTokenCount, candidatesTokenCount, totalTokenCount, thoughtsTokenCount, cachedContentTokenCount, toolUsePromptTokenCount}`. The Interactions API uses `interaction.usage.total_input_tokens` and similar fields instead. VERIFIED
- **Recommended low-cost, fast, non-deprecated model**: **`gemini-3.5-flash-lite`** (stable, "Our fastest, most cost-effective 3.5 model"; released Jul 21 2026; no shutdown date). VERIFIED
  - Avoid:
    - `gemini-2.0-flash` and `gemini-2.0-flash-lite`: shut down Jun 1 2026
    - `gemini-3.1-flash-lite-preview`: shut down
    - `gemini-3.1-flash-lite`: shutdown May 7 2027, replacement `gemini-3.5-flash-lite`
    - `gemini-2.5-*`: not deprecated, but access is limited to prior users
  - The flagship Flash model is `gemini-3.8-flash`.

## Implications for the code

1. **Vaani signature**: the assumption matches. Requirements:
   - Read `await req.text()` before parsing.
   - Compare the full `sha256=<lowercase hex>` string with `timingSafeEqual` (check lengths first).
   - De-dupe on envelope `id`.
   - Return 2xx fast (10s per attempt). **5 consecutive failures auto-disable the webhook**, so don't 500 on bad payloads.
   - Accept `webhook.ping`.
2. **Vaani `call.completed` data is undocumented and phone numbers are masked.**
   - Don't hard-require transcript, summary or caller number; parse defensively.
   - There is **no REST endpoint** to fetch a transcript or summary by call id.
   - Matching a HubSpot contact by caller phone may be impossible with a masked number.
   - `usage.charged` fields are undocumented. Documented costs are integer **paise** (`cost_paise`).
3. **Calendly POST /invitees**: the assumed body is valid, with these additions:
   - `name` OR `first_name` is required.
   - **Omit `location` for round-robin event types.** Otherwise it must match the event type, or be omitted if the event type has none.
   - It needs a paid plan (Standard+); free plans get 403. It needs scope `scheduled_events:write`.
   - The availability window is **31 days**, not 7.
   - The host is not in the POST response. GET `resource.event` and read `event_memberships[].user_email/user_name`.
   - **Calendly sends its own confirmation emails and calendar invites**, so a Resend confirmation would duplicate them.
4. **HubSpot**:
   - HIGH/MEDIUM/LOW and association ids 202 (note→contact) and 204 (task→contact) are correct. Use `associationCategory: "HUBSPOT_DEFINED"`.
   - **`hs_timestamp` is required** on both tasks and notes.
   - `hs_task_status` documented values are `NOT_STARTED`/`COMPLETED`.
   - **Phone cannot be an upsert `idProperty`**: upsert by `email`, or search by phone first.
5. **Resend: MISMATCH.** `headers: {"Idempotency-Key": ...}` inside the email payload sets a MIME header on the email, so it gives **no idempotency**.
   - Use `resend.emails.send(payload, { idempotencyKey })`.
   - The key must be ≤256 chars. Reusing a key with a different payload gives 409.
6. **Gemini**:
   - The assumed call shape (`responseMimeType` + `responseSchema`) is still documented and works. It is "legacy" but fully supported.
   - `responseSchema` uses the OpenAPI-subset `Type` enum. To pass plain JSON Schema, use `responseFormat: {text:{mimeType, schema}}` (or `responseJsonSchema`).
   - **Set the model to `gemini-3.5-flash-lite`.** Do not use any `gemini-2.0-*` or `*-preview` id.
   - Read cost from `usageMetadata.promptTokenCount/candidatesTokenCount/thoughtsTokenCount/totalTokenCount`.
