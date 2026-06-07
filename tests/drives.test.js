import { describe, it, expect } from "vitest";
import {
  DRIVES_INIT,
  DRIVE_COLORS,
  DECAY,
  REFILL,
  clamp,
  decayDrives,
  refillDrive,
  actionDone,
  lowestDrive,
  pickTarget,
  initialSim,
} from "../lili_house_aitown.jsx";

describe("HVN-005 — drives & target selection", () => {
  it("initial drives are 78/60/52/46", () => {
    expect(DRIVES_INIT).toEqual({ натхнення: 78, спокій: 60, енергія: 52, тепло: 46 });
    expect(initialSim().drives).toEqual(DRIVES_INIT);
  });

  it("clamps to 0..100", () => {
    expect(clamp(-5)).toBe(0);
    expect(clamp(150)).toBe(100);
    expect(clamp(42)).toBe(42);
  });

  it("decays −3/tick with a floor at 0", () => {
    expect(DECAY).toBe(3);
    const d = decayDrives({ натхнення: 50, спокій: 2, енергія: 3, тепло: 0 });
    expect(d).toEqual({ натхнення: 47, спокій: 0, енергія: 0, тепло: 0 });
  });

  it("refills +17/tick capped at 100", () => {
    expect(REFILL).toBe(17);
    expect(refillDrive({ тепло: 46 }, "тепло").тепло).toBe(63);
    expect(refillDrive({ тепло: 90 }, "тепло").тепло).toBe(100);
  });

  it("ends an action at actTicks≥4 or drive≥94", () => {
    expect(actionDone(4, 10)).toBe(true);
    expect(actionDone(5, 10)).toBe(true);
    expect(actionDone(2, 94)).toBe(true);
    expect(actionDone(2, 93)).toBe(false);
    expect(actionDone(0, 0)).toBe(false);
  });

  it("DRIVE_COLORS match the four hex values", () => {
    expect(DRIVE_COLORS).toEqual({
      натхнення: "#8a52c0",
      спокій: "#2a9fb0",
      енергія: "#d4609a",
      тепло: "#bf942a",
    });
  });

  it("lowestDrive picks the minimum", () => {
    expect(lowestDrive({ натхнення: 78, спокій: 60, енергія: 52, тепло: 46 })).toBe("тепло");
    expect(lowestDrive({ натхнення: 10, спокій: 60, енергія: 52, тепло: 46 })).toBe("натхнення");
  });

  it("pickTarget maps each lowest drive to its room object", () => {
    const low = (k) => {
      const d = { натхнення: 80, спокій: 80, енергія: 80, тепло: 80 };
      d[k] = 5;
      return d;
    };
    expect(pickTarget(low("натхнення"), "art").room).toBe("art"); // inspiration → studio
    expect(pickTarget(low("енергія"), "art").room).toBe("sleep"); // energy → bedroom
    expect(pickTarget(low("спокій"), "art").room).toBe("bath"); // calm → bathroom
    expect(pickTarget(low("тепло"), "art").room).toBe("kitchen"); // warmth → kitchen
  });

  it("warmth lowest + user in office → office object (Лілі comes to you)", () => {
    const d = { натхнення: 80, спокій: 80, енергія: 80, тепло: 5 };
    expect(pickTarget(d, "office").room).toBe("office");
    expect(pickTarget(d, "kitchen").room).toBe("kitchen"); // not in office → normal
    // the office special case only triggers when warmth is the lowest drive
    const d2 = { натхнення: 5, спокій: 80, енергія: 80, тепло: 80 };
    expect(pickTarget(d2, "office").room).toBe("art");
  });
});
