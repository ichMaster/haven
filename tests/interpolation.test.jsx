import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Scene,
  computeWallMap,
  deriveRoomGrid,
  makeRoomAt,
  initialSim,
  GLIDE_LILI,
  GLIDE_YOU,
  TILE,
} from "../lili_house_aitown.jsx";

const wallMap = computeWallMap();
const roomAt = makeRoomAt(deriveRoomGrid(wallMap));
const renderScene = (sim, extra = {}) =>
  render(
    <Scene
      sim={sim}
      wallMap={wallMap}
      roomAt={roomAt}
      liliDur={GLIDE_LILI}
      youDur={GLIDE_YOU}
      {...extra}
    />,
  ).container;

describe("HVN-009 — smooth sprite interpolation", () => {
  it("pins the glide durations (Лілі ≈ 0.7s, player ≈ 0.18s)", () => {
    expect(GLIDE_LILI).toBeCloseTo(0.7, 5);
    expect(GLIDE_YOU).toBeCloseTo(0.18, 5);
  });

  it("positions sprites via a transform translate to their cell", () => {
    const sim = { ...initialSim(), lili: { x: 5, y: 3, acting: false, actTicks: 0 } };
    const c = renderScene(sim);
    const lili = c.querySelector('[data-sprite="Лілі"]');
    expect(lili.getAttribute("transform")).toBe(`translate(${5 * TILE}, ${3 * TILE})`);
  });

  it("applies a CSS transform transition to each sprite", () => {
    const c = renderScene(initialSim());
    const lili = c.querySelector('[data-sprite="Лілі"]');
    const you = c.querySelector('[data-sprite="ти"]');
    expect(lili.style.transition).toContain("transform");
    expect(lili.style.transition).toContain("0.7s");
    expect(you.style.transition).toContain("transform");
    expect(you.style.transition).toContain("0.18s");
  });

  it("glides the speech bubble together with Лілі", () => {
    const c = renderScene({ ...initialSim(), voice: "Привіт!" });
    const bubble = c.querySelector('[data-layer="bubble"]');
    expect(bubble).toBeTruthy();
    expect(bubble.style.transition).toContain("0.7s");
    // bubble is anchored to Лілі's cell so it tracks her
    expect(bubble.getAttribute("transform")).toContain("translate(");
  });

  it("snaps (no transition) when a duration of 0 is passed", () => {
    const c = renderScene(initialSim(), { liliDur: 0, youDur: 0 });
    const lili = c.querySelector('[data-sprite="Лілі"]');
    expect(lili.style.transition).toBe("none");
  });
});
