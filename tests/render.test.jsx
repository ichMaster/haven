import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Scene,
  dayNightOpacity,
  computeWallMap,
  deriveRoomGrid,
  makeRoomAt,
  initialSim,
  NIGHT_MAX,
  OBJECTS,
} from "../lili_house_aitown.jsx";

const wallMap = computeWallMap();
const roomAt = makeRoomAt(deriveRoomGrid(wallMap));
const renderScene = (sim) =>
  render(<Scene sim={sim} wallMap={wallMap} roomAt={roomAt} />).container;

describe("HVN-008 — dayNightOpacity", () => {
  it("is 0 by day and peaks at NIGHT_MAX deep at night", () => {
    expect(dayNightOpacity(12 * 60)).toBe(0); // noon
    expect(dayNightOpacity(9 * 60)).toBe(0);
    expect(dayNightOpacity(23 * 60)).toBe(NIGHT_MAX); // night
    expect(dayNightOpacity(2 * 60)).toBe(NIGHT_MAX);
  });

  it("tapers through dusk and dawn and never exceeds NIGHT_MAX", () => {
    const dusk = dayNightOpacity(19.5 * 60); // between 18 and 21
    expect(dusk).toBeGreaterThan(0);
    expect(dusk).toBeLessThan(NIGHT_MAX);
    for (let t = 0; t < 1440; t += 15) {
      const o = dayNightOpacity(t);
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(NIGHT_MAX);
    }
  });
});

describe("HVN-008 — Scene render", () => {
  it("renders wood walls (base + top band) and pastel floors", () => {
    const c = renderScene(initialSim());
    expect(c.querySelector('rect[fill="#c9a87a"]')).toBeTruthy(); // wall base
    expect(c.querySelector('rect[fill="#dcc295"]')).toBeTruthy(); // top band
    expect(c.querySelector('rect[fill="#e6d6f2"]')).toBeTruthy(); // studio floor
    expect(c.querySelector('rect[fill="#f1e7c0"]')).toBeTruthy(); // kitchen floor
  });

  it("renders every ITEM glyph as centered text", () => {
    const c = renderScene(initialSim());
    const texts = [...c.querySelectorAll('[data-layer="props"] text')].map((t) => t.textContent);
    for (const o of OBJECTS) expect(texts).toContain(o.glyph);
    expect(texts).toContain("🪟"); // a decor prop
  });

  it("renders both sprites with their body colors and name tags", () => {
    const c = renderScene(initialSim());
    const lili = c.querySelector('[data-sprite="Лілі"]');
    const you = c.querySelector('[data-sprite="ти"]');
    expect(lili).toBeTruthy();
    expect(you).toBeTruthy();
    expect(lili.querySelector('rect[fill="#b3508f"]')).toBeTruthy(); // Лілі body
    expect(you.querySelector('rect[fill="#3a6ea5"]')).toBeTruthy(); // player body
    expect(lili.querySelector("text").textContent).toBe("Лілі");
    expect(you.querySelector("text").textContent).toBe("ти");
    // Лілі has the pink streak; the player does not
    expect(lili.querySelector('rect[fill="#ff7fc4"]')).toBeTruthy();
    expect(you.querySelector('rect[fill="#ff7fc4"]')).toBeNull();
  });

  it("shows the speech bubble only for a real line", () => {
    expect(renderScene({ ...initialSim(), voice: "Привіт!" }).querySelector('[data-layer="bubble"]'))
      .toBeTruthy();
    expect(renderScene({ ...initialSim(), voice: "Привіт!" }).textContent).toContain("Привіт!");
    expect(renderScene({ ...initialSim(), voice: "…" }).querySelector('[data-layer="bubble"]'))
      .toBeNull();
    expect(renderScene({ ...initialSim(), voice: "" }).querySelector('[data-layer="bubble"]'))
      .toBeNull();
  });

  it("day/night overlay uses the tint color and tracks the clock", () => {
    const day = renderScene({ ...initialSim(), t: 8 * 60 }).querySelector('[data-layer="daynight"]');
    const night = renderScene({ ...initialSim(), t: 23 * 60 }).querySelector('[data-layer="daynight"]');
    expect(day.getAttribute("fill")).toBe("#2a3a6a");
    expect(Number(day.getAttribute("opacity"))).toBe(0);
    expect(Number(night.getAttribute("opacity"))).toBeCloseTo(NIGHT_MAX, 5);
  });
});
