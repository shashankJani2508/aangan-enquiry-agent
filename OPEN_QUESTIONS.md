# Open questions (answer in one pass; my proposed default in brackets)

## Blocking right now
- **Q-GEM-1 Gemini key.** The key provided is rejected by both the Gemini API and Vertex AI (401 ACCESS_TOKEN_TYPE_UNSUPPORTED). Need an AI Studio key (starts `AIza`) from https://aistudio.google.com/apikey. Then run `npm run eval:transcripts`. [none: blocked]
- **Q-GEM-2 Model.** You chose `gemini-3.5-flash` (set). API check says `gemini-3.5-flash-lite` is the cheapest current stable. [keep 3.5-flash until eval shows lite agrees as well]
- **Q-DB-1 Neon.** Need `DATABASE_URL`, then `npm run db:migrate`. [none: blocked]

## Vaani (brief 4.1-4.5, 9)
- **Q-VAA-1** Vaani's docs list NO fields for `call.completed` (no transcript, summary or caller number documented) and say numbers are masked; no REST endpoint to fetch a transcript was found. `src/lib/vaani.ts` guesses several field paths and records which matched. Need one real test call. [build against real payload]
- **Q-VAA-2** If the number is masked, lead is flagged needs_review and repeat-caller matching is off. Brief 18 says "no usable phone -> Medium". I only flag it (not force Medium), because with masking EVERY lead would become Medium. [flag only; confirm]
- **Q-VAA-3** Is Vaani's own HubSpot integration / `lead.created` switched off? [must be off; our backend is the only writer]
- **Q-VAA-4** Do all calls reach Vaani or only after-hours/unanswered? [backend works either way]

## Calendly (10)
- **Q-CAL-1** Plan (Standard+ needed for POST /invitees) and the event type URI. Round-robin works via API if `location` is omitted (`CALENDLY_LOCATION_JSON` empty).
- **Q-CAL-2** Availability window used: next 7 days. [7; API allows 31]
- **Q-CAL-3** Calendly sends its own confirmation email to the invitee, so our Resend caller email duplicates it. Options: (a) turn off Calendly invitee notifications for this event type and keep ours (brief 11), (b) drop ours. [a]

## HubSpot (12)
- **Q-HS-1** Plan; contact-only vs contact+deal vs Leads object. Built: contact + custom properties (`aangan_*`) + notes + tasks. [contact only]
- **Q-HS-2** Conversion detection: polling every 5 min via the sweeper (needs Vercel Pro for 5-min cron; Hobby allows only daily). [Pro, or an external cron hitting /api/cron/sweeper]
- **Q-HS-3** Task owner rule (`HUBSPOT_TASK_OWNER_ID`) and which property to read back (`hs_lead_status` default).
- **Q-HS-4** Property setup script not written yet; property list is in `src/lib/hubspot.ts` (P). Approve the list first.

## Resend / addresses / logins (4.10-4.12)
- Sending domain + from address; FRONT_DESK_EMAILS, QUALIFIED_FALLBACK_EMAILS, OPS_ALERT_EMAIL; DASHBOARD_USERS (Nikhil founder, Shashank admin).

## Rubric / business
- **Q-RUB-1** `min_weeks_to_ready` = 8 (R4). Nikhil to confirm.
- **Q-RUB-2** `no_content_min_caller_words` = 5 (what counts as an empty call). I made this number up as a visible TODO.
- **Q-RUB-3** area_basis: when the caller gives built-up or unspecified area, the estimator uses it as-is (eval labels did the same for T02, T12). [as-is, flagged in basis]
- **Q-RUB-4** Final field list and enums in `src/lib/lead-schema.ts` are a proposal (brief 7).
- **Q-COST** All vendor rates and fixed costs are null (dashboard shows the "Cost may be understated" banner).

## From the training-pack review (see VAANI_TRAINING_PACK.md Part 2)
- Greeting, budget question(s), agent name and voice; native reviewer for Hindi/Marathi; decline a full redesign that also moves a wall?; take email if a declined caller volunteers it?; restore the "wrong number" edge case?
