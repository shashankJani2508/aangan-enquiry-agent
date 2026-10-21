# Vaani setup (done 11 Oct 2026; updated 21 Oct 2026)

Vaani moved its dashboard from `app.vaanivoice.ai` to **`platform.vaani.dev`** (same account, same agent id).

## Agent: `aangan-inbound-enquiries`
- System prompt: Part 1 of `VAANI_TRAINING_PACK.md` (draft 3), with the two placeholders filled by the proposed defaults:
  greeting rule "Good morning / afternoon / evening, Aangan Studio" and budget question "Do you have a budget in mind for this?". TODO(owner) to confirm.
- Greeting message (first words, fixed): "Hello, Aangan Studio." A fixed greeting cannot follow the time of day. TODO(owner).
- LLM: Google `gemini-3.5-flash`, fallback OpenAI `gpt-4o-mini` (Vaani's default fallback "azure" is globally disabled and blocked saving).
- Language (21 Oct 2026): **Hindi, with "English as fallback language" ON**, so the agent understands and speaks both. Vaani set its speech-to-text and voice to its Hindi defaults. Voice: **Arushi** (female, Cartesia sonic-3).
- The prompt has a full Hindi section ("Language" > "Hindi lines") and a "Your voice" section (female, so Hindi self-references use feminine forms). If the voice is changed to a male one, change "Your voice".
- Checked in Vaani's Chat test (21 Oct 2026): a Hindi enquiry got Hindi replies; a price question got the Hindi price line with no number; "10 lakh mein ho jayega?" was neither confirmed nor denied; a Nashik site got the Hindi decline reason and Nikhil's decline sentence in Hindi with no email asked; the name question used the feminine "सकती".
- Not done: phone number. Telephony has no number yet; buying or connecting one is your call (cost).

## Webhook: `Aangan backend (Vercel)` (Developers > Webhooks)
- Events: Call Post-Processing (with "Send all call details"), Call Ended, Call Failed.
- URL: must be the keyed URL in `VAANI_WEBHOOK_URL.txt` (`.../api/webhooks/vaani?k=...`). Until it is, deliveries are stored in
  `webhook_captures` (capture mode) but not acted on.

## What Vaani actually sends (captured from "Test Connectivity", differs from its API docs)
- Header `x-webhook-event`; no signature header when no secret is set.
- Body: `{ "event": "call_postprocessing" | "call_ended" | "call_failed", "call_id", "timestamp", "data": {...} }`
- `call_postprocessing.data`: `room_name, call_id, call_duration, end_reason, summary, entities{...}, dispositions{...}, recording_url, transcript ("Agent: ...\nUser: ...")`
- `call_failed.data`: `call_id, phone_number, reason`
- Still unknown until a real call: whether `call_postprocessing` carries the caller's `phone_number`, and whether it is masked.
- `recording_url` is stripped before anything is saved (no audio, brief section 9).

## After the first real call
1. Check `webhook_captures` and the dashboard: transcript, summary, phone number present?
2. Turn capture mode off: remove `VAANI_CAPTURE` from Vercel production env and redeploy.
