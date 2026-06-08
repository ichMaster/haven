import { describe, it, expect } from "vitest";
import {
  LILI_CANON,
  buildSystemPrompt,
  liveContext,
  computeWallMap,
  deriveRoomGrid,
  makeRoomAt,
  initialSim,
  ROOMS,
} from "../lili_house_aitown.jsx";

const roomAt = makeRoomAt(deriveRoomGrid(computeWallMap()));

describe("HVN-012 — canon & system-prompt assembly", () => {
  it("LILI_CANON states the Ukrainian voice rules", () => {
    expect(LILI_CANON).toContain("українською");
    expect(LILI_CANON).toContain("Коротко");
    expect(LILI_CANON).toContain("емодзі");
    expect(LILI_CANON).toContain("списк"); // "без списків"
  });

  it("buildSystemPrompt reflects an apart context (studio vs office)", () => {
    const prompt = buildSystemPrompt({
      liliRoom: "art",
      liliAction: "малює (Майстерня Лілі)",
      youRoom: "office",
      together: false,
    });
    expect(prompt).toContain(LILI_CANON);
    expect(prompt).toContain(ROOMS.art.name); // Майстерня Лілі
    expect(prompt).toContain(ROOMS.office.name); // Мій кабінет
    expect(prompt).toContain("малює");
    expect(prompt).toContain("різних кімнатах");
    expect(prompt).not.toContain("разом в одній");
  });

  it("buildSystemPrompt reflects a together context", () => {
    const prompt = buildSystemPrompt({
      liliRoom: "kitchen",
      liliAction: "на кухні (Кухня)",
      youRoom: "kitchen",
      together: true,
    });
    expect(prompt).toContain(ROOMS.kitchen.name); // Кухня
    expect(prompt).toContain("разом в одній кімнаті");
  });

  it("liveContext derives room keys + together from sim state", () => {
    // initialSim: Лілі in studio (5,3) → art; player in office (22,8) → office
    const ctx = liveContext(initialSim(), roomAt);
    expect(ctx.liliRoom).toBe("art");
    expect(ctx.youRoom).toBe("office");
    expect(ctx.together).toBe(false);
    expect(typeof ctx.liliAction).toBe("string");

    const togetherCtx = liveContext(
      { ...initialSim(), you: { x: 5, y: 3 } }, // stand on Лілі's studio cell
      roomAt,
    );
    expect(togetherCtx.together).toBe(true);
  });

  it("buildSystemPrompt(liveContext(...)) is a complete prompt", () => {
    const prompt = buildSystemPrompt(liveContext(initialSim(), roomAt));
    expect(prompt).toContain(LILI_CANON);
    expect(prompt).toContain(ROOMS.art.name);
    expect(prompt).toContain(ROOMS.office.name);
  });
});
