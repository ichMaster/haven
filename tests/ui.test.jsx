import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import LiliHouseAITown, {
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
    expect(roomView("art", "office")).toEqual({ together: false, lili: "art", you: "office" });
    expect(roomView("kitchen", "kitchen")).toEqual({ together: true, room: "kitchen" });
  });
});

describe("HVN-011 — panel render (mounted)", () => {
  it("renders four drive bars of 10 blocks each", () => {
    const { container } = render(<LiliHouseAITown />);
    for (const k of DRIVE_KEYS) {
      const bar = container.querySelector(`[data-bar="${k}"]`);
      expect(bar, k).toBeTruthy();
      const blocks = [...bar.textContent].filter((ch) => ch === "█" || ch === "░");
      expect(blocks.length).toBe(10);
    }
  });

  it("shows the action line with the ▸ marker", () => {
    const { container } = render(<LiliHouseAITown />);
    expect(container.querySelector("[data-action]").textContent).toContain("▸");
  });

  it("shows both room cards (Лілі in studio, you in office) by default", () => {
    const { container } = render(<LiliHouseAITown />);
    const lili = container.querySelector('[data-card="lili"]');
    const you = container.querySelector('[data-card="you"]');
    expect(lili).toBeTruthy();
    expect(you).toBeTruthy();
    expect(lili.textContent).toContain(ROOMS.art.name); // Майстерня Лілі
    expect(you.textContent).toContain(ROOMS.office.name); // Мій кабінет
    expect(container.querySelector('[data-card="together"]')).toBeNull();
    expect(lili.textContent).toContain(ROOMS.art.desc);
  });

  it("renders the event-log container and the movement hint", () => {
    const { container } = render(<LiliHouseAITown />);
    expect(container.querySelector('[data-panel="log"]')).toBeTruthy();
    expect(container.textContent).toContain("WASD");
  });
});
