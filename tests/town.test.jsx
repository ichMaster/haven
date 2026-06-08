import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import LiliHouseAITown, { TownMap, TOWN, TOWN_RESIDENTS } from "../lili_house_aitown.jsx";

afterEach(cleanup);

describe("HVN — town map (preview)", () => {
  it("is an 8×4 grid; house and café are the travelable locations", () => {
    expect(TOWN).toHaveLength(32);
    const travelable = TOWN.filter((c) => c.loc);
    expect(travelable.map((c) => c.loc).sort()).toEqual(["cafe", "house"]);
    expect(travelable.every((c) => c.available)).toBe(true);
  });

  it("names real locations (no 'Скоро'); supermarket + park present", () => {
    expect(TOWN.every((c) => c.label && c.label !== "Скоро")).toBe(true);
    expect(TOWN.some((c) => c.label === "Супермаркет" && c.kind === "shop")).toBe(true);
    expect(TOWN.some((c) => c.label === "Парк")).toBe(true);
    // a cell is available iff it is travelable (has a loc)
    expect(TOWN.every((c) => Boolean(c.available) === Boolean(c.loc))).toBe(true);
  });

  it("renders travelable cells available and the rest locked", () => {
    const { container } = render(<TownMap />);
    expect(container.querySelectorAll('[data-available="true"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-available="false"]')).toHaveLength(30);
    expect(container.querySelector('[data-loc="cafe"]')).toBeTruthy();
    expect(container.textContent).toContain("Супермаркет");
    expect(container.textContent).toContain("🔒"); // locked marker
    expect(container.textContent).toContain("🚪"); // travelable (not active) marker
  });

  it("shows inhabitants in their location, labelled — incl. other agents elsewhere", () => {
    // Лілі and the player are home (cell 0)
    expect(TOWN_RESIDENTS[0].map((r) => r.name)).toEqual(["Лілі", "ти"]);
    const { container } = render(<TownMap />);
    const houseCell = container.querySelector('[data-available="true"]');
    expect(houseCell.querySelector('[data-resident="lili"]').textContent).toContain("Лілі");
    expect(houseCell.querySelector('[data-resident="you"]').textContent).toContain("ти");

    // other agents live in several other (locked) locations
    const populated = [...container.querySelectorAll("[data-residents]")];
    expect(populated.length).toBeGreaterThanOrEqual(5);
    expect(container.textContent).toContain("Марко"); // кафе
    expect(container.textContent).toContain("Оля"); // книгарня
    // a couple of locked cells now carry residents
    const lockedWithPeople = [...container.querySelectorAll('[data-available="false"]')].filter(
      (cell) => cell.querySelector("[data-residents]"),
    );
    expect(lockedWithPeople.length).toBeGreaterThanOrEqual(4);

    // some locations hold more than one agent (a few even 3)
    const counts = populated.map((cell) => cell.querySelectorAll("[data-resident]").length);
    expect(counts.filter((n) => n >= 2).length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(3);
  });

  it("is wired into the app below the scene", () => {
    const { container } = render(<LiliHouseAITown chat={async () => "x"} />);
    expect(container.querySelector("[data-town]")).toBeTruthy();
  });

  it("labels the scene with its town-map location (Дім Лілі)", () => {
    const { container } = render(<LiliHouseAITown chat={async () => "x"} />);
    expect(container.querySelector("[data-location]").textContent).toContain("Дім Лілі");
  });
});

describe("HVN — location navigation (house ↔ café)", () => {
  it("travels to the café from the map and back home", () => {
    const { container } = render(<LiliHouseAITown chat={async () => "x"} />);

    // starts at home: Лілі + you in the house scene
    expect(container.querySelector("[data-location]").textContent).toContain("Дім Лілі");
    expect(container.querySelector('[data-sprite="Лілі"]')).toBeTruthy();

    // click the café cell on the town map → travel
    fireEvent.click(container.querySelector('[data-loc="cafe"]'));
    expect(container.querySelector("[data-location]").textContent).toContain("Кафе");
    expect(container.querySelector('[data-sprite="Лілі"]')).toBeNull(); // Лілі stays home
    expect(container.querySelector('[data-sprite="ти"]')).toBeTruthy(); // you're at the café
    // the café cell is now the active one on the map
    expect(container.querySelector('[data-loc="cafe"]').getAttribute("data-active")).toBe("true");

    // back home via the header button
    fireEvent.click(container.querySelector("[data-location] button"));
    expect(container.querySelector("[data-location]").textContent).toContain("Дім Лілі");
    expect(container.querySelector('[data-sprite="Лілі"]')).toBeTruthy();
  });

  it("shows the café's agents (Марко, Зоя) and their drives when you visit", () => {
    const { container } = render(<LiliHouseAITown chat={async () => "x"} />);
    fireEvent.click(container.querySelector('[data-loc="cafe"]'));
    expect(container.querySelector('[data-sprite="Марко"]')).toBeTruthy();
    expect(container.querySelector('[data-sprite="Зоя"]')).toBeTruthy();
    expect(container.querySelector('[data-sprite="ти"]')).toBeTruthy();

    // drives panel now shows both café agents (no Лілі here)
    const drives = container.querySelector('[data-panel="drives"]');
    expect(drives.querySelector('[data-agent-drives="Марко"]')).toBeTruthy();
    expect(drives.querySelector('[data-agent-drives="Зоя"]')).toBeTruthy();
    expect(drives.querySelector('[data-agent-drives="Лілі"]')).toBeNull();
    expect(drives.querySelectorAll("[data-bar]")).toHaveLength(8); // 2 agents × 4 drives

    // thought cards show the café agents' observations (not Лілі)
    expect(container.querySelector('[data-card="marko"]').textContent).toContain("Заварюю");
    expect(container.querySelector('[data-card="zoya"]')).toBeTruthy();
    expect(container.querySelector('[data-card="lili"]')).toBeNull();

    // back home — café agents are no longer rendered
    fireEvent.click(container.querySelector("[data-location] button"));
    expect(container.querySelector('[data-sprite="Марко"]')).toBeNull();
    expect(container.querySelector('[data-agent-drives="Лілі"]')).toBeTruthy();
  });

  it("lets you walk in the café with WASD without moving the home player", () => {
    const { container } = render(<LiliHouseAITown chat={async () => "x"} />);
    fireEvent.click(container.querySelector('[data-loc="cafe"]'));
    const before = container.querySelector('[data-sprite="ти"]').getAttribute("transform");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(container.querySelector('[data-sprite="ти"]').getAttribute("transform")).not.toBe(before);
  });
});
