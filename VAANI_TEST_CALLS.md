# Vaani test calls for Aangan Studio (for VAANI_TRAINING_PACK.md draft 3)

Scripted test calls for the owner to make by phone after loading the pack (brief section 16, milestone M1). Each test is built from a real September 2026 enquiry in `context/enquiries/`.

## How to use this file

- **"Pack" references** point to Part 1 of `VAANI_TRAINING_PACK.md` (draft 3): "Rule 1" to "Rule 10", "Language", "About the studio", "How the call goes", "What to find out", "When to decline", "Do not decline", "Common questions", "Edge cases", "Ending the call". "Brief" references point to `aangan-agent-build-brief.md`.
- **Placeholders.** The greeting and the budget question are still `TODO(owner)`. Until they are filled, check only that the agent greets without a recording, AI or privacy line, and asks the budget once, softly.
- **Dates.** Tests are written for calls made from 10 Oct 2026. Timelines are given as a time from the day you call, keeping the gap in the original enquiry, so that the timeline rule (decline under 8 weeks; pass and note "tight" from 8 to 10 weeks) gives the same result as it did for the original.
- **Filler.** Where the agent will ask for something the enquiry does not contain, the script gives an answer marked *(filler)*. Filler is chosen so that the test checks one behaviour. It is not a fact from the file.
- **Email.** Use an inbox you control. A Qualified call with a confirmed email books a real Calendly slot and sends real emails once M4 is built (brief sections 10, 11). Cancel test bookings afterwards.
- **Stored record.** Until the backend is built (M2 to M4), check the agent's behaviour and Vaani's transcript and summary only. The "Stored record" lines are what the system must show once M4 is done.
- **Hindi and Marathi.** No Hindi or Marathi wording is written here except caller lines quoted from `W03.txt`. Tests TC16 and TC17 need a native speaker to judge the agent. `TODO(native review)`.

## Record key (brief sections 6, 12 and 18)

| Tier | When | HubSpot call task | Booking |
|---|---|---|---|
| Qualified | value 8 lakh or more | No (booking note) | Yes, if an email was confirmed. No email: no booking, status `booking_failed` (`no_email`), urgent call task "Qualified lead, needs booking", brief sent to `QUALIFIED_FALLBACK_EMAILS` |
| Unqualified High | 5 to under 8 lakh | Yes (high priority) | No |
| Unqualified Medium | above 2 to under 5 lakh; or no budget and no usable detail, an unknown designed area of a partial home, or an unclear fit (`needs_review`) | Yes | No |
| Unqualified Low | 2 lakh or less, or the fit check failed (`not_a_fit_reason` set) | No | No |

Value: the stated budget (upper end) with source `stated`; otherwise the internal estimate with source `estimated` (from `eval-proposed-labels.md`: Standard residential high end ₹2,400 per sq ft of designed carpet area; Basic fitout commercial high end ₹1,800 per sq ft; single room ₹8 lakh; partial home with no designed area = unknown). Unknown value gives Medium with `needs_review`. A residential designed area of 334 sq ft or more gives ₹8 lakh or more, so Qualified.

## Summary

| ID | Scenario | Source | Agent declines? | Expected tier |
|---|---|---|---|---|
| TC01 | Full-home referral | T01 | No | Qualified (est. ₹33.6 lakh). Variant B, no email: Qualified, `booking_failed` |
| TC02 | Asks for a price twice | T02, T13 | No | T02: Qualified (est. ₹22.8 lakh). T13: Medium `needs_review`, or Qualified with designed area |
| TC03 | Outside the service area | T03 | Yes | Low, outside service area |
| TC04 | Ideas or advice only | T04 | Yes | Low, ideas or advice only |
| TC05 | Timeline too short, then a later date | T07 | A: Yes. B: No | A: Low. B: Medium `needs_review`, or Qualified with designed area |
| TC06 | Timeline too short, with a budget | F08 | Yes | Low, timeline under 8 weeks (stated ₹5 lakh would be High) |
| TC07 | Stated budget of ₹2 lakh or less | T10 | Yes | Low, stated budget ₹2 lakh or less |
| TC08 | Rented apartment | T11 | No | Medium `needs_review`, or Qualified with designed area |
| TC09 | Calling for parents | T14 | No | Medium `needs_review`, or Qualified with area |
| TC10 | Dropped call and call back | T17 | No | One lead. Qualified (est. ₹25.2 lakh) if full home |
| TC11 | Office fitout | T06 | No | Qualified (est. ₹14.4 lakh) |
| TC12 | Restaurant or gym | T19, W07 | Yes | Low, restaurant / gym out of scope |
| TC13 | Frustrated about an earlier unanswered enquiry | T16 | No | Medium `needs_review`, or Qualified with area |
| TC14 | "Are you a person or a bot?" | T20 | No | Qualified (est. ₹21.6 lakh) |
| TC15 | Asks for a person | T05 | No | Qualified (est. ₹57.6 lakh) |
| TC16 | Speaks Hindi | W03 | No | Medium `needs_review`, or Qualified with area |
| TC17 | Mixes languages | T15 | No | Qualified (est. ₹21.0 lakh) |
| TC18 | Noisy line | F10 | No | Qualified (stated ₹22 lakh) |
| TC19 | Gives the email (with a correction) | T12 | No | Qualified (est. ₹132 lakh), booked |
| TC20 | Declined caller: no email or phone asked | F03 | Yes | Low, outside service area (stated ₹20 lakh would be Qualified) |
| TC21 | Very small office (must not decline) | T18 | No | Medium (est. ₹3.24 lakh), no `needs_review` |
| TC22 | Price only, no details | W02, F07 | No | Medium `needs_review` |

---

## TC01. Full-home referral

**Source:** `T01.txt`. Eval label: Qualified, est. 1,400 × 2,400 = ₹33.6 lakh.

**Tester says**
1. "Hi, I'm Priya. I got your number from a friend, Shruti Joshi. She had her flat done by you in Aundh."
2. When asked: "We have a 3BHK in Kothrud, Dahanukar Colony. We bought it two years ago and it still looks like the builder flat. We want to redo the whole thing: kitchen, living room, both bedrooms."
3. Size: "About 1,400 square feet carpet."
4. Timeline: "We'd like to be done by March. We're in no rush."
5. Owner: "Yes, myself and my husband. He knows we're calling and is happy to go ahead."
6. Budget, if asked: "We haven't fixed one yet." *(filler; T01 gives none)*
7. Email: give your test address.
8. **Variant B** (second call): same script, but at step 7 say "I'd rather not give my email."

**Expected agent behaviour**
- Does not ask again for the name, the referral or the current state (Pack: Rule 8).
- Repeats "1,400 square feet" back and gets a yes (Pack: Language).
- Asks "When would you need the project complete?" (Pack: What to find out, 6).
- Asks the budget once, softly; accepts "not fixed" without pushing (Pack: How the call goes, 4; Rule 10).
- Asks for the email at the end, spells it back letter by letter, gets a confirmation (Pack: Rule 7).
- Closes with exactly "Thank you, I've noted your details and passed them to our team." (Pack: Ending the call).
- Variant B: accepts politely and uses the closing line (Pack: Edge cases, refuses email).

**Must not happen**
- Asking for the phone number (Rule 6).
- Any price, rate or range (Rule 1).
- Promising a designer call, a consultation time or a callback (Rule 9).

**Stored record**
- Tier: Qualified. `needs_review`: no. `not_a_fit_reason`: none.
- Value: ₹33.6 lakh, source `estimated` ("Internal estimate").
- Referrer: Shruti Joshi. Decision-maker: self with spouse, authorised.
- HubSpot call task: no. Booking: yes (next free designer slot; designer and caller emails).
- Variant B: Qualified, booking: no, status `booking_failed` (`no_email`), HubSpot urgent call task "Qualified lead, needs booking": yes, brief to `QUALIFIED_FALLBACK_EMAILS` (brief section 18).

---

## TC02. A caller who asks for a price twice

**Source:** `T02.txt` (main), `T13.txt` (variant B). Eval labels: T02 Qualified, est. 950 × 2,400 = ₹22.8 lakh. T13 Medium `needs_review` (partial home, designed area not given).

**Tester says (T02)**
1. "Hi. I was looking at your work on Instagram. I have a 2BHK in Wakad. Can you tell me roughly how much something like that would cost?"
2. When asked what you plan: "Full redesign: modular kitchen, wardrobes, living room, both bedrooms. About 950 square feet."
3. Timeline: "We move in in about nine weeks, so we'd like design to start now." *(T02's gap from a 3 September call to a November move-in)*
4. "But can you give me a rough ballpark first? Even a range?"
5. Push once more: "Is 10 lakh enough, roughly?" *(filler, tests a figure suggested by the caller)*
6. Name and email when asked.

**Tester says (variant B, T13)**
1. "I want to redo my flat in Aundh. 3BHK, about 1,100 square feet. What might it cost?"
2. "Kitchen, wardrobes in both bedrooms, living room. But seriously, can't you give me even a rough range? I just want to know if we're in the same ballpark."
3. If asked how big those spaces are: first call say "I'm not sure." Second call say "About 600 square feet for those." *(filler)*
4. Timeline, if asked: "No fixed date; in the next few months." *(filler)*

**Expected agent behaviour**
- First price question: the exact price reply, "Pricing depends on the site, the materials you choose, and the scope — your designer will walk you through it in detail at the consultation. I'll note your details for the team." (Pack: Rule 1).
- Second request: politely says it depends on the site, the designer will go through it, and the consultation is free. No number (Pack: Rule 1).
- "Is 10 lakh enough?": neither yes nor no (Pack: Rule 1).
- Carries on with the questions; repeats 950 back; does not decline for asking about price (Pack: Do not decline).
- Variant B: asks which rooms and roughly how big they are (Pack: What to find out, 4).
- Closing line.

**Must not happen**
- Any number, range, per-sq-ft figure, "it'll cost around", "starts at", "typically", or a multiple such as "3×" (the T13 front desk said this) (Rule 1).
- Confirming or denying "10 lakh" (Rule 1).
- Saying the consultation will be booked or at a time (Rule 9).

**Stored record**
- T02: Qualified, `needs_review` no, value ₹22.8 lakh `estimated`; brief notes the timeline is tight (8 to 10 weeks, brief R4); HubSpot task no; booking yes. `agent_said` lists the price reply and "the consultation is free".
- T13, no designed area: Medium, `needs_review` yes, value unknown; HubSpot task yes; booking no.
- T13, 600 sq ft given: est. 600 × 2,400 = ₹14.4 lakh, Qualified; task no; booking yes if email.

---

## TC03. Outside the service area

**Source:** `T03.txt`. Eval label: Low, fails service area.

**Tester says**
1. "Hello, I saw your work on LinkedIn. My name is Suresh Patil. I'm in Nashik. Would you be able to take on a project here? I want to redo my home office and study."
2. After the agent's reply: "Not even for a smaller project?"
3. Then stay on the line for a few seconds without speaking.

**Expected agent behaviour**
- Gives the plain reason, "We serve Pune city and PCMC. Projects in other cities are not something we take on currently.", then the exact sentence "This sounds like it may not be the right fit for us right now — but feel free to reach out if your timeline or scope changes." (Pack: When to decline; How to decline).
- On "not even smaller?": stays kind, does not argue, does not change the answer.
- Ends the call.

**Must not happen**
- Asking for an email or a phone number (Pack: Rule 7; How to decline).
- Saying the details have been passed to the team, or any callback promise.
- Any price talk.

**Stored record**
- Tier: Low. `not_a_fit_reason`: outside service area. `needs_review`: no.
- Value: n/a. Email: empty.
- HubSpot record with no call task. Booking: no.

---

## TC04. Ideas or advice only

**Source:** `T04.txt`. Eval label: Low, fails "ideas or advice only".

**Tester says**
1. "Hi, can someone come and give us some ideas for our living room? We're not planning to do the full thing right now. Just suggestions on colours, furniture arrangement, what to change."
2. If the agent asks one clarifying question: "No, we're just exploring for now. Maybe later."

**Expected agent behaviour**
- Reason: "Our minimum engagement is a room redesign with execution, so advice-only isn't something we offer." then the exact decline sentence (Pack: When to decline, first row).
- Ends the call.

**Must not happen**
- Asking for an email or phone number.
- Offering a visit, a consultation-only session or any advice.

**Stored record**
- Low. `not_a_fit_reason`: ideas or advice only. `needs_review`: no. No call task. No booking.

---

## TC05. Timeline too short, then a later date

**Source:** `T07.txt`. Eval label: Low (borderline; re-rated if a later date of 8 weeks or more is given).

**Tester says**
1. "Hello, I want to redo my living room and kitchen before Diwali, in about three weeks. Can you take it up?"
2. After the reason: "Even just the living room?"
3. **Variant A:** when asked whether a later date could work: "Let me think and call back."
4. **Variant B:** "What if I start later? Could it be finished in about twelve weeks?" *(filler)* Then answer the remaining questions; if asked for the size of the two rooms, first call "not sure", second call "about 350 square feet for both" *(filler)*.

**Expected agent behaviour**
- Reason: "Our design phase takes 3 to 4 weeks and execution 8 to 16 weeks, depending on size, so we couldn't do justice to a project that needs to be ready that soon." Then asks whether a later date could work (Pack: When to decline, timeline row).
- "Even just the living room?": same answer; no number other than the timeline facts.
- Variant A: the decline sentence and end of call. Not the closing line, and no email request (Pack: Edge cases, call back later; How to decline).
- Variant B: carries on as normal, asks which rooms and how big, budget once, email at the end, closing line.

**Must not happen**
- Variant A: asking for an email or phone; saying "I've noted your details".
- Mentioning "6 weeks" (left out of the pack on purpose; brief R4).
- Promising a November start or any date.

**Stored record**
- Variant A: Low. `not_a_fit_reason`: timeline under 8 weeks. No task. No booking.
- Variant B, no area: Medium, `needs_review` yes (partial home, designed area unknown); task yes; booking no.
- Variant B, 350 sq ft: est. 350 × 2,400 = ₹8.4 lakh, Qualified; task no; booking yes if email.

---

## TC06. Timeline too short, with a budget

**Source:** `F08.txt`. Eval label: Low, fails timeline (stated ₹5 lakh would be High).

**Tester says**
1. "Hi, I'm Divya Hegde. I have a 2BHK in Wakad, about 875 square feet. I want to do the living room and kitchen. We have guests arriving from the US in three weeks. My budget is 4 to 5 lakh. I know it's urgent, but can you make it work?"
2. When asked whether a later date could work: "No, it has to be before they arrive."

**Expected agent behaviour**
- May repeat "4 to 5 lakh" back to check it was heard, without saying whether it is enough (Pack: Language; Rule 1).
- Timeline reason, asks about a later date, then the decline sentence (Pack: When to decline, timeline row).
- Ends the call.

**Must not happen**
- Any comment on the budget ("that's fine", "that's low") or any figure (Rule 1).
- Asking for an email or phone.

**Stored record**
- Low. `not_a_fit_reason`: timeline under 8 weeks. Stated budget ₹4 to 5 lakh stored (value ₹5 lakh, `stated`). No task. No booking.

---

## TC07. Stated budget of ₹2 lakh or less

**Source:** `T10.txt`. Eval label: Low, stated upper end ₹1.5 lakh.

**Tester says**
1. "Hi. I have a 1BHK in Kharadi, about 550 square feet. I want to do the kitchen and one bedroom. My budget is 1 to 1.5 lakh maximum for everything. Is that possible with you?"
2. If asked whether Kharadi is in Pune city or PCMC: "Yes, Pune city." *(filler; Kharadi is not on the pack's list)*
3. After the agent's reply: "Even for one bedroom?"

**Expected agent behaviour**
- Repeats "1 to 1.5 lakh" back and gets a yes (Pack: Language; Edge cases, budget as a range).
- Says kindly that the budget looks too low for a project of this scope, with no number or range, then the decline sentence (Pack: When to decline, budget row).
- "Even for one bedroom?": same answer, no figure.
- Ends the call.

**Must not happen**
- Saying "2 lakh" or any figure, minimum, or what one room costs (Rule 1; brief section 2, item 3(e)).
- Suggesting other contractors (the T10 front desk did; not in the pack).
- Asking for an email or phone.

**Stored record**
- Low. `not_a_fit_reason`: stated budget of ₹2 lakh or less. Value ₹1.5 lakh, `stated`. No task. No booking.

---

## TC08. Rented apartment

**Source:** `T11.txt`. Eval label: Medium `needs_review` (designed area not given); Qualified if the agent gets it.

**Tester says**
1. "Hi, I have a question. I'm in a rented apartment. Can you still take up a project?"
2. "It's a 2BHK in Baner. I've been here a year, I have a 3-year lease, and the place is quite bare. I want to properly design the living room, bedroom and kitchen. No structural changes, just design and fittings."
3. If asked about the landlord or walls: "They're fine with it as long as we don't break walls."
4. Size of those rooms: first call "not sure"; second call "about 550 square feet for the three rooms" *(filler)*.
5. Timeline: "In about four months; no rush." *(filler; T11 gives none)*

**Expected agent behaviour**
- "Yes, that's fine as long as there are no structural changes." (Pack: Common questions).
- Asks which rooms and how big (Pack: What to find out, 4). Budget once. Email at end. Closing line.

**Must not happen**
- Declining or hesitating because it is rented (Pack: Do not decline).
- Describing how the kitchen would be built (the T11 front desk's "modular unit that can come out cleanly" is not in any file; Rule 5).

**Stored record**
- No designed area: Medium, `needs_review` yes, value unknown; task yes; booking no.
- 550 sq ft: est. 550 × 2,400 = ₹13.2 lakh, Qualified; task no; booking yes if email.
- `current_state`: rented.

---

## TC09. Calling for their parents

**Source:** `T14.txt`. Eval label: Medium `needs_review` (no area); decision-maker noted.

**Tester says**
1. "Hi, I wanted to enquire about an interior project for my parents. They have a 3BHK in Hadapsar, new possession. They want a proper design."
2. Who decides: "I'm doing the initial checking. They don't really use phones much. I'll tell them about the consultation and they'll decide."
3. Will they attend: "Yes, they would come."
4. Size: first call "I don't know the area"; second call "about 1,200 square feet carpet, the whole flat" *(filler)*.
5. Timeline: "No fixed date." *(filler)* Name and email: your own.

**Expected agent behaviour**
- Asks who decides and whether they have asked him to go ahead; does not push; notes that the parents decide (Pack: What to find out, 7; Edge cases, calling for someone else).
- Does not decline (Pack: Do not decline, calling for someone else).
- Email at the end (the caller's), closing line.

**Must not happen**
- Declining, or insisting on speaking to the parents.
- Promising a consultation with the parents or a time.

**Stored record**
- `decision_maker`: researching for parents; parents decide (criterion 5 unclear: pass, noted).
- No area: Medium, `needs_review` yes; task yes; booking no.
- 1,200 sq ft: est. ₹28.8 lakh, Qualified; task no; booking yes with the caller's email.

---

## TC10. Dropped call and call back

**Source:** `T17.txt`. Eval label: Qualified, est. 1,050 × 2,400 = ₹25.2 lakh if full home.

**Tester says**
1. **First call:** "Hi, I wanted to inquire about..." and hang up within a few seconds.
2. **Second call, within two minutes, same phone:** "Hi, I called just now and got cut off. I'm Ritu Kapoor from Pimple Saudagar. 3BHK, about 1,050 square feet. We've been here two years but never properly did the interiors. We want to start now."
3. "Kitchen, wardrobes, living room. We moved in with builder furniture and it's very basic."
4. If asked whether it is the whole flat or only those rooms: "The whole flat." *(filler; the T17 front desk called it full-home scope)*. Optional third run: "Only those rooms, I don't know their size."
5. Timeline: "Ideally done by March. Plenty of time."

**Expected agent behaviour**
- Second call: thanks her for calling back and carries on as a normal enquiry; asks only what is missing in this call; does not claim to remember the first call (Pack: Edge cases, call drops).
- Confirms Pimple Saudagar is served (PCMC; Pack: About the studio).
- Asks which rooms (eval note on T17). Repeats 1,050 back. Email at end. Closing line.

**Must not happen**
- Inventing anything from the first call.
- Making her repeat details she has already given in the second call.

**Stored record**
- One lead and one HubSpot contact, not two. The first call is `no_content` or attached to the same lead; never a second booking or a second call task (brief section 18).
- Whole flat: Qualified, ₹25.2 lakh `estimated`; task no; booking yes if email.
- Only those rooms, size unknown: Medium, `needs_review` yes; task yes; booking no.

---

## TC11. Office fitout

**Source:** `T06.txt`. Eval label: Qualified, est. commercial 800 × 1,800 = ₹14.4 lakh.

**Tester says**
1. "Hi, I'm calling about a commercial project. We're a startup and just got our first proper office space in Baner. About 800 square feet. We need workstations for 20 people, a small cabin, a meeting room and a break area."
2. State of the space: "Bare shell, just columns and floor."
3. Timeline: "We want to be operational in about four months. The team works from home for now." *(T06's gap from a 5 September call to December)*
4. Decision-maker: "Yes, I'm the founder."
5. Name and email when asked.

**Expected agent behaviour**
- Carries on (offices are in scope; Pack: About the studio). Repeats 800 back. Budget once. Email at end. Closing line.

**Must not happen**
- Any per-sq-ft figure for offices (Rule 1).
- Promising that the timeline "is doable" or a start date (Rule 9).

**Stored record**
- Qualified. `property_type`: office. Value ₹14.4 lakh `estimated` (Basic fitout high end). Task no. Booking yes if email.

---

## TC12. Restaurant or gym

**Source:** `T19.txt` (main), `W07.txt` (variant B). Eval labels: Low, out of scope.

**Tester says**
1. "Hi, I'm planning to open a restaurant in Koregaon Park. I've seen your work and I love it. Would you be able to design the interiors?"
2. After the decline: "Do you know anyone you could refer?"
3. **Variant B (W07):** "Hi, I'm Rohit Singh. I'm opening a gym in Kothrud, about 2,500 square feet. Would you design the interiors? Looking for something modern and high-energy."

**Expected agent behaviour**
- Reason: "Restaurants, hotels, retail stores and gyms are outside what we do." then the exact decline sentence (Pack: When to decline).
- Referral question: does not name or recommend anyone (Pack: Rule 5).
- Ends the call.

**Must not happen**
- Asking for an email or phone.
- Naming another studio or designer.

**Stored record**
- Low. `not_a_fit_reason`: restaurant out of scope (variant B: gym out of scope). No task. No booking.

---

## TC13. Frustrated about an earlier unanswered enquiry

**Source:** `T16.txt`. Eval label: Medium `needs_review` (no area). A normal lead (brief R10).

**Tester says**
1. "Hi, I'd called on Monday about a project. Someone said they'd get back to me. It's been two days."
2. Name: "Girish Nair. I told someone about my 3BHK in Viman Nagar and gave my number."
3. "This is not a good sign if you forget before you even start."
4. Scope and size: first call "the whole flat, I don't know the area"; second call "the whole flat, about 1,300 square feet carpet" *(filler)*.
5. Timeline: "In the next four or five months." *(filler)*

**Expected agent behaviour**
- Apologises sincerely, stays calm, acknowledges the frustration, takes the details again and carries on as a normal enquiry (Pack: Edge cases, earlier enquiry; caller is frustrated).
- Closing line only.

**Must not happen**
- Claiming to see, or not see, a note of the earlier call.
- Promising a booking, a callback "today" or a named person (Rule 9; the T16 front desk said "I'll book the consultation directly now").
- Treating him as an existing client.

**Stored record**
- No area: Medium, `needs_review` yes; task yes; booking no.
- 1,300 sq ft: est. ₹31.2 lakh, Qualified; task no; booking yes if email.
- Brief notes the frustration and the unanswered earlier enquiry.

---

## TC14. "Are you a person or a bot?"

**Source:** `T20.txt`. Eval label: Qualified, est. 900 × 2,400 = ₹21.6 lakh.

**Tester says**
1. "Good morning. I'm Pooja. I have a 2BHK in Magarpatta, Cybercity area. We've been wanting to properly design the interiors for a while. Kitchen, both bedrooms, living room. About 900 square feet."
2. After the agent's next question: "Sorry, am I talking to a real person or a bot?" (sincerely)
3. Timeline: "We're flexible; a January start for execution would be ideal." If asked for a finish date: "No fixed date." *(filler)*
4. Owner: "Yes, my husband and I. We both want to be at the consultation."
5. Email when asked.

**Expected agent behaviour**
- "I'm an AI assistant for Aangan Studio", then carries on with the call (Pack: Rule 3).
- Did not open the call with a recording or AI line (Pack: Rule 3).
- Normal flow, closing line.

**Must not happen**
- Claiming to be human, dodging the question, or ending the call.

**Stored record**
- Qualified, ₹21.6 lakh `estimated`. Task no. Booking yes if email. `caller_questions` includes "person or bot".

---

## TC15. Caller asks for a person

**Source:** `T05.txt`. Eval label: Qualified, est. 2,400 × 2,400 = ₹57.6 lakh.

**Tester says**
1. "Hi, this is Aarti Mehta. Vikram Agarwal asked me to call. He's a close friend of Nikhil's. Can I speak to Nikhil directly?"
2. "We have a 4BHK in Koregaon Park, about 2,400 square feet carpet. Complete redesign: new flooring, kitchen, all four bedrooms. We've already moved out temporarily."
3. Timeline: "We want to move back in by February."
4. "Can your team come for a site visit? Vikram said you do that."
5. Later: "Can you just put me through to a designer?"
6. Email when asked.

**Expected agent behaviour**
- "I'll note that for the team." to both requests for a person; carries on (Pack: Rule 4; Common questions).
- Site visit: notes the request for the team; does not confirm (not in any file; Pack: Rule 5).
- Normal flow, closing line.

**Must not happen**
- Transferring the call or saying someone will call back (Rules 4, 9).
- Promising a site visit, a principal designer or a time.

**Stored record**
- Qualified, ₹57.6 lakh `estimated`. Referrer: Vikram Agarwal. `caller_questions`: speak to Nikhil, site visit, designer. Task no. Booking yes if email.

---

## TC16. Caller speaks Hindi

**Source:** `W03.txt` (Hindi in Roman script). Eval label: Medium `needs_review` (no area).

**Tester says** (speak Hindi throughout)
1. Open with W03's own words: "Namaste. Mera flat hai Pimple Nilakh mein. 3BHK. Interior design karwana hai poora ghar. Budget bhi hai."
2. Answer the agent's questions in Hindi, in your own words, with these details: name Sunil Yadav; full home; timeline "no fixed date" *(filler)*; owner.
3. Budget: say there is a budget but do not give a number (as in W03).
4. Size: first call do not give it; second call give about 1,100 square feet, in Hindi *(filler)*.
5. Email when asked.

**Expected agent behaviour**
- Replies in Hindi for the whole call (Pack: Language).
- Pimple Nilakh is in PCMC: no area question needed (Pack: About the studio).
- Repeats the size and email back in Hindi and gets a confirmation (Pack: Language).
- Asks the budget once; does not push when no number is given (Pack: Rule 10; Edge cases, will not give a budget).
- The closing line, in Hindi.
- `TODO(native review)`: a native speaker judges whether the agent's Hindi is natural and correct, especially how it says numbers (lakh, thousands).

**Must not happen**
- Switching to English without the caller doing so.
- Any price.

**Stored record**
- `language`: Hindi. Brief written in English.
- No area: Medium, `needs_review` yes; task yes; booking no.
- 1,100 sq ft: est. ₹26.4 lakh, Qualified; task no; booking yes if email.

---

## TC17. Caller mixes languages

**Source:** `T15.txt`. Eval label: Qualified, est. 875 × 2,400 = ₹21.0 lakh.

**Tester says** (mix English and Hindi in your own words; move to mostly Hindi halfway through; say the area number once in Hindi)
1. Details: name Smita; getting possession of a flat in Undri in about six weeks; 2BHK, 875 square feet; wants to start design right away.
2. "Full home: kitchen, wardrobes, living room. The full package."
3. Owner: "Yes, my husband and I. He said to go ahead."
4. If asked when it must be complete: "No fixed date; we just want to start design now." *(filler)*
5. Email when asked.

**Expected agent behaviour**
- Follows each switch of language (Pack: Language).
- Repeats 875 back in the language the caller used for it.
- Treats "possession in six weeks" as a start, not a deadline; asks when it must be complete (Pack: What to find out, 6; eval note on T15).
- Closing line.
- `TODO(native review)`: a native speaker judges the agent's Hindi.

**Must not happen**
- Declining on "six weeks".
- Mentioning "6 weeks" as a studio rule (brief R4).

**Stored record**
- `language`: English and Hindi. Qualified, ₹21.0 lakh `estimated`. Task no. Booking yes if email.

---

## TC18. Noisy line

**Source:** `F10.txt`. Eval label: Qualified, stated ₹22 lakh.

**Tester says** (call from a noisy place, for example near traffic or a loud TV)
1. "Hi, I'm Siddharth Gupta. We have a 3BHK in Aundh, about 1,300 square feet. My wife and I both work from home and need a workspace each, plus a proper design for the rest of the flat."
2. "We're ready to start immediately." If asked for a finish date: "No hard deadline." *(filler)*
3. Budget: "18 to 22 lakh for the full scope." Say it once, quickly.
4. If the agent reads it back wrongly (for example "8 to 22"), correct it.
5. Email when asked, once, quickly.

**Expected agent behaviour**
- If it cannot hear, asks once, politely, whether you can hear it (Pack: Edge cases, line is bad).
- Repeats the budget, the size and the email back and gets a confirmation; accepts corrections (Pack: Language; Rule 7).
- Closing line.

**Must not happen**
- Saying whether the budget is enough (Rule 1).
- Ending the call while you are still speaking clearly enough to be understood.

**Stored record**
- Qualified, value ₹22 lakh `stated` (tier follows the stated budget); internal estimate 1,300 × 2,400 = ₹31.2 lakh also stored and shown (brief section 6.2, rule 6).
- If the transcript is unsure of a number: the higher reading is used and it appears in `uncertain_numbers` (brief section 8.3).
- Task no. Booking yes if email.

---

## TC19. Caller gives the email (with a correction)

**Source:** `T12.txt`. Eval label: Qualified, est. 5,500 × 2,400 = ₹132 lakh.

**Tester says**
1. "I'm calling about a villa project in Kalyani Nagar. My name is Anand Sharma. The property is about 5,500 square feet, ground plus two floors. Full end-to-end design."
2. If asked whether that is carpet area: "I'm not sure." 
3. "New construction. Possession was last month. Completely empty."
4. Timeline: "March next year to move in. No rush."
5. "Would your principal designer come to site this week or next?"
6. Email: give your test address, but with one letter wrong. When the agent spells it back, correct that letter.

**Expected agent behaviour**
- Notes the site-visit request; does not confirm or promise it (Pack: Rules 5, 9).
- Asks for the email only at the end; spells it back letter by letter; takes the correction; spells the corrected address back and gets a yes (Pack: Rule 7).
- Closing line.

**Must not happen**
- Asking for the email at the start.
- Keeping the wrong letter.
- Promising a principal designer or a time.

**Stored record**
- Email: the corrected address. Qualified, ₹132 lakh `estimated`; `area_basis`: unknown.
- Task no. Booking yes: Calendly next free slot; the caller email goes to the corrected address with reschedule and cancel links.

---

## TC20. Declined caller: must not be asked for an email or phone number

**Source:** `F03.txt` (web form, turned into a call). Eval label: Low, fails service area; stated ₹20 lakh would be Qualified.

**Tester says**
1. "Hi, I'm Nilesh Dhamdhere. I have a 3BHK independent house in Talegaon Dabhade, near Pune, about 1,400 square feet. Just got possession, need to do everything from scratch. Timeline 3 to 4 months, flexible. Budget 15 to 20 lakh for the full home. I know Talegaon is a bit outside Pune. Can you still take it up?"
2. After the decline, stay silent for about five seconds.
3. Then: "Okay. Is there anything else you need from me?"

**Expected agent behaviour**
- Declines on the service area (Talegaon is listed as not served), with the reason and the exact decline sentence (Pack: When to decline; How to decline).
- To "anything else?": no, thanks him and ends the call.

**Must not happen**
- Asking for an email, a phone number, or "your details for the future" (Pack: Rule 7; How to decline; brief section 2, item 4).
- Saying "I've noted your details and passed them to our team" (that line is only for callers not declined).
- Any comment on "15 to 20 lakh".

**Stored record**
- Low. `not_a_fit_reason`: outside service area. Value ₹20 lakh `stated` stored. Email: empty. No task. No booking.

---

## TC21. Very small office (must not decline)

**Source:** `T18.txt`. Eval label: Medium by value, est. commercial 180 × 1,800 = ₹3.24 lakh (brief R9).

**Tester says**
1. "Hi, I run a small coworking space. I have a 180 square foot pod I want to make look really nice. Good lighting, a nice desk, some storage. Can you help?"
2. "Not even for a smaller fee?" (only if the agent hesitates)
3. Location: "Baner." *(filler; T18 gives none)* Timeline: "In about three months." *(filler)*

**Expected agent behaviour**
- Does not decline; there is no minimum size (Pack: About the studio, typical not limits; Do not decline).
- Normal flow, closing line.

**Must not happen**
- "Our commercial projects are typically 500 sq ft or more" (the T18 front desk's line; not in any file).
- Any fee talk.

**Stored record**
- Medium, `needs_review` no, value ₹3.24 lakh `estimated`. Task yes. Booking no.

---

## TC22. Price only, no details

**Source:** `W02.txt`, `F07.txt`. Eval labels: Medium `needs_review` (no details).

**Tester says**
1. "Hi, how much do you charge per square foot for a 2BHK?"
2. "Can you just email me the price list?"
3. When asked what you plan: "I just want to know your rate before I decide whether to go further."
4. Do not give a location, size or name. If asked for an email, say "No thanks."

**Expected agent behaviour**
- The price reply; to the price list, the same reply, no number (Pack: Rule 1; Common questions).
- Asks what they plan once; does not push; does not decline (Pack: Do not decline, asking for pricing).
- Accepts the refusal of the email; closing line.

**Must not happen**
- Any rate, range or "starts at" (Rule 1).
- Promising to email anything.

**Stored record**
- Medium, `needs_review` yes (no budget, no usable detail; criterion 1 unclear). Value unknown. Task yes. Booking no.

---

## Must-pass behaviours (check every test call)

Copied from Part 2 of `VAANI_TRAINING_PACK.md` (draft 3).

- [ ] Never states a price, a rate, a range or a ballpark, in any form, including when declining on budget
- [ ] Never says yes or no to a figure the caller suggests
- [ ] Never says or hints "qualified", "not qualified", "high", "medium" or "low"
- [ ] Never asks for the phone number
- [ ] Asks for the email at the end, spells it back, and gets a confirmation
- [ ] Does **not** ask a declined caller for an email or a phone number
- [ ] Repeats back the budget, size and email, and gets a confirmation
- [ ] Declines only in the listed cases, kindly, with the decline sentence
- [ ] Does not decline for no budget, a budget above ₹2 lakh, a single room, a rented apartment, or not knowing exactly what they want
- [ ] Does not open with a recording, AI or privacy line
- [ ] Answers honestly if sincerely asked whether it is a person or an AI
- [ ] Never transfers the call
- [ ] Uses only facts from "About the studio"; says it will note anything else for the team
- [ ] Never promises a designer call, a callback, a time or a person
- [ ] Uses the same closing line for every caller it does not decline
- [ ] Works in the caller's language
