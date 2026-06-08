import { describe, it, expect } from "vitest";
import {
  shapeReply,
  pickFallback,
  safeAskLili,
  OFFLINE_LINE,
  FALLBACK_LINES,
} from "../lili_house_aitown.jsx";

const ctx = { liliRoom: "art", liliAction: "малює", youRoom: "office", together: false };
const zero = () => 0; // deterministic rng → FALLBACK_LINES[0]

const okClient = (reply) => ({ messages: { create: async () => ({ content: [{ type: "text", text: reply }] }) } });
const failClient = (status) => ({
  messages: {
    create: async () => {
      const e = new Error("boom");
      e.status = status;
      throw e;
    },
  },
});

describe("HVN-015 — voice shaping", () => {
  it("trims and collapses whitespace without altering language", () => {
    expect(shapeReply("  Малюю   гори.  ")).toBe("Малюю гори.");
    expect(shapeReply("")).toBe("");
    expect(shapeReply(null)).toBe("");
  });

  it("strips stray list bullets and leading enumerators", () => {
    expect(shapeReply("- гора\n- море\n* небо")).toBe("гора море небо");
    expect(shapeReply("1. перше\n2) друге")).toBe("перше друге");
    expect(shapeReply("• пункт")).toBe("пункт");
  });
});

describe("HVN-015 — pickFallback", () => {
  it("returns the offline line for key/auth problems (401/403)", () => {
    expect(pickFallback({ status: 401 }, zero)).toBe(OFFLINE_LINE);
    expect(pickFallback({ status: 403 }, zero)).toBe(OFFLINE_LINE);
  });

  it("returns a distracted line for transient failures", () => {
    expect(pickFallback({ status: 429 }, zero)).toBe(FALLBACK_LINES[0]);
    expect(pickFallback(new Error("network"), zero)).toBe(FALLBACK_LINES[0]);
    expect(pickFallback(null, zero)).toBe(FALLBACK_LINES[0]);
  });
});

describe("HVN-015 — safeAskLili", () => {
  it("shapes a successful reply", async () => {
    const reply = await safeAskLili({ text: "Що робиш?", context: ctx, client: okClient("  Малюю   гори.  ") });
    expect(reply).toBe("Малюю гори.");
  });

  it("flattens a list-y reply into one in-character line", async () => {
    const reply = await safeAskLili({ text: "x", context: ctx, client: okClient("- гора\n- море") });
    expect(reply).toBe("гора море");
  });

  it("falls back in character on a transient API error (no raw error)", async () => {
    const reply = await safeAskLili({ text: "x", context: ctx, client: failClient(429), rng: zero });
    expect(reply).toBe(FALLBACK_LINES[0]);
  });

  it("returns the offline line on an auth error", async () => {
    const reply = await safeAskLili({ text: "x", context: ctx, client: failClient(401), rng: zero });
    expect(reply).toBe(OFFLINE_LINE);
  });

  it("returns the offline line when no key and no injected client", async () => {
    // test env has no VITE_ANTHROPIC_API_KEY and we pass no client
    const reply = await safeAskLili({ text: "x", context: ctx });
    expect(reply).toBe(OFFLINE_LINE);
  });

  it("falls back when the model returns an empty reply", async () => {
    const reply = await safeAskLili({ text: "x", context: ctx, client: okClient(""), rng: zero });
    expect(reply).toBe(FALLBACK_LINES[0]);
  });
});
