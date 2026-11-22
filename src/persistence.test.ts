import { describe, expect, it } from "vitest";
import { loadGame, parseSave, saveGame, SAVE_VERSION, type StorageLike } from "./persistence";
import { departExpedition } from "./simulation";
import type { Activity, ColonyState } from "./types";

// D5: helper that builds a small valid colony (one miner with a tool, one idle dwarf)
function makeColony(): ColonyState {
  return {
    day: 5,
    resources: { wood: 1, stone: 2, food: 3, tools: 0, weapons: 0 },
    dwarves: [
      { id: "a", name: "Brom", title: "", icon: "", assignment: "mining", status: "working", hungry: false, hasTool: true, specialty: "mining" },
      { id: "b", name: "Yrsa", title: "", icon: "", assignment: null, status: "idle", hungry: false, hasTool: false },
    ],
    forge: null,
    expedition: null,
  };
}

const chronicle: Activity[] = [{ id: "x", day: 4, message: "Something happened.", tone: "good" }];

// D5: helper for a fake browser storage that lives in memory
function makeStorage(initial: string | null = null): StorageLike & { text: string | null } {
  return {
    text: initial,
    getItem() { return this.text; },
    setItem(_key: string, value: string) { this.text = value; },
  };
}

const fresh = { colony: makeColony(), activities: [] as Activity[] };

describe("save and restore (D5)", () => {
  it("restores what was saved and says so in the chronicle", () => {
    const storage = makeStorage();
    saveGame(storage, makeColony(), chronicle);
    const game = loadGame(storage, fresh);

    expect(game.colony).toEqual(makeColony());
    expect(game.activities[0].message).toMatch(/restored from the last save/);
    expect(game.activities[1]).toEqual(chronicle[0]);
  });

  it("keeps a running forge job, so it finishes on the same day", () => {
    const colony = makeColony();
    colony.dwarves[1].status = "crafting";
    colony.forge = { dwarfId: "b", item: "weapon", readyDay: 9 };
    const storage = makeStorage();
    saveGame(storage, colony, chronicle);

    const game = loadGame(storage, fresh);
    expect(game.colony.forge).toEqual({ dwarfId: "b", item: "weapon", readyDay: 9 });
    expect(game.colony.dwarves[1].status).toBe("crafting");
  });

  it("cancels an interrupted expedition: no rewards, the dwarf comes home with job and tool", () => {
    const away = departExpedition(makeColony(), "trip-1", "a", "old-mine");
    const storage = makeStorage();
    saveGame(storage, away, chronicle);

    const game = loadGame(storage, fresh);
    expect(game.colony.expedition).toBeNull();
    expect(game.colony.dwarves[0]).toMatchObject({ status: "working", assignment: "mining", hasTool: true });
    expect(game.colony.resources).toEqual(makeColony().resources);
    expect(game.activities[0].message).toMatch(/interrupted by the refresh/);
  });
});

describe("corrupt or incompatible saves (D5)", () => {
  it("falls back to a new colony and says so when the saved text is broken", () => {
    for (const text of ["{{{ not json", "null", '{"version":1}']) {
      const game = loadGame(makeStorage(text), fresh);

      expect(game.colony).toEqual(fresh.colony);
      expect(game.activities[0].message).toMatch(/could not be read/);
    }
  });

  it("rejects a save from another version", () => {
    const otherVersion = JSON.stringify({ version: SAVE_VERSION + 1, colony: makeColony(), activities: chronicle });
    expect(parseSave(otherVersion).kind).toBe("invalid");
  });

  it("does not crash when the browser blocks storage", () => {
    const blocked: StorageLike = {
      getItem() { throw new Error("blocked"); },
      setItem() { throw new Error("blocked"); },
    };

    expect(loadGame(blocked, fresh)).toBe(fresh);
    expect(() => saveGame(blocked, makeColony(), chronicle)).not.toThrow();
  });
});