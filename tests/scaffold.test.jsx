import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import LiliHouseAITown, {
  W,
  H,
  TILE,
  SW,
  SH,
  PALETTE,
  initialSim,
} from "../lili_house_aitown.jsx";

describe("HVN-001 — scaffold & technical basis", () => {
  it("pins the grid/scene constants", () => {
    expect(W).toBe(29);
    expect(H).toBe(15);
    expect(TILE).toBe(24);
    expect(SW).toBe(696);
    expect(SH).toBe(360);
  });

  it("applies the AI Town palette", () => {
    expect(PALETTE.page).toBe("#f3efe6");
    expect(PALETTE.surround).toBe("#bcd9b0");
  });

  it("seeds the simulation state container", () => {
    const s = initialSim();
    expect(s.day).toBe(1);
    expect(typeof s.t).toBe("number");
    expect(Array.isArray(s.log)).toBe(true);
  });

  it("mounts and renders a scaled SVG canvas", () => {
    const { container } = render(<LiliHouseAITown />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg.getAttribute("viewBox")).toBe("0 0 696 360");
    expect(svg.getAttribute("width")).toBe("100%");
  });
});
