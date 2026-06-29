import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import AgentHouseAITown, {
  dirForKey,
  tryMove,
  isTypingTarget,
  computeWallMap,
  deriveWalkable,
  TILE,
} from "../lili_house_aitown.jsx";

const walkable = deriveWalkable(computeWallMap());

afterEach(cleanup);

describe("HVN-010 — player movement helpers", () => {
  it("maps arrows and WASD (case-insensitive) to directions", () => {
    expect(dirForKey("ArrowUp")).toEqual([0, -1]);
    expect(dirForKey("ArrowDown")).toEqual([0, 1]);
    expect(dirForKey("ArrowLeft")).toEqual([-1, 0]);
    expect(dirForKey("ArrowRight")).toEqual([1, 0]);
    expect(dirForKey("w")).toEqual([0, -1]);
    expect(dirForKey("W")).toEqual([0, -1]); // shift held
    expect(dirForKey("a")).toEqual([-1, 0]);
    expect(dirForKey("s")).toEqual([0, 1]);
    expect(dirForKey("d")).toEqual([1, 0]);
    expect(dirForKey("q")).toBeNull();
    expect(dirForKey("Enter")).toBeNull();
  });

  it("moves into an adjacent walkable cell", () => {
    // office interior (22,8); up → (22,7) is walkable
    expect(tryMove({ x: 22, y: 8 }, [0, -1], walkable)).toEqual({ x: 22, y: 7 });
  });

  it("rejects moves into a wall", () => {
    // (17,6) office corner; left (16,6) is a wall
    expect(tryMove({ x: 17, y: 6 }, [-1, 0], walkable)).toEqual({ x: 17, y: 6 });
  });

  it("rejects moves out of bounds", () => {
    const tiny = [
      [true, true],
      [true, true],
    ];
    expect(tryMove({ x: 0, y: 0 }, [-1, 0], tiny)).toEqual({ x: 0, y: 0 });
    expect(tryMove({ x: 0, y: 0 }, [0, -1], tiny)).toEqual({ x: 0, y: 0 });
  });

  it("detects text-field focus targets", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingTarget({ isContentEditable: true, tagName: "DIV" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("HVN-010 — keyboard movement (mounted)", () => {
  const playerTransform = (c) =>
    c.querySelector('[data-sprite="ти"]').getAttribute("transform");

  it("walks the player one cell on an arrow/WASD key", () => {
    const { container } = render(<AgentHouseAITown />);
    // starts in the office at (22,8)
    expect(playerTransform(container)).toBe(`translate(${22 * TILE}, ${8 * TILE})`);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(playerTransform(container)).toBe(`translate(${21 * TILE}, ${8 * TILE})`);
    fireEvent.keyDown(window, { key: "w" });
    expect(playerTransform(container)).toBe(`translate(${21 * TILE}, ${7 * TILE})`);
  });

  it("ignores movement keys while a text field is focused", () => {
    const { container } = render(<AgentHouseAITown />);
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const before = playerTransform(container);
    fireEvent.keyDown(input, { key: "ArrowLeft" });
    expect(playerTransform(container)).toBe(before);
    input.remove();
  });
});
