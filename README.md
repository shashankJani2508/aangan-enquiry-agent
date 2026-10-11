# Aangan Studio phone enquiry agent

Follows `aangan-agent-build-brief.md` (v4) and the components map:
Caller → Vaani → webhook → Neon → Gemini (decision + brief, code re-checks) → Qualified: Calendly + Resend + HubSpot; High/Medium: HubSpot + call task; Low: HubSpot only → front desk converts in HubSpot → designer outcome link → founder dashboard (reads Neon only).

## Run it
```bash
npm install
cp .env.example .env   # fill DATABASE_URL, APP_SIGNING_SECRET, GEMINI_API_KEY at minimum
npm run db:migrate
npm test               # 78 tests: rubric boundaries, all proposed labels, signatures, task due times
npm run eval:transcripts   # 40 enquiries through Gemini -> eval-output/*.csv and *.md
npm run dev
npm run fixture:sign   # posts a signed synthetic call.completed (T01) to the local webhook
```
Calendly, Resend and HubSpot run in **dry-run** until their env vars are set, so the whole flow can be demoed with only Neon + Gemini. Without Resend, the login link prints to the dev server console.

## Where things are
| Piece | File |
|---|---|
| Rubric (fit check, value bands, re-check) | `src/lib/rubric.ts` |
| Internal estimate + table | `src/lib/estimator.ts`, `pricing.config.json` |
| Lead schema (single source of truth) | `src/lib/lead-schema.ts` |
| Gemini context + call | `src/lib/gemini-prompt.ts`, `src/lib/gemini.ts` |
| Vaani webhook (HMAC, dedupe, `after()`) | `src/app/api/webhooks/vaani/route.ts`, `src/lib/vaani.ts` |
| Orchestrator (idempotent steps) | `src/lib/process-lead.ts` |
| Calendly / Resend / HubSpot | `src/lib/calendly.ts`, `src/lib/email.ts`, `src/lib/hubspot.ts` |
| Sweeper, conversions, read-back | `src/app/api/cron/sweeper/route.ts` (Vercel cron, `vercel.json`) |
| Founder dashboard, lead detail, settings | `src/app/dashboard/**` |
| Designer outcome page | `src/app/outcome/[token]/page.tsx` |
| Neon tables | `db/schema.sql` |
| Training pack (draft 3) and test calls | `VAANI_TRAINING_PACK.md`, `VAANI_TEST_CALLS.md` |
| API checks against official docs | `API_NOTES.md` |
| Questions for you | `OPEN_QUESTIONS.md` |

Auth: email magic link (Resend) to `DASHBOARD_USERS`; link and cookie carry only an email hash, HMAC-signed.

## Not done yet
HubSpot property setup script + `HUBSPOT_SETUP.md`, `VAANI_SETUP.md`, demo seed script, `PLAN.md`, `IDEAS.md`, end-to-end run against real Neon/Vaani/Calendly/HubSpot (no credentials yet), and the Gemini eval (key rejected).
