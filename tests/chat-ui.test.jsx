import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import AgentHouseAITown, { TILE } from "../lili_house_aitown.jsx";

afterEach(cleanup);

const chatInput = (c) => c.querySelector("[data-chat-input]");
const chatForm = (c) => c.querySelector('[data-panel="chat"] form');

describe("HVN-014 — chat panel UI (mounted)", () => {
  it("renders the chat panel with a transcript, input, and send button", () => {
    const { container } = render(<AgentHouseAITown chat={async () => "x"} />);
    expect(container.querySelector('[data-panel="chat"]')).toBeTruthy();
    expect(chatInput(container)).toBeTruthy();
    expect(container.querySelector('[data-panel="chat"] button[type="submit"]')).toBeTruthy();
  });

  it("sends a message, shows the user turn and Лілі's grounded reply, clears input", async () => {
    let captured = null;
    const chat = async (args) => {
      captured = args;
      return "Малюю гори.";
    };
    const { container, findByText } = render(<AgentHouseAITown chat={chat} />);

    const input = chatInput(container);
    fireEvent.change(input, { target: { value: "Що ти робиш?" } });
    fireEvent.submit(chatForm(container));

    await findByText("Що ти робиш?"); // user turn rendered
    await findByText("Малюю гори."); // reply rendered
    expect(input.value).toBe(""); // input cleared

    // grounded in the live context from simRef (start: Лілі studio, you office)
    expect(captured.text).toBe("Що ти робиш?");
    expect(captured.context.agentRoom).toBe("art");
    expect(captured.context.youRoom).toBe("office");
    expect(captured.history).toEqual([]); // first turn → empty prior history
  });

  it("ignores movement keys while the chat input is focused", () => {
    const { container } = render(<AgentHouseAITown chat={async () => "ok"} />);
    const player = () => container.querySelector('[data-sprite="ти"]').getAttribute("transform");
    const before = player();
    const input = chatInput(container);
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowLeft" });
    fireEvent.keyDown(input, { key: "a" });
    expect(player()).toBe(before); // no movement
    // sanity: a key NOT in a text field still moves the player
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(player()).not.toBe(before);
  });
});
