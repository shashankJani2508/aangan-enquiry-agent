import { describe, expect, it } from "vitest";
import { callerWordCount, extractCall, signBody, verifySignature } from "@/lib/vaani";
import { taskDueAt } from "@/lib/time";
import { DEFAULT_SETTINGS } from "@/lib/settings";

describe("Vaani webhook signature", () => {
  const body = '{"id":"evt_1","type":"call.completed","data":{}}';
  it("accepts the correct sha256= signature", () => expect(verifySignature(body, signBody(body, "s3cret"), "s3cret")).toBe(true));
  it("rejects a wrong secret", () => expect(verifySignature(body, signBody(body, "other"), "s3cret")).toBe(false));
  it("rejects a tampered body", () => expect(verifySignature(body + " ", signBody(body, "s3cret"), "s3cret")).toBe(false));
  it("rejects a missing prefix", () => expect(verifySignature(body, signBody(body, "s3cret").slice(7), "s3cret")).toBe(false));
  it("rejects a missing header or secret", () => {
    expect(verifySignature(body, null, "s3cret")).toBe(false);
    expect(verifySignature(body, signBody(body, ""), "")).toBe(false);
  });
});

describe("defensive parsing", () => {
  it("handles transcript arrays and masked numbers", () => {
    const c = extractCall({ call_id: "c1", from: "+91******1234", transcript: [{ role: "user", text: "hello there" }] });
    expect(c.vaani_call_id).toBe("c1");
    expect(c.phone_masked).toBe(true);
    expect(c.transcript).toBe("user: hello there");
  });
  it("counts only caller words when roles are present", () => {
    expect(callerWordCount("Agent: Good morning, Aangan Studio.\nCaller: hi")).toBe(1);
  });
});

describe("call task due time (IST)", () => {
  it("in working hours -> now", () => {
    const d = new Date("2026-10-12T06:00:00Z"); // Mon 11:30 IST
    expect(taskDueAt(d, DEFAULT_SETTINGS).toISOString()).toBe(d.toISOString());
  });
  it("Saturday 22:00 IST -> Monday 10:00 IST", () => {
    expect(taskDueAt(new Date("2026-10-10T16:30:00Z"), DEFAULT_SETTINGS).toISOString()).toBe("2026-10-12T04:30:00.000Z");
  });
  it("Tuesday 08:00 IST -> same day 10:00 IST", () => {
    expect(taskDueAt(new Date("2026-10-13T02:30:00Z"), DEFAULT_SETTINGS).toISOString()).toBe("2026-10-13T04:30:00.000Z");
  });
});

import { normaliseType, toEnvelope } from "@/lib/vaani";
describe("dashboard event names", () => {
  it.each([
    ["Call Post-Processing", "call.completed"],
    ["call_post_processing", "call.completed"],
    ["call.completed", "call.completed"],
    ["Call Ended", "call.ended"],
    ["Call Failed", "call.failed"],
    ["call.failed", "call.failed"],
  ])("%s -> %s", (a, b) => expect(normaliseType(a)).toBe(b));
  it("builds an envelope from a flat payload", () => {
    const e = toEnvelope({ event: "Call Post-Processing", call_id: "c9", transcript: "x" }, null, "dlv_1", "h");
    expect(e).toMatchObject({ id: "dlv_1", type: "call.completed", data: { call_id: "c9" } });
  });
});

import { stripRecording, verifyUrlKey } from "@/lib/vaani";
describe("real Vaani delivery format (captured 10 Oct 2026)", () => {
  const body = { event: "call_postprocessing", call_id: "r1", data: { room_name: "r1", call_id: "r1", call_duration: 120, end_reason: "completed", summary: "S", entities: { customer_name: "John" }, dispositions: { call_disposition: "Interested" }, recording_url: "https://x/r.mp3", transcript: "Agent: Hello\nUser: Hi" } };
  it("maps fields and drops the recording", () => {
    const e = toEnvelope(JSON.parse(stripRecording(JSON.stringify(body))), null, null, "h");
    expect(e.type).toBe("call.completed");
    expect(JSON.stringify(e)).not.toContain("recording");
    const c = extractCall(e.data);
    expect(c).toMatchObject({ vaani_call_id: "r1", duration_sec: 120, ended_reason: "completed", summary: "S", transcript: "Agent: Hello\nUser: Hi" });
    expect(c.structured_fields).toMatchObject({ customer_name: "John", dispositions: { call_disposition: "Interested" } });
  });
  it("URL key auth", () => {
    const k = "k".repeat(32);
    expect(verifyUrlKey(`https://x/api?k=${k}`, k)).toBe(true);
    expect(verifyUrlKey(`https://x/api?k=wrong`, k)).toBe(false);
    expect(verifyUrlKey(`https://x/api`, k)).toBe(false);
    expect(verifyUrlKey(`https://x/api?k=`, "")).toBe(false);
  });
});

import { looksLikeVaani } from "@/lib/vaani";
describe("unsigned Vaani guard", () => {
  const ok = JSON.stringify({ event: "call_postprocessing", call_id: "r1", data: { call_id: "r1" } });
  it("accepts Vaani's exact shape", () => expect(looksLikeVaani("call_postprocessing", ok)).toBe(true));
  it("accepts without the header (real calls send none)", () => expect(looksLikeVaani(null, ok)).toBe(true));
  it("rejects unknown events", () => expect(looksLikeVaani("lead_spam", ok)).toBe(false));
  it("rejects header/body mismatch", () => expect(looksLikeVaani("call_failed", ok)).toBe(false));
  it("rejects missing call id", () => expect(looksLikeVaani("call_postprocessing", '{"event":"call_postprocessing"}')).toBe(false));
});

import { schedulingLink } from "@/lib/calendly";
describe("Calendly free-plan link", () => {
  it("prefills name and email", () => {
    expect(schedulingLink("https://calendly.com/aangan/consultation", "Rohan Rao", "r@x.com")).toBe("https://calendly.com/aangan/consultation?name=Rohan+Rao&email=r%40x.com");
  });
});

describe("real Vaani call (11 Oct 2026)", () => {
  const body = JSON.stringify({ event: "call_postprocessing", call_id: "outbound-1", to: "+91x", from: "+91y", data: { call_id: "outbound-1", phone_number: "+919800000000", transcript: "[07:45:16] AGENT: Hello, Aangan Studio,\n[07:45:20] USER: Yeah. Tell me about an office." } });
  it("is accepted without the x-webhook-event header", () => expect(looksLikeVaani(null, body)).toBe(true));
  it("counts caller words in timestamped transcripts", () => {
    expect(callerWordCount("[07:45:16] AGENT: Hello, Aangan Studio,\n[07:45:20] USER: Yeah. Tell me about an office.")).toBe(6);
  });
});
