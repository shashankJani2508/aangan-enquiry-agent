# Aangan Studio phone enquiry agent: build brief for Claude Code (v4)

Owner: Shashank (human in the loop). Business owner: Nikhil Deshpande, founder, Aangan Studio, Pune.
This brief replaces v3. It follows the latest components map (`aangan-components-map-updated.png`) and the context files now provided. Read the whole brief before writing any code. Start with Milestone 0 (section 17) and stop there.

Two things are built from this one brief:
1. **The backend and the founder dashboard** (sections 5 to 15).
2. **The Vaani training pack**, the one-time context that trains the voice agent. A draft (draft 2), `VAANI_TRAINING_PACK.md`, is provided with this brief. You review and complete it (section 16).

Also provided: `eval-proposed-labels.md`, my proposed sorting of the 40 enquiries, for you to test the Gemini step against (section 17, M3).

---

## 0. Working rules

1. **No guessing.** If something is missing, unclear or contradictory, write it in `OPEN_QUESTIONS.md` and ask me. Placeholders must be visible: `TODO(owner): ...`. Never invent prices, rates, limits, field names, payload shapes or business rules.
2. **Business facts come only from files.** Every fact about the studio must trace to a file in `context/` or to section 2 of this brief. If it cannot be traced, mark it `TODO(source)` and ask. Facts that appear only in a transcript (for example something a front desk person said) are examples of behaviour, not rules, unless a context file confirms them.
3. **Verify every third-party API against its current official docs** before using it. Field names in this brief are hints, not facts.
   - Vaani Labs: https://vaanilabs.in/docs. API reference at https://vaanilabs.in/docs/api, webhooks at https://vaanilabs.in/docs/api/webhooks, OpenAPI 3.1 spec at https://vaanilabs.in/openapi/v1/vaanivoice.yaml, and an MCP server (`npx -y vaanivoice-mcp`).
   - Calendly: https://developer.calendly.com (append `/llms.txt` to a URL for an index, or `.md` for markdown).
   - Also the official docs for HubSpot, Resend, Neon, Vercel and the Google Gemini API.
4. **Milestones with checkpoints.** At every CHECKPOINT, stop and tell me what you built, what you verified (and how), and what you could not verify. Wait for my reply before continuing.
5. **Secrets** live only in environment variables. Provide `.env.example`. Never commit secrets. Never log secrets, full phone numbers or emails.
6. **Scope.** Inbound phone calls only. Don't add features that are not in this brief; put ideas in `IDEAS.md`.
7. **Tests** for every routing or money-relevant decision: thresholds and their exact boundaries, fallbacks, idempotency.
8. **Ask early, in batches.** At every checkpoint, list your open questions in `OPEN_QUESTIONS.md` with your proposed default for each, so I can answer them in one pass.
9. **Where a file and section 2 disagree, follow section 2** and list the conflict for me. Section 3 records how the files and our decisions were reconciled; all of those are settled.

---

## 1. What we are building and why

Aangan Studio is an interior design studio in Pune (about 60 people, 14 designers). Enquiries arrive by phone, WhatsApp and a website form. The front desk is two people covering 10 am to 7 pm, and they work in HubSpot.

Nikhil's own numbers:
- about 200 enquiries a month
- about a third arrive outside 10 am to 7 pm
- an enquiry answered within an hour converts about 4x as often as one answered the next day
- about 48% get no response within 48 hours
- average project value is 8 to 14 lakh rupees

**Goal:** every phone enquiry is answered immediately, at any hour, by a voice agent. After the call, Gemini decides whether the lead is Qualified or Unqualified (High, Medium or Low probability of conversion) and writes the brief. Qualified leads are booked straight into a designer's calendar. Every lead is recorded in HubSpot for the front desk. The founder sees everything on one dashboard, including what the system costs to run.

**Scope:** inbound phone only. WhatsApp and the web form are out of scope for the build, but keep the data model channel-agnostic (a `channel` column, default `phone`) so they can be added later. The WhatsApp and web form enquiries are used only as extra test data.

**Stack** (my choice; challenge it in PLAN.md only if you have a strong reason): Next.js (App Router, TypeScript) on Vercel; Neon Postgres; Vaani Labs (the voice agent); Google Gemini API; Resend (email); Calendly API (booking); HubSpot (the front desk's CRM; we write into it and read status back).

**Context files, in `./context/`** (keep out of git):
- `services.md`: what the studio does and does not do, the service area (named localities in Pune city and PCMC), typical project scope, and timelines.
- `qualified.md`: Nikhil's own rubric for which enquiries are worth a designer's time: five criteria, what happens at the boundary, what does not disqualify.
- `pricing.md`: the internal pricing guide, indicative only. It also contains the rules for what the agent must never say about price, and the one acceptable reply to a pricing question.
- `Aangan_Sep_2026_Enquiries.pdf`: 40 anonymised enquiries from September 2026: T01 to T20 phone calls, W01 to W10 WhatsApp threads, F01 to F10 web form submissions. They are in English; W03 is Hindi in Roman script; no Marathi appears. Convert each enquiry into its own text file under `context/enquiries/`.
- The MESA case pre-read, for background only.

---

## 2. Decisions already made (do not re-open)

**On the call**
1. The agent never states a price, per-square-foot rate, range or ballpark. It never confirms or denies a figure the caller suggests. It may ask the caller's budget. If asked about price, it gives the one reply that `pricing.md` allows, with the booking offer replaced (section 3, R6). It may say the consultation is free.
2. The agent never tells the caller they are Qualified or Unqualified, and never mentions tiers, thresholds, priority or scoring. This is internal.
3. **Nikhil's rubric (`qualified.md`) is the bible for fit.** The agent declines kindly, warmly and honestly, using Nikhil's decline sentence, in these cases only:
   - (a) it is not a real project: ideas or advice only, a consultation only, the caller will do the execution themselves, decor or styling only, or something the studio does not do (section 6.1);
   - (b) the site is outside Pune city and PCMC;
   - (c) the project is a restaurant, hotel, retail store or gym;
   - (d) the caller needs the project complete in under 8 weeks;
   - (e) the caller states a total budget of ₹2 lakh or less. The agent may say kindly that the budget looks too low for the scope. It never says a number.

   It never declines for any other reason, and never because no budget was given.
4. A declined caller is **not** asked for an email or a phone number. The agent says the decline sentence and ends the call.
5. Every caller who is not declined hears one closing line: "Thank you, I've noted your details and passed them to our team." The agent never promises a designer call, a callback, a time or a person, because the sorting happens after the call.
6. No recording, AI or privacy line on the call or in emails (owner's decision). The agent never claims to be human: if a caller sincerely asks whether they are speaking to a person or an AI, it answers honestly and continues.
7. No transfer of calls to a person. The agent handles every call itself.
8. The agent picks up the caller's phone number automatically (caller ID) and never asks for it. It asks for the email at the end of the call, not the beginning, and only from callers who are not declined.
9. The agent is trained once with the context (section 16). Training is a one-time setup, not part of every call.

**After the call**
10. Vaani gives us the whole transcript (not the recording) and its own summary brief. Gemini gets both and writes the brief by our rubric. No audio is downloaded or stored.
11. Two groups: **Qualified** and **Unqualified**. Unqualified has three tiers by probability of conversion: **High**, **Medium** and **Low**. There is no separate "needs review" tier: such leads are Medium, flagged.
12. **Gemini decides** the group and tier, using the rubric (section 6) and the internal pricing guide. Our code carries out the decision. A lead that fails the fit check is Unqualified, Low, with the reason written on it.
13. Budget is decided by our workflow after the call, not by the agent: the stated budget, or an aggressive estimate (the high end of the range) from the pricing guide. Qualified starts at ₹8 lakh.
14. If there is no budget and no usable detail, or the designed area of a partial home is unknown, the lead is Unqualified, Medium, flagged `needs_review`.
15. Qualified leads go straight to a designer and are booked automatically into the next free slot. The caller does not choose a slot. Giving their email on the call is the caller's go-ahead: book without any further confirmation step.
16. **Every lead is recorded in HubSpot**, with its tier (Qualified, High, Medium, Low). The front desk finds its leads by tier. High and Medium get a call task. Qualified and Low get no call task.
17. When the front desk converts an Unqualified High or Medium lead (they update the budget and tick "send to designer"), it **counts as Qualified, with no re-check**. Calendly books, and Resend emails the designer and the caller.
18. There is no front desk dashboard. They use HubSpot.

**Records and views**
19. Neon saves everything listed in section 14 so the system can always say what happened.
20. Email (Resend) is the record for designers. HubSpot is the record for the front desk. No Telegram.
21. One dashboard (the founder's), live on Vercel, reading only from Neon, plus a small outcome page for designers.
22. Existing clients, vendors and other non-enquiry callers are out of scope. Forget them: no code, no flag, no test.

---

## 3. How the files and our decisions were reconciled (all settled)

These came up when the context files were read against our chat. Each is now decided. Build each as a setting where you can, so it is cheap to change.

| # | Topic | What the files say | What we decided |
|---|---|---|---|
| R1 | Budget | `qualified.md`: "Don't quote. Don't probe." and "If budget is not mentioned, treat as qualified." | Our way. The agent asks the budget once, softly, and never pushes. The budget is decided after the call: the stated budget, otherwise the aggressive estimate. No budget and no usable detail, or a partial home whose designed area is unknown (section 8.2): Medium with `needs_review`, so the front desk calls |
| R2 | Fit check | `qualified.md` has five criteria. A lead should pass all five | Nikhil's rubric is the bible. The fit check comes first (section 6.1). One failed criterion is enough to decline. Failing it makes the lead Unqualified, Low, whatever the budget. Example: F03 offers ₹15 to 20 lakh but the site is in Talegaon, which `services.md` says we do not serve |
| R3 | What the caller is told | `qualified.md` says decline gracefully. The transcripts T03, T04, T10, T19 and W07 do so | The agent declines only in the cases in section 2, item 3, kindly and professionally, with Nikhil's sentence: "This sounds like it may not be the right fit for us right now — but feel free to reach out if your timeline or scope changes." No email or phone is asked. It never declines otherwise |
| R4 | Timeline | `services.md`: cannot begin execution on a project that must be ready in under 6 weeks; design 3 to 4 weeks, execution 8 to 16 weeks. `qualified.md`: the site must be available for execution within 8 to 10 weeks of the consultation; 3 weeks is too short. T07 says 8 to 10 weeks start to finish | Follow Nikhil's rubric. Decline when the caller needs the project complete in under 8 weeks (setting `min_weeks_to_ready`, default 8, the low end of 8 to 10). Between 8 and 10 weeks: pass, and note the tight timeline. Nikhil to confirm the exact number (section 4, item 15) |
| R5 | One or two failures | `qualified.md`: "If it fails one, close gracefully" near the top and "Two or more criteria fail: decline gracefully" near the bottom | One failed criterion is enough. The transcripts show single-criterion failures being declined |
| R6 | Price reply | `pricing.md`: the only acceptable reply ends "I can book that for you right now if you'd like." | Use the reply without the last sentence and add "I'll note your details for the team." The agent may say the consultation is free (T02, T13 and W02 say so; owner decision) |
| R7 | The 8 lakh line | `pricing.md` implies a 950 sq ft 2BHK is about ₹17 to 23 lakh. The case says the average project is ₹8 to 14 lakh | Keep ₹8 lakh as a setting. The owner said not to worry about it |
| R8 | Single room | `pricing.md`: ₹3.5 to 8 lakh all-in | Estimate at the high end, 8 lakh, so a single room is Qualified |
| R9 | Offices | `services.md`: up to about 3,000 sq ft, no minimum. T18's front desk says "typically 500 sq ft or more" | Follow the rubric: no minimum is applied. A 180 sq ft pod is sorted by value (about ₹3.2 lakh, Medium). An office above about 3,000 sq ft is "unclear": Medium with `needs_review` |
| R10 | Existing clients | T09 is an existing-client complaint. T16 and W08 are new enquiries whose earlier message went unanswered | Existing clients are out of scope: no code, no flag, no test. T16 and W08 are normal leads |
| R11 | Closing line | | One line for every caller who is not declined: "Thank you, I've noted your details and passed them to our team." No designer promise |
| R12 | Languages | The files say nothing about language. The transcripts are English and Hindi in Roman script (W03) | The agent speaks the caller's language. No Hindi or Marathi wording is written without native review |

---

## 4. Open items (confirm in Milestone 0; build as settings with the default shown)

| # | Item | Default until I answer |
|---|---|---|
| 1 | Phone number: how we get the full number | Caller ID. Vaani's public webhooks page says numbers in event `data` are masked; the owner believes they are not for our account. The first test call settles it (section 9) |
| 2 | If the number cannot be detected, does the agent ask at the end together with the email? | Not decided. Do not make the agent ask until I say |
| 3 | Vaani: what the `call.completed` event actually carries (transcript, summary brief, fields) | Inspect real payloads from a test call that I will arrange |
| 4 | Vaani: our account, the inbound phone agent, the number's telephony (Vaani's quickstart mentions Twilio), whether all calls or only after-hours and unanswered calls reach the agent | Ask me |
| 5 | Vaani: its docs list a HubSpot CRM integration and a `lead.created` event. Is either switched on? | Our backend is the only writer to HubSpot |
| 6 | Agent name, voice, and greeting | The transcripts show the front desk answering "Good morning, Aangan Studio." and "Good afternoon, Aangan Studio." Proposed greeting: "Good morning / afternoon / evening, Aangan Studio." Name and voice: `TODO(owner)` |
| 7 | The owner's "particular questions" for getting a sense of the budget | `TODO(owner)` |
| 8 | HubSpot: our plan; which object the front desk works from (contact only, contact plus deal, or the Leads object); pipeline and stage; who owns new tasks; how "send to designer" is detected | Propose in PLAN.md; webhook if our plan supports it, otherwise polling every few minutes |
| 9 | Calendly: our plan; whether team round-robin event types can be booked through the API; which designers take qualified leads; meeting length and location type | Verify; propose a fallback if not |
| 10 | Resend: sending domain and from address | Ask me |
| 11 | Addresses: `FRONT_DESK_EMAILS` (fallback only), `QUALIFIED_FALLBACK_EMAILS`, `OPS_ALERT_EMAIL` | Ask me |
| 12 | Dashboard logins: which emails (Nikhil, me) | Ask me |
| 13 | Working days | Monday to Saturday, 10:00 to 19:00 IST |
| 14 | Reason lists (section 13.2) | Generic defaults shown there, to confirm with Nikhil |
| 15 | Spec tier the estimator assumes when the caller gives no cues | The lowest tier (Standard residential, Basic fitout commercial), at its high end (section 8.2) |
| 16 | `min_weeks_to_ready`: the exact timeline cut-off | 8 weeks (R4). Nikhil to confirm |
| 17 | Transcript retention | Keep |

---

## 5. Workflow (final, matches the map)

1. A caller dials the studio number. Vaani's voice agent answers at any hour, in the caller's language.
2. The agent, trained once with the context (section 16), asks the enquiry questions. It picks up the phone number itself and never asks for it. If the case fails Nikhil's criteria or the caller states a budget of ₹2 lakh or less, it declines kindly and ends the call without asking for an email. Otherwise it asks for the email at the end and says the closing line. It never reveals the tier.
3. When the call ends, Vaani sends a signed `call.completed` event to our backend (section 9). We expect it to carry the whole transcript and Vaani's summary brief, and no recording. Verify this in the first test call.
4. The backend verifies the signature, de-duplicates by event id, and saves the transcript, Vaani's summary brief and the call metadata in Neon.
5. Gemini reads the transcript and Vaani's summary brief, with the rubric (section 6) and the internal pricing guide. It runs the fit check, works out the value, decides the group and tier, and writes the brief by our rubric. The decision and brief are saved in Neon. Code re-checks the thresholds.
6. Our code carries out the decision immediately and idempotently:
   - **Qualified:** book the next free designer slot in Calendly (section 10); Resend emails the designer the brief and the caller the booked time (section 11); record the lead in HubSpot with tier Qualified and no call task.
   - **Unqualified, High or Medium:** record the lead in HubSpot with the brief note and a call task for the front desk.
   - **Unqualified, Low:** record the lead in HubSpot with no call task.
7. The front desk works its leads in HubSpot, filtered by tier. If a lead converts, they update the budget and tick "send to designer". The backend detects it, counts the lead as Qualified (no re-check), changes the HubSpot tier, books the designer in Calendly, and Resend emails the designer and the caller (section 12.4).
8. Designers record the outcome through a signed link in their email: met, won, lost or cancelled, with a reason (section 13.2). It is saved in Neon.
9. Everything is saved in Neon (section 14). The founder dashboard, live on Vercel, reads only from Neon. Front desk status is read back from HubSpot into Neon on a schedule.
10. A scheduled sweeper retries stuck steps, handles `call.failed` and missing events, and polls HubSpot if webhooks are not available.

Neon is storage only. A backend sits between Vaani, Neon, Gemini, Calendly, Resend and HubSpot. It is the wiring: an AI model cannot press buttons in Calendly or HubSpot, so this code performs each action once Gemini has decided. `processLead` must be callable from the webhook handler, the HubSpot conversion trigger and the sweeper without double-booking, double-emailing or creating duplicate HubSpot tasks.

---

## 6. Rubric (stored as settings, not hard-coded)

The rubric has two steps. Gemini applies both. Thresholds and criteria must be editable by the founder on a settings page, and every change is audit-logged.

### 6.1 Step 1: the fit check (Nikhil's rubric, the bible)

Source: `qualified.md` and `services.md`. Gemini checks each criterion and returns pass, fail or unclear, with a short supporting quote from the transcript. The agent applies the same criteria on the call.

| # | Criterion | Fails when | Unclear when |
|---|---|---|---|
| 1 | Real project: design and execution | The caller wants ideas only or advice only ("just looking for ideas", "just exploring", "can you come and advise"), a consultation only or a second opinion; will do the execution themselves; wants decor or styling only; standalone furniture sourcing; Vastu advice only; architecture or structural work (all named in `services.md` or `qualified.md`). Also the project is a restaurant, hotel, retail store or gym | The caller has not said what they want |
| 2 | In the service area: Pune city or PCMC | The site is outside. `services.md` lists the localities (Pune city "and adjoining areas"; PCMC: Pimpri, Chinchwad, Pimple Saudagar, Pimple Nilakh, Ravet, Hinjewadi) and names Talegaon, Lonavala, Nashik and Mumbai as not served | The location is not stated, or the locality is not on the list and it is unclear whether it is in Pune city or PCMC. The agent asks one direct question |
| 3 | Realistic timeline | The caller needs the project complete in under 8 weeks (setting `min_weeks_to_ready`, section 3, R4). The agent asks "When would you need the project complete?" | The timeline is not stated |
| 4 | Budget | The caller states a total budget of ₹2 lakh or less (the Low tier, section 6.2). The agent may say kindly that it looks too low for the scope, and never says a number | Never fails on a missing budget. Never probe. No decline for any other budget |
| 5 | Decision-maker on the call, or represented | Never fails | Unclear: do not push; note the uncertainty in the brief |

**What does not disqualify** (`qualified.md`): not knowing exactly what they want; calling outside office hours; asking for pricing; being unsure about materials, style or layout; a single room project; a rented apartment with no structural changes. Also not disqualifying: no budget given, and any budget above ₹2 lakh.

**Outcome of the fit check**
- Fails 1, 2, 3 or 4 (one is enough, section 3, R5): Unqualified, **Low** (not a fit), whatever the value. Write the reason on the lead (`not_a_fit_reason`, for example "outside service area"). On the call, the agent declines kindly and does not ask for an email or a phone number.
- Between 8 and 10 weeks: pass, and note the tight timeline in the brief.
- Unclear on 1, 2 or 3 after the call: Unqualified, **Medium**, flag `needs_review`. (On the call, the agent asks one direct question about each unclear item; that is in the training pack.)
- Unclear on 4 or 5: treat as passing and note it.
- Passes: go to the value bands.

### 6.2 Step 2: the value bands

"Value" means project value in rupees divided by 100,000 (lakh).

| Group | Tier | Rule on value | In HubSpot |
|---|---|---|---|
| Qualified | `qualified` | value >= 8, or converted by the front desk | Record, tier Qualified, booking note. No call task (the designer handles it) |
| Unqualified | `high` | 5 <= value < 8 | Record, brief note, call task (high priority) |
| Unqualified | `medium` | 2 < value < 5; also no budget and no usable detail, an incomplete call, or an unclear fit (flag `needs_review`) | Record, brief note, call task |
| Unqualified | `low` | value <= 2; or the fit check failed | Record only, tier Low. No call task |

**Which value is used**
1. If the caller stated a budget (a number or a range), use it, with source `stated`.
2. Otherwise use the internal estimate (section 8.2), with source `estimated`.
3. If neither exists, the lead is `medium` with `needs_review`. Never rate a lead Low on unknown value.
4. Use the upper end of any range. Estimates are aggressive: use the high end of the estimator's range. The costly mistake is silently losing a good lead.
5. If Gemini is not sure about the budget it heard (for example "8 lakh" or "18 lakh" on a noisy line), use the higher reading and flag it (section 8.3).
6. Where both a stated budget and an estimate exist, store both and show both. The tier follows the stated budget.

**Boundary tests (required):** 8.0 -> qualified; 7.99 -> high; 5.0 -> high; 4.99 -> medium; 2.01 -> medium; 2.0 -> low; stated range 1 to 2 -> low; stated range 2 to 3 -> medium; stated range 6 to 9 -> qualified; no budget and no usable estimate -> medium with `needs_review`; front desk converts a High lead with a new budget of 3 lakh -> qualified; fit check fails on service area with a stated budget of 20 lakh -> low; fit check fails on timeline (3 weeks) with a stated budget of 4 to 5 lakh -> low.

**Working hours:** 10:00 to 19:00 Asia/Kolkata. Working days per section 4.

---

## 7. The lead brief: fields to capture and store

One schema file (Zod) is the single source of truth for: the field list given to the Vaani training pack, request validation, the database columns, and the email, HubSpot and dashboard rendering. All fields except identity may be missing; a missing field is shown as "Not stated", never inferred. The field list follows the existing web form (Name, Phone, Email, Project type, Location, Carpet area, Current state, Timeline, Budget, How did you find us, Notes), plus what `qualified.md` needs.

| Field | Notes |
|---|---|
| `caller_name` | |
| `phone` | The agent does not ask for it. Take it from caller ID (see section 9 for the masking question). Store the full number as received |
| `email` | Asked at the end of the call, spelled back and confirmed. Required for auto-booking |
| `language` | The language(s) the caller used, as detected |
| `property_type` | Enum derived from `services.md` (apartment, independent house, villa, office, clinic, studio, other) and `pricing.md` |
| `city`, `locality_or_project` | Needed for the service-area criterion |
| `area_sqft` and `area_basis` | `carpet`, `built_up`, `unknown`. `pricing.md` prices carpet area of the designed space |
| `designed_space` | Which rooms or spaces the work covers (full home, a floor, named rooms), and the carpet area of those spaces if known. Needed for the estimate on partial homes |
| `configuration` | e.g. "3 BHK" or number of rooms (free text) |
| `scope_summary` and `scope_type` | `scope_type`: full home, partial home (2+ rooms), single room, office fitout, other |
| `design_and_execution` | Whether the caller wants design with execution (criterion 1) |
| `work_type` | `new`, `renovation`, `unknown` |
| `current_state` | From the web form: possession date, bare shell, moved in, rented, and so on |
| `budget_min_inr`, `budget_max_inr`, `budget_phrase` | Nullable; keep the caller's own words |
| `timeline` | Free text, and the date the caller needs the project ready, if given (criterion 3) |
| `decision_maker` | Self, with a spouse or family who have authorised it, researching for someone else, or unknown (criterion 5) |
| `heard_about_us` and `referrer` | Referrals are common in the transcripts (a friend, a past client, a builder). Keep the referrer's name if volunteered |
| `caller_questions` | List of things the caller asked |
| `agent_said` | List of anything the agent told the caller |
| `notes` | |

The "priority answers" a designer needs must come from `qualified.md`, the web form fields and the transcripts. In Milestone 0, propose the final list and enums. Do not finalize them without me.

---

## 8. Gemini: the decision and the brief

**8.1 Who decides what.** Gemini decides the group and tier, using the rubric in section 6. To keep it reliable:
- Code gives Gemini the caller's stated budget and, when there is none, the internal estimate (8.2).
- Gemini returns the fit check results, the tier, the value it used and its source, and a one-line reason.
- Code re-checks that the tier matches the rules for those results and that value. If it does not, the rules win, and the discrepancy is flagged and shown on the founder dashboard.
- If Gemini fails or times out after retries, the lead is `medium` with `needs_review` and a note "AI decision unavailable", so it still reaches the front desk.

**8.2 Internal value estimate** (only when no budget was stated; never spoken or emailed to the caller). Build `pricing.config.json` from `pricing.md`, which says:

| Type | Indicative range |
|---|---|
| Residential, Standard specification | ₹1,800 to ₹2,400 per sq ft |
| Residential, Premium specification | ₹2,400 to ₹3,500 per sq ft |
| Residential, Luxury specification | ₹3,500+ per sq ft (no upper bound) |
| Residential, single room redesign, all-in | ₹3.5 lakh to ₹8 lakh |
| Commercial, Basic fitout | ₹1,200 to ₹1,800 per sq ft |
| Commercial, Mid-range office | ₹1,800 to ₹2,800 per sq ft |
| Commercial, Premium office | ₹2,800 to ₹4,000 per sq ft |

`pricing.md`: "Sq ft refers to carpet area of designed space, not built-up area." It also says the guide is indicative only and that no number from it should be quoted to a client.

Rules for the estimator:
- Estimate aggressively, not conservatively: use the high end of the range.
- Spec tier: use the lowest tier (Standard, or Basic fitout) unless the caller signals a higher one. Its high end is ₹2,400 per sq ft residential, ₹1,800 per sq ft commercial (section 4, item 16). Luxury has no upper bound, so a Luxury cue gives "unknown", not a number.
- Full home: the designed area is the flat's carpet area.
- Single room: use the single-room range; the high end is 8 lakh.
- Partial home (two or more rooms or a floor): `pricing.md` has no all-in figure. Use the carpet area of the designed spaces if the caller gave it; if not, the estimate is "unknown".
- If there is not enough detail (no property type, no area), return "unknown" rather than guessing.
- CHECKPOINT: show me the extracted table and the rules before you build on them.
- It is indicative only, so label it "Internal estimate" everywhere it appears.

**8.3 The Gemini task** (once per lead, after the call ends):
- Input: the transcript, Vaani's summary brief, any fields Vaani delivered, the rubric (section 6), the estimate (if any), and a short summary of `services.md`.
- Output: JSON validated against a schema: normalised fields; `criteria` (the five fit criteria, each pass, fail or unclear, with a quote); `not_a_fit_reason`; value used and source; group and tier; `needs_review`; reason; `uncertain_numbers` (any budget, area, phone or email it is not sure it heard correctly, with the reason); `discrepancies` between the transcript and Vaani's summary; and the brief (a three-line summary, key facts, what the caller asked, what the agent said, and open questions for the designer or front desk).
- The transcript is the primary evidence. Vaani's summary is a cross-check. If they disagree, trust the transcript, flag the difference and show both.
- Every statement must come from the transcript or Vaani's summary. Anything not said is written "Not stated". No inference, no embellishment.
- Callers may speak Hindi, Marathi, English or a mix. Transcripts may mishear numbers. Gemini flags any number it is unsure of. Briefs are written in English.
- Use Google's current official Gen AI SDK for TypeScript with JSON output and a response schema (check current parameters). Model name comes from `GEMINI_MODEL`; pick a current, low-cost, fast model from the official docs, tell me which and why, and do not use deprecated models.
- If Gemini fails, still produce a brief from Vaani's summary and any structured fields, marked "AI brief unavailable".

**8.4 One-line status** used on the dashboard is built from a template over fields (tier, value and source, property, area, locality, current status). It is not written by an LLM.

---

## 9. Vaani Labs integration

Verified from Vaani Labs' docs (https://vaanilabs.in/docs/api/webhooks); re-check before building:
- Webhooks are registered **by me in the Vaani dashboard** (an HTTPS URL plus the events to receive). They are created from the logged-in dashboard session, not with an API key. The signing secret (`vv_whk_...`) is shown once; I will put it in `VAANI_WEBHOOK_SECRET`.
- Events documented as live: `call.completed`, `call.failed`, `lead.created`, `usage.charged`, `meeting.ended`. Start with `call.completed` and `call.failed`. Consider `usage.charged` for cost tracking (section 15). Use `lead.created` only if it helps; see the HubSpot note below.
- Delivery is **asynchronous and after the event**: an HTTPS POST with a JSON envelope `{ id, type, created, data }` (the id starts `evt_` and is reused across retries) and headers `X-VaaniVoice-Event`, `X-VaaniVoice-Delivery` and `X-VaaniVoice-Signature`.
- Signature: `sha256=` followed by the lowercase hex HMAC-SHA256 of the exact raw request body, keyed with the secret. Read the raw body before parsing JSON, recompute, include the `sha256=` prefix in the comparison, and compare in constant time. Reject anything that does not verify.
- Respond 2xx within 10 seconds and do the real work after responding. Vaani retries with exponential backoff (up to 8 attempts) and auto-disables a webhook after 5 consecutive failures (the owner is emailed). Make the handler idempotent: de-duplicate on the envelope `id` (or the delivery header).
- The docs say no sub-field of `data` is guaranteed, so parse defensively.
- The events listed on that page are described as emitted by "the voice/meeting agents". Confirm in the first test call that our inbound phone agent emits them.

**What we expect the event to carry, and must verify**
- The whole transcript and Vaani's summary brief, and no recording. In Milestone 0, capture real payloads from a test call that I will arrange, store them redacted as fixtures, and build against what you actually see.
- If the event carries only an id, find a documented way to fetch the transcript and summary (check the REST API, the OpenAPI spec and the MCP server). If there is none, stop and ask me.

**The phone number**
- Goal: the agent never asks for the number. We take it from caller ID.
- Vaani's public webhooks page says phone numbers in `data` are masked. The owner believes they are not masked for our account. The first test call settles it.
- If masked, in this order: (a) ask Vaani whether unmasked delivery can be enabled (Vaani lists PII masking as a feature, so there may be a setting); (b) check whether another documented Vaani endpoint returns the caller number; (c) if the studio number runs through our own telephony account, read the caller ID from there (verify how); (d) as a last resort, I decide whether the agent asks for the number at the end together with the email. Do not make the agent ask until I say.

**Other**
- Vaani's docs list a HubSpot CRM integration. If it is switched on for our account it could create duplicate contacts. Our backend is intended to be the only writer to HubSpot; find out and tell me.
- Store the transcript, Vaani's summary brief, ended reason, duration and cost as available. Never download or store audio.
- Replays and out-of-order delivery must be safe.
- How the studio number reaches Vaani (Vaani's quickstart mentions a Twilio number; all calls, or only after hours and unanswered calls) is telephony configuration outside this build. The backend must work either way.
- I set up and train the Vaani agent in the Vaani dashboard, using the training pack (section 16).

---

## 10. Calendly integration

Verified from Calendly's developer docs; re-check before building:
- Booking through the API needs a **paid Calendly plan**. A free plan is reported to get 403. Treat 403 as a configuration error: alert ops and use the fallback.
- Flow: `GET /event_type_available_times` (start and end required, at most 31 days per request; start with a short window), then `POST /invitees` with `event_type`, `start_time` (UTC with trailing Z, must be a currently open slot), and `invitee` (name, email, timezone). `location` is required unless the event type has none. The response includes the scheduled event, `cancel_url` and `reschedule_url`.
- Auth: the account host or admin can use a personal access token for their own organization. Use that; no OAuth app.
- **Email is required to book.** Without a caller email, auto-booking is impossible (see section 18).

Design:
- Owner decision: the caller giving their email on the call is their go-ahead. Book without a further confirmation step and do not add one. The caller email carries the reschedule and cancel links that Calendly returns.
- Booking uses a Calendly event type that I will set up for the designers who take qualified leads. Env: `CALENDLY_EVENT_TYPE_URI`. Pick the earliest available slot. Calendly's own settings (minimum notice, working hours) decide what is available; do not re-implement availability.
- Use timezone `Asia/Kolkata` for the invitee.
- Read the assigned host from the created scheduled event (verify how) so Resend can email the right designer.
- OPEN, verify first: whether `POST /invitees` works with a team round-robin event type, and which Calendly plan includes team round-robin event types (tell me; it may differ from the plan needed for the Scheduling API). If it does not work, propose a fallback (for example query each designer's own event type and take the earliest slot overall) and ask me before building it.
- Errors: 400/404 on a slot just taken means re-query and retry (max 3); 5xx or timeouts mean exponential backoff, then fallback; 401/403 means alert ops and fall back.
- Check whether Calendly also emails the invitee. If it does, tell me and propose how to avoid duplicate confirmation emails.

---

## 11. Emails (Resend)

- A sending domain must be verified (SPF and DKIM) before real sending. Until then, send only to allow-listed test addresses. If Resend supports idempotency keys (check), use `lead_id:email_kind`.
- Plain, mobile-friendly HTML plus a plain-text part. Times shown as weekday, date and time in IST.
- No email ever contains a price, rate or range.
- Emails are sent only for Qualified leads (including converted ones). There is no front desk email: HubSpot is the front desk's record.

**Designer email** (to the assigned designer; reply-to `FRONT_DESK_EMAILS`). Readable in under a minute on a phone:
1. One line: who, what, where, and the booked slot.
2. Decide-now facts: property, size, location, scope, budget as stated, timeline, current state, decision-maker, language. If an internal estimate exists, show it labelled "Internal estimate. Do not share with the client". Show any flagged uncertain numbers and any criterion marked unclear.
3. What the caller asked, and what the agent already told them, so the designer neither repeats questions nor contradicts the agent.
4. To find out on your call: the fields that are "Not stated".
5. Contact: name, tap-to-call phone, email.
6. A signed "Update outcome" link (section 13.2).

**Caller email** (only if an email was captured): greeting by name; what was arranged (designer first name, time in IST); the reschedule and cancel links from Calendly. Nothing else.

**Fallback email** (only if the HubSpot push fails after retries, or a qualified lead cannot be booked): the brief to `FRONT_DESK_EMAILS` or `QUALIFIED_FALLBACK_EMAILS` so no lead is lost.

---

## 12. HubSpot (front desk)

The front desk already works in HubSpot, so there is no front desk dashboard. The system writes **every** lead into HubSpot and reads back what the front desk does.

**12.1 Ground rules.** Verify the current HubSpot API docs (CRM objects, properties, notes, tasks, owners, webhooks, rate limits). Use a private app access token with least-privilege scopes (list the scopes you need in PLAN.md). Env: `HUBSPOT_ACCESS_TOKEN`. Our HubSpot plan decides what is possible, so ask me in Milestone 0 (section 4) before choosing the mechanism.

**12.2 Which leads.** All of them: Qualified, and Unqualified High, Medium and Low.

**12.3 What gets written, per lead.**
- Contact created or updated: name, phone, email. De-duplicate by email when present, otherwise by phone (check how HubSpot matches); a repeat caller updates the same contact.
- Lead details as properties. Create a property group and the properties with an idempotent setup script, and show me the list before running it. Include a Tier dropdown (Qualified, High, Medium, Low), a "needs review" checkbox, a "not a fit reason" text, value used and its source, stated budget (min and max), internal estimate (labelled internal), property type, area, city and locality, scope, timeline, current state, call time, a "send to designer" checkbox, and a "budget now (INR)" number.
- A call task for High and Medium leads only (and for the no-email fallback in section 18): "Call back {name} ({tier})". Due now if the call came in during working hours; otherwise 10:00 IST on the next working day. Priority follows the tier. Owner per the rule I confirm in Milestone 0. No task for Qualified or Low.
- A note with the brief (summary, key facts, what the caller asked, what the agent said, open questions). For Qualified leads, also a note with the booking (designer, time). If Gemini fails, add a note built from Vaani's summary, marked "AI brief unavailable".
- Do not copy the transcript into HubSpot.
- In `HUBSPOT_SETUP.md`, explain how to create a saved view or filter for each tier so the front desk finds High, Medium and Low leads automatically.

**12.4 Conversion to Qualified.** The front desk talks to the caller, then in HubSpot updates "budget now (INR)" and ticks "send to designer". The backend detects this (a webhook if our plan supports one, otherwise polling every few minutes; confirm in Milestone 0). The lead then **counts as Qualified with no re-check**: change the HubSpot tier to Qualified, book the next free designer slot in Calendly, and have Resend email the designer and the caller. Write the outcome back to HubSpot as a note (for example "Booked with {designer} on {time}"). Save the budget and the conversion in Neon and in the activity log. If booking fails (for example no email), follow section 18.

**12.5 Read-back.** Sync a read-only status from HubSpot into Neon on a schedule (for example contacted, call outcome, closed, converted), so the founder dashboard shows what happened to front desk leads. Which property or stage to read is decided in Milestone 0.

**12.6 Failures.** Retry with backoff. Never create duplicate tasks or contacts (idempotency key per lead and task kind). After repeated failure, alert ops, send the fallback email, and show "HubSpot push failed" on the lead in the founder dashboard.

---

## 13. Founder dashboard and designer outcome page

General: mobile-first (the founder skims in the morning on a phone, in one place, to make decisions). Live on Vercel. It reads only from Neon. All timestamps stored in UTC and shown in IST; "day" means an IST day. A "lead" is a call with content; empty or very short calls are `no_content` and counted separately, not as leads. Authentication: no public pages. Use a simple, secure login (for example email magic links via Resend with an allow-list of emails and roles `founder` and `admin`) and tell me what you chose. No PII in URLs.

### 13.1 Founder dashboard
Landing view: what came in overnight (since the end of the last working day), then the month. Every lead shows one short line of status.
- How many leads per day (chart for the selected month); leads today; total leads this month; month picker.
- Qualified versus Unqualified counts. For Unqualified: High, Medium and Low probability counts, plus how many are marked needs review.
- Qualified leads: has a meeting been scheduled with the designer or not; if the meeting is done, what is the status.
- Did we get the project or not (won versus lost). If cancelled or lost, the reason.
- Front desk leads: status as read back from HubSpot (contacted, call outcome, closed, converted).
- Project value won (rupees, from designers' entries).
- Failed calls (`call.failed`).
- Cost to run: month to date, cost per lead, cost per qualified lead (section 15), shown next to value won. Label value won as revenue, not margin.
- Lead list, one row per lead: time, name, tier badge, one-line status. Filters for tier and status; search by name or phone.
- Lead detail (click a lead): status timeline, tier with reason and value source, the fit check results and any not-a-fit reason, every input the caller gave (blank shows "Not stated"), the brief, Vaani's summary, the transcript, booking (designer, slot) or HubSpot status, email log, outcome and reason, the call's cost, and any flagged uncertain numbers.
- Settings (founder only): rubric thresholds and fit criteria, `min_weeks_to_ready`, working hours and days, cost rates, fixed monthly costs, USD to INR rate, reason lists, allowed users. All changes audit-logged.

### 13.2 Designer outcome page
A signed, per-lead link in the designer's email (no login). Form: meeting held, won, lost, cancelled, no-show; project value if won; reason (required for lost or cancelled; pick from a settings list or free text); notes. Default reason list, `TODO(owner)` to confirm with Nikhil: budget too low, went with another studio, project postponed, unreachable, other. Tokens expire (settings, default 60 days) and are rate-limited.

---

## 14. What Neon saves

Neon must save the following, so the system can always say what happened and what activity took place. Design the tables in PLAN.md.

1. **The call:** Vaani's call id, ended reason, duration, the whole transcript, and Vaani's summary brief, exactly as received. No audio.
2. **Gemini's decision:** the fit check results, group, tier, value used and its source, reason, `needs_review`, `not_a_fit_reason`, uncertain numbers, discrepancies, and the brief Gemini wrote.
3. **Bookings:** designer, slot, Calendly event and invitee ids, cancel and reschedule links, status.
4. **Emails sent:** to whom, which email, sent or failed, provider id.
5. **HubSpot link:** contact and task ids, whether each push worked, the status read back from HubSpot.
6. **Designer outcomes:** met, won, lost, cancelled, no-show, reason, project value, notes.
7. **Costs:** per call (Vaani, Gemini, Resend) plus fixed monthly costs.
8. **Activity log (`lead_events`):** every step with its time and actor: call received, decision, booking, emails, task created, front desk conversion, any change.
9. **Settings and users:** rubric thresholds, fit criteria, working hours, cost rates, reason lists, who can log in, and an audit log of changes.
10. **Event ids:** Vaani event ids and delivery ids, so a repeated message is never handled twice.

---

## 15. Cost tracking

Per call: Vaani cost from the webhook data (the `call.completed` payload and/or `usage.charged` events; check what exists, and in which currency and units, since Vaani's docs quote rates in paise per second), Gemini cost from token usage times configured rates, Resend cost from email count times a configured rate. Fixed monthly costs (Neon, Vercel, Calendly plan, the Vaani phone number if billed separately, domain) are entered in settings and prorated for month to date. HubSpot is an existing tool and is not counted as a cost of this system.

Do not hard-code or guess any price. Leave every rate as `TODO(owner)` and fill it from the vendor's current pricing page only after showing me the figure and source. While any rate or fixed cost is unset, show a visible banner on the founder dashboard: "Cost may be understated: rates not set".

---

## 16. The Vaani training pack

Vaani is trained **once** with a pack of context, then I check how it did.

- `VAANI_TRAINING_PACK.md` (draft 2) is provided with this brief. Part 1 is the text loaded into Vaani. Part 2 is notes for me and is not loaded.
- Your job in Milestone 1: check every statement in Part 1 against `services.md`, `qualified.md` and the transcripts; fix anything that does not trace; and complete the `{{placeholders}}` once I have answered (the greeting and the budget questions). Do not change a rule in section 2 or add a fact that is not in a file.
- **The numbers in `pricing.md` are never given to Vaani.** Only the rule about what the agent must never say, and the one allowed reply (without the booking offer, section 3, R6), go into the pack. The ₹2 lakh line for declining on a stated budget is the one number the agent applies. It never says it.
- Numbers (budget, area, email) are repeated back to the caller to confirm, in the caller's language.
- Do not write Hindi or Marathi phrasing yourself unless a native speaker reviews it; give English wording and mark `TODO(native review)`.
- Build `VAANI_TEST_CALLS.md`: scripted test calls (for me to make), based on the real enquiries. At least: a full-home referral (T01); a caller who asks for a price twice (T02, T13); a caller outside the service area (T03, F03); a caller who wants ideas or advice only (T04); a caller whose timeline is too short (T07, F08); a caller whose stated budget is ₹2 lakh or less (T10); a rented apartment (T11); a caller who is calling for their parents (T14); a dropped call and call back (T17); an office fitout (T06); a restaurant or gym (T19, W07); a caller who is frustrated about an earlier unanswered enquiry (T16); a caller who asks "are you a person or a bot?"; a caller who asks for a person; a caller who speaks Hindi; a caller who mixes languages; a noisy line; a caller who gives the email; and a declined caller, who must **not** be asked for an email or a phone number. For each: the expected behaviour and what the stored record should show. Include the must-pass list at the end of the pack.

---

## 17. Milestones

**M0. Read and plan (no code).** Read this brief, `context/*`, the pack and the official docs (including HubSpot and Vaani). Produce `PLAN.md` (architecture, tables, routes, env vars, lead state machine, risks) and `OPEN_QUESTIONS.md`. Convert the PDF into per-enquiry files. Also propose: the final field list and enums for section 7; and the HubSpot design (objects, properties, task rules, conversion detection, read-back), asking me the HubSpot questions in section 4. Tell me exactly what you need from me for Vaani: the webhook registered in the dashboard, and a test call so you can capture a real `call.completed` payload. CHECKPOINT.

**M1. Vaani training pack.** Review and complete `VAANI_TRAINING_PACK.md`; build `VAANI_TEST_CALLS.md` (section 16). CHECKPOINT: I review, load the pack into Vaani, and make the test calls.

**M2. Foundations.** Scaffold, Neon schema and migrations, the Zod schema, the Vaani webhook endpoint (signature verification, idempotency by event id, defensive parsing) tested against signed fixtures, the lead state machine and the activity log. CHECKPOINT with a demo into Neon.

**M3. Rubric.** Pricing config extraction (CHECKPOINT A: show the table and the estimator rules, section 8.2). Estimator, threshold re-check and boundary tests. Gemini fit check, decision and brief. `npm run eval:transcripts`: run all 40 enquiries through the Gemini step and write a CSV comparing the result with `eval-proposed-labels.md` (CHECKPOINT B). Those labels are **my proposals**, not Nikhil's decisions. Report agreement and every disagreement; do not call either side "correct". WhatsApp and form enquiries are text, not calls, so treat them as extra test data only.

**M4. Actions.** Calendly booking (test event type) and fallbacks; Resend emails (staging domain); HubSpot push, conversion and read-back (sandbox or test account if available); `processLead`; the sweeper; signed outcome links. CHECKPOINT with eight test leads end to end: one Qualified, one High, one Medium (no budget and no detail), one Low (not a fit), one Low (budget under 2 lakh), one Qualified without an email, one conversion from HubSpot, and one real test call through Vaani.

**M5. Founder dashboard.** Auth, dashboard, designer outcome page, settings, cost tracking. A seed script creates clearly labelled demo data. CHECKPOINT.

**M6. Hardening and handover.** README (setup, env vars, deploy to Vercel preview then production), `VAANI_SETUP.md` and `HUBSPOT_SETUP.md` (section 20), a short runbook, and failure alerts to `OPS_ALERT_EMAIL`. CHECKPOINT.

---

## 18. Edge cases

| Case | Behaviour |
|---|---|
| Call ends early, key details missing | Gemini works from what exists. If a stated budget is found, rate it by the rubric; otherwise Medium with `needs_review` |
| Dropped call, then the caller rings back (T17) | Treat as a repeat caller: attach the second call to the same lead and contact; do not create a second booking |
| Empty or very short call | `no_content`. No actions. Counted separately from leads |
| `call.failed` | Log it, count it on the founder dashboard, create no lead unless the payload carries usable details |
| Fit check fails, or a stated budget of 2 lakh or less | Low, `not_a_fit_reason` recorded, HubSpot record with no call task (section 6.1). The agent declined on the call and did not ask for an email or a phone number |
| Qualified (or converted) but no email | Cannot auto-book. Status `booking_failed` (reason `no_email`). Record in HubSpot with an urgent call task ("Qualified lead, needs booking") and send the brief to `QUALIFIED_FALLBACK_EMAILS` |
| No usable phone number | Medium with `needs_review`; HubSpot record flagged "no phone number captured" |
| Transcript or Vaani summary missing from the event | Fetch it if a documented way exists; otherwise Medium with `needs_review` and an ops alert |
| Gemini unsure about a number | Use the higher reading, flag it in the brief and on the dashboard |
| Partial home and the designed area is unknown | The estimate is "unknown": Medium with `needs_review` (section 8.2) |
| Caller is calling for someone else (T14) | Criterion 5 is unclear: do not push, pass, and note who decides |
| Calendly 403, 5xx, or repeated failures | Retry per section 10, then the same fallback as above, plus an ops alert |
| Resend failure | Retry; show an "email failed" badge on the lead; for Qualified leads, alert ops and create the urgent HubSpot task |
| HubSpot failure | Per section 12.6 |
| Repeat caller (same phone, open lead, within `REPEAT_WINDOW_DAYS`, default 14) | Attach the new call to the existing lead and contact, add a HubSpot note, and never create a second booking while an active booking exists |
| Webhook replay or out-of-order delivery | Idempotent by envelope id; the state machine prevents duplicate side effects |
| Front desk converts a lead | Count as Qualified per section 12.4; audit-log the change and the new budget |
| Caller asks for a price | Backend not involved. The training pack rule applies |

---

## 19. Security and privacy

- Verify every Vaani webhook signature (and HubSpot webhook signatures, if used); validate every payload with Zod; cap payload size; rate-limit public endpoints (webhooks, outcome links).
- Role-based access on every dashboard route and API. Signed (HMAC) tokens for outcome links.
- Redact phone numbers and emails in logs. Structured logs keyed by `lead_id`.
- Store the transcript and Vaani's summary in Neon only, never in HubSpot. Add a retention setting; the default is to keep.
- Use least-privilege scopes for the HubSpot token and never log it.
- Do not commit anything from `context/`. Add it to `.gitignore`.
- Keep a full audit trail (`lead_events`) for tier changes, conversions and settings changes.

---

## 20. Deliverables

- The working code, with tests passing and `.env.example`.
- `PLAN.md`, `OPEN_QUESTIONS.md`, `IDEAS.md`, `README.md`.
- `VAANI_TRAINING_PACK.md` (reviewed and completed) and `VAANI_TEST_CALLS.md` (section 16).
- `pricing.config.json` (built from `pricing.md`, reviewed by me).
- `npm run eval:transcripts` and its CSV output.
- A seed script for demo data.
- `HUBSPOT_SETUP.md`: required scopes, the property list, the setup script, task rules, the saved views for each tier, and how the front desk converts a lead.
- `VAANI_SETUP.md`: how to register the webhook in the Vaani dashboard (URL, events, secret), the events to subscribe to, how to load the training pack, the phone-number findings from the first test call, and what to check after each test call.

---

## 21. Out of scope

WhatsApp and web form channels (except as test data); outbound calling; SMS; call transfer; Telegram; payments or quotes of any kind; a front desk dashboard (they use HubSpot); special handling code for existing clients, vendors or other non-enquiry callers; recording or storing audio.
