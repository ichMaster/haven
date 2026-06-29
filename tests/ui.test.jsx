import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import AgentHouseAITown, {
  barString,
  roomView,
  DRIVE_KEYS,
  ROOMS,
} from "../lili_house_aitown.jsx";

afterEach(cleanup);

describe("HVN-011 — UI helpers", () => {
  it("barString renders 10 blocks filled by round(v/10)", () => {
    expect(barString(0)).toBe("░".repeat(10));
    expect(barString(100)).toBe("█".repeat(10));
    expect(barString(46)).toBe("█".repeat(5) + "░".repeat(5)); // round(4.6)=5
    expect(barString(52)).toBe("█".repeat(5) + "░".repeat(5)); // round(5.2)=5
    expect(barString(150)).toBe("█".repeat(10)); // clamped
    expect(barString(46).length).toBe(10);
  });

  it("roomView splits into two cards or collapses when together", () => {
    expect(roomView("art", "office")).toEqual({ together: false, agent: "art", you: "office" });
    expect(roomView("kitchen", "kitchen")).toEqual({ together: true, room: "kitchen" });
  });
});

describe("HVN-011 — panel render (mounted)", () => {
  it("renders four drive bars of 10 blocks each", () => {
    const { container } = render(<AgentHouseAITown />);
    for (const k of DRIVE_KEYS) {
      const bar = container.querySelector(`[data-bar="${k}"]`);
      expect(bar, k).toBeTruthy();
      const blocks = [...bar.textContent].filter((ch) => ch === "█" || ch === "░");
      expect(blocks.length).toBe(10);
    }
  });

  it("shows the action line with the ▸ marker", () => {
    const { container } = render(<AgentHouseAITown />);
    expect(container.querySelector("[data-action]").textContent).toContain("▸");
  });

  it("shows a thought card for the agent at home (Лілі), not the player", () => {
    const { container } = render(<AgentHouseAITown />);
    const agent = container.querySelector('[data-card="agent"]');
    expect(agent).toBeTruthy();
    expect(agent.textContent).toContain("Лілі");
    expect(agent.textContent).toContain(ROOMS.art.name); // her current room (studio)
    expect(agent.textContent).toContain("💭"); // a thought/observation
    expect(container.querySelector('[data-card="you"]')).toBeNull(); // player isn't an agent
  });

  it("shows the movement hint and no event-log panel", () => {
    const { container } = render(<AgentHouseAITown />);
    expect(container.textContent).toContain("WASD");
    expect(container.querySelector('[data-panel="log"]')).toBeNull(); // log removed
  });

  it("shows drives for the agent(s) in the location — Лілі at home", () => {
    const { container } = render(<AgentHouseAITown />);
    const drives = container.querySelector('[data-panel="drives"]');
    expect(drives.querySelector('[data-agent-drives="Лілі"]')).toBeTruthy();
    expect(drives.querySelectorAll("[data-bar]")).toHaveLength(DRIVE_KEYS.length); // one agent × 4
  });
});
