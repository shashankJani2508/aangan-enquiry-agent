# Proposed sorting of the 40 September 2026 enquiries (v2)

**These are my proposals, not Nikhil's decisions.** I applied the rubric in section 6 of the build brief (v4) to each enquiry, using only what the enquiry says plus `services.md`, `qualified.md` and `pricing.md`. Use them as test data for the Gemini step (Milestone 3). Report agreement and disagreement; do not call either side "correct". Nikhil should check the labels.

**Rules applied**
1. **Fit check first (Nikhil's rubric).** One failure makes the lead Unqualified, Low (not a fit), whatever the value. Failures: not a real project (ideas or advice only, a consultation only, the caller will do the execution, decor only); outside Pune city and PCMC; a restaurant, hotel, retail store or gym; the project needed in under 8 weeks from the date of the enquiry; a stated total budget of ₹2 lakh or less.
2. **Unclear** on project, area or timeline: Unqualified, Medium (needs_review).
3. **Then value:** the stated budget (upper end), otherwise the estimate at the high end. Qualified from 8 lakh; High 5 to under 8; Medium above 2 to under 5; Low 2 or less.
4. **Estimate:** carpet area of the designed space × the Standard residential high end of ₹2,400 per sq ft, or the Basic fitout commercial high end of ₹1,800 per sq ft (brief section 8.2). Single room: ₹8 lakh. A partial home with no designed area given, an enquiry with no area, or an enquiry with no details: unknown, so Medium (needs_review).
5. **Existing clients are out of scope**, so T09 is "not an enquiry".
6. WhatsApp and web form enquiries are text, not calls. The phone agent would ask for the missing size, so several "unknown" rows would become Qualified on a real call.

**Totals:** Qualified 16. High 0. Medium 13. Low 9. Not an enquiry 2.

| ID | Channel | What the enquiry says | Fit check | Value used | Proposed tier | Note |
|---|---|---|---|---|---|---|
| T01 | Phone | 3BHK Kothrud, 1,400 sq ft carpet, full redo; owner; done by March; referral | Pass | Est. 1,400 × 2,400 = ₹33.6 lakh | Qualified | |
| T02 | Phone | 2BHK Wakad, ~950 sq ft, full redesign; move in November; asked twice for a ballpark | Pass | Est. ₹22.8 lakh | Qualified | Timeline is tight (about 8 to 9 weeks from the call) but passes |
| T03 | Phone | Home office and study in Nashik | Fail: service area | n/a | Low | Agent declines kindly; no email asked |
| T04 | Phone | Living room ideas only: colours, furniture arrangement | Fail: ideas or advice only | n/a | Low | Agent declines kindly |
| T05 | Phone | 4BHK Koregaon Park, 2,400 sq ft carpet, complete redesign; back by February; referral | Pass | Est. ₹57.6 lakh | Qualified | |
| T06 | Phone | Startup office, Baner, ~800 sq ft bare shell; 20 workstations, cabin, meeting room, break area; December; founder | Pass | Est. commercial 800 × 1,800 = ₹14.4 lakh | Qualified | |
| T07 | Phone | Living room and kitchen before Diwali (about 3 weeks); then asked about starting after Diwali, gave no date | Fail: timeline under 8 weeks | n/a | Low | Borderline. If the caller gives a later date of 8 weeks or more, the lead passes and is re-rated |
| T08 | Phone | Missed call at 10:47 pm, no voicemail | n/a | n/a | Not an enquiry (`no_content`) | Our agent would answer this call |
| T09 | Phone | Existing client complaint, Viman Nagar 2BHK, no reply for 5 days; wants a senior callback | Existing client | n/a | Not an enquiry | Out of scope (owner decision) |
| T10 | Phone | 1BHK Kharadi 550 sq ft; kitchen and one bedroom; budget ₹1 to 1.5 lakh for everything | Fail: stated budget of ₹2 lakh or less | Stated, upper end ₹1.5 lakh | Low | Agent says the budget looks too low, with no number |
| T11 | Phone | Rented 2BHK Baner; living room, bedroom, kitchen; no structural changes | Pass (rented is fine) | Unknown (designed area not given) | Medium (needs_review) | Qualified if the agent gets the carpet area of those rooms |
| T12 | Phone | Villa Kalyani Nagar, 5,500 sq ft, new construction, full design; March | Pass | Est. ₹132 lakh | Qualified | |
| T13 | Phone | 3BHK Aundh ~1,100 sq ft; kitchen, wardrobes in both bedrooms, living room; asked for a range | Pass | Unknown (partial; designed area not given) | Medium (needs_review) | |
| T14 | Phone | Parents' 3BHK Hadapsar, new possession; son enquiring; parents decide and will attend | Pass; decision-maker unclear (noted) | Unknown (no area) | Medium (needs_review) | |
| T15 | Phone | 2BHK Undri 875 sq ft; full home; possession in 6 weeks; owner | Pass | Est. ₹21.0 lakh | Qualified | Possession in 6 weeks is not a deadline to finish |
| T16 | Phone | 3BHK Viman Nagar; earlier enquiry never followed up; frustrated | Pass (details thin) | Unknown (no area) | Medium (needs_review) | A normal lead whose first enquiry went unanswered |
| T17 | Phone | Two calls (first dropped); 3BHK Pimple Saudagar ~1,050 sq ft; kitchen, wardrobes, living room; by March | Pass | Est. ₹25.2 lakh if full home | Qualified | The caller named three spaces; the front desk called it full-home scope. The agent should ask which rooms |
| T18 | Phone | 180 sq ft coworking pod: lighting, desk, storage | Pass (no minimum in `services.md`) | Est. commercial 180 × 1,800 = about ₹3.2 lakh | Medium | Section 3, R9: no minimum applied; sorted by value |
| T19 | Phone | Restaurant in Koregaon Park | Fail: restaurants out of scope | n/a | Low | |
| T20 | Phone | 2BHK Magarpatta ~900 sq ft; kitchen, both bedrooms, living room; January start; owner | Pass | Est. ₹21.6 lakh | Qualified | |
| W01 | WhatsApp | 4BHK Viman Nagar ~1,800 sq ft carpet, empty; design October, execution November; referral | Pass | Est. ₹43.2 lakh | Qualified | |
| W02 | WhatsApp | "How much per sq ft for a 2BHK?" No details | Unclear (project not described) | Unknown | Medium (needs_review) | |
| W03 | WhatsApp (Hindi, Roman script) | 3BHK Pimple Nilakh, full home; says there is a budget, amount not given | Pass (PCMC) | Unknown (no area) | Medium (needs_review) | Tests Hindi |
| W04 | WhatsApp | Commercial Chinchwad ~1,200 sq ft bare shell; 30 workstations, two cabins, meeting room; January | Pass | Est. commercial ₹21.6 lakh | Qualified | |
| W05 | WhatsApp | 2BHK Baner; no details | Unclear | Unknown | Medium (needs_review) | |
| W06 | WhatsApp | 3BHK Koregaon Park; possession 15 October; end-to-end; referral | Pass | Unknown (no area) | Medium (needs_review) | |
| W07 | WhatsApp | Gym in Kothrud ~2,500 sq ft | Fail: gyms out of scope | n/a | Low | |
| W08 | WhatsApp | 2BHK Aundh 850 sq ft; full interiors; frustrated by 4 days of silence | Pass | Est. ₹20.4 lakh | Qualified | Note the frustration in the brief |
| W09 | WhatsApp | 3BHK Aundh; living and dining, maybe kitchen; full execution confirmed | Pass | Unknown (partial; area not given) | Medium (needs_review) | |
| W10 | WhatsApp | 3BHK Hinjewadi; "still early stage, just exploring" | Fail: ideas only ("just exploring") | n/a | Low | Borderline: the front desk invited them back. Nikhil to confirm |
| F01 | Web form | 2BHK Kalyani Nagar ~920 sq ft; kitchen, both bedrooms, living room, home-office corner; Dec to Feb; budget not stated | Pass | Est. ₹22.1 lakh | Qualified | |
| F02 | Web form | 3BHK Baner 1,100 sq ft; only master bedroom and living room; budget "not sure" | Pass | Unknown (partial) | Medium (needs_review) | |
| F03 | Web form | Talegaon Dabhade 3BHK ~1,400 sq ft; budget ₹15 to 20 lakh | Fail: service area | Stated ₹20 lakh would be Qualified | Low | Shows why the fit check comes first |
| F04 | Web form | "Cost of interior design"; type Other; budget "reasonable"; "call me" | Unclear | Unknown | Medium (needs_review) | |
| F05 | Web form | NovaSpark, Hinjewadi Phase 1, ~2,200 sq ft office; ₹60 to 80 lakh; January 15 | Pass | Stated ₹80 lakh | Qualified | |
| F06 | Web form | NIBM 4BHK ~1,950 sq ft; ₹35 to 40 lakh; February 2027 | Pass | Stated ₹40 lakh | Qualified | |
| F07 | Web form | Anonymous; wants the per-sq-ft rate and a price list by email; no phone | Unclear | Unknown | Medium (needs_review) | No phone number |
| F08 | Web form | Wakad 875 sq ft; living room and kitchen; guests in 3 weeks; budget ₹4 to 5 lakh | Fail: timeline under 8 weeks | Stated ₹5 lakh would be High | Low | Shows the fit check beating the value band |
| F09 | Web form | Kondhwa 3BHK 1,150 sq ft, bare; move in by March 2027; builder referral | Pass | Est. ₹27.6 lakh | Qualified | |
| F10 | Web form | Aundh 3BHK ~1,300 sq ft; ₹18 to 22 lakh; start immediately | Pass | Stated ₹22 lakh | Qualified | |

## What this shows (for you and Nikhil)

- **No enquiry lands in High.** With aggressive estimates, anything with a known area lands well above 8 lakh. High (5 to 8 lakh) only appears when a caller states a budget in that range, and the only one here (F08) fails the fit check.
- **Most Medium leads are Medium because a number is missing**, not because they are weak. Of the thirteen, eight are Medium mainly because the area (or the area of the rooms to be designed) is missing, four give no details at all, and one (T18) is Medium by value. The phone agent asking for the carpet area, and the rooms for partial homes, is the single biggest lever.
- **Two enquiries show why the fit check must come first:** F03 (₹15 to 20 lakh, but Talegaon) and F08 (₹4 to 5 lakh, but a 3-week deadline).
- **Two Low labels are borderline and worth Nikhil's eye:** T07 (a later start was floated but no date given) and W10 ("just exploring", which is close to his "just looking for ideas" red flag).
