import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Scene,
  computeWallMap,
  deriveRoomGrid,
  makeRoomAt,
  initialSim,
  GLIDE_AGENT,
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
      agentDur={GLIDE_AGENT}
      youDur={GLIDE_YOU}
      {...extra}
    />,
  ).container;

describe("HVN-009 — smooth sprite interpolation", () => {
  it("pins the glide durations (Лілі ≈ 0.7s, player ≈ 0.18s)", () => {
    expect(GLIDE_AGENT).toBeCloseTo(0.7, 5);
    expect(GLIDE_YOU).toBeCloseTo(0.18, 5);
  });

  it("positions sprites via a transform translate to their cell", () => {
    const sim = { ...initialSim(), agent: { x: 5, y: 3, acting: false, actTicks: 0 } };
    const c = renderScene(sim);
    const agent = c.querySelector('[data-sprite="Лілі"]');
    expect(agent.getAttribute("transform")).toBe(`translate(${5 * TILE}, ${3 * TILE})`);
  });

  it("applies a CSS transform transition to each sprite", () => {
    const c = renderScene(initialSim());
    const agent = c.querySelector('[data-sprite="Лілі"]');
    const you = c.querySelector('[data-sprite="ти"]');
    expect(agent.style.transition).toContain("transform");
    expect(agent.style.transition).toContain("0.7s");
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
    const c = renderScene(initialSim(), { agentDur: 0, youDur: 0 });
    const agent = c.querySelector('[data-sprite="Лілі"]');
    expect(agent.style.transition).toBe("none");
  });
});
