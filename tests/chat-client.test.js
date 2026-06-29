import { describe, it, expect } from "vitest";
import {
  askAgent,
  CHAT_MODEL,
  CHAT_MAX_TOKENS,
  buildSystemPrompt,
  AGENT_CANON,
} from "../lili_house_aitown.jsx";

// A fake Anthropic client that captures the request and returns a canned reply.
function fakeClient(reply = "Привіт!") {
  const calls = [];
  return {
    calls,
    messages: {
      create: async (args) => {
        calls.push(args);
        return { content: [{ type: "text", text: reply }] };
      },
    },
  };
}

const ctx = { agentRoom: "art", agentAction: "малює (Майстерня Лілі)", youRoom: "office", together: false };

describe("HVN-013 — frontend Claude chat client (askAgent)", () => {
  it("CHAT_MODEL defaults to the main model; max_tokens is small", () => {
    expect(CHAT_MODEL).toBe("claude-opus-4-8");
    expect(CHAT_MAX_TOKENS).toBeLessThanOrEqual(1000);
  });

  it("returns Лілі's reply text", async () => {
    const client = fakeClient("Усе добре, малюю.");
    const reply = await askAgent({ text: "Як справи?", context: ctx, client });
    expect(reply).toBe("Усе добре, малюю.");
  });

  it("sends model, small max_tokens, the assembled system prompt, and the turns", async () => {
    const client = fakeClient();
    const history = [
      { role: "user", content: "Привіт" },
      { role: "assistant", content: "Вітаю!" },
    ];
    await askAgent({ text: "Що малюєш?", context: ctx, history, client });

    const args = client.calls[0];
    expect(args.model).toBe(CHAT_MODEL);
    expect(args.max_tokens).toBe(CHAT_MAX_TOKENS);
    expect(args.system).toBe(buildSystemPrompt(ctx));
    expect(args.system).toContain(AGENT_CANON);
    // history + new user turn, in order; no trailing assistant prefill
    expect(args.messages).toEqual([
      { role: "user", content: "Привіт" },
      { role: "assistant", content: "Вітаю!" },
      { role: "user", content: "Що малюєш?" },
    ]);
    expect(args.messages.at(-1).role).toBe("user");
  });

  it("defaults to an empty history (only the user turn)", async () => {
    const client = fakeClient();
    await askAgent({ text: "Привіт", context: ctx, client });
    expect(client.calls[0].messages).toEqual([{ role: "user", content: "Привіт" }]);
  });

  it("extracts the text block even when other block types precede it", async () => {
    const client = {
      messages: {
        create: async () => ({
          content: [{ type: "thinking", thinking: "…" }, { type: "text", text: "Ось відповідь." }],
        }),
      },
    };
    expect(await askAgent({ text: "x", context: ctx, client })).toBe("Ось відповідь.");
  });

  it("returns an empty string when there is no text block", async () => {
    const client = { messages: { create: async () => ({ content: [] }) } };
    expect(await askAgent({ text: "x", context: ctx, client })).toBe("");
  });
});
