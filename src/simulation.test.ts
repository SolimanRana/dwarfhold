import { describe, expect, it } from "vitest";
import { advanceDay, attackMessage, canDoJob, dailyProduction, departExpedition, expeditionProblem, finishExpedition, forgeProblem, newcomerJoins, resolveAttack, rewardsText } from "./simulation";
import type { ColonyState, Dwarf } from "./types";

// D4: helper that builds a dwarf who is at home, fed and without a tool (change fields with `changes`)
function makeDwarf(changes: Partial<Dwarf> = {}): Dwarf {
  return { id: "d1", name: "Brom", title: "", icon: "", assignment: "mining", status: "working", hungry: false, hasTool: false, species: "dwarf", ...changes };
}

// D6: helper that builds a cave fairy who farms (change fields with `changes`)
function makeFairy(changes: Partial<Dwarf> = {}): Dwarf {
  return makeDwarf({ id: "f1", name: "Lumi", assignment: "farming", species: "fairy", ...changes });
}

// D4: helper that builds a colony with the given dwarves, no forge job and no expedition
function makeColony(dwarves: Dwarf[]): ColonyState {
  return { day: 1, resources: { wood: 0, stone: 0, food: 5, tools: 0, weapons: 0 }, dwarves, forge: null, expedition: null, lastAttack: null };
}

describe("colony simulation", () => {
  it("produces assigned resources and feeds the company", () => {
    const state: ColonyState = { day: 1, resources: { wood: 0, stone: 0, food: 5, tools: 0, weapons: 0 }, dwarves: [{ id: "d1", name: "Brom", title: "", icon: "", assignment: "woodcutting", status: "working", hungry: false, hasTool: false, species: "dwarf" }], forge: null, expedition: null, lastAttack: null };
    expect(advanceDay(state)).toMatchObject({ day: 2, resources: { wood: 3, food: 4 } });
    expect(state.resources.wood).toBe(0);
  });
});

describe("expeditions (D4)", () => {
  it("allows an available dwarf to go", () => {
    expect(expeditionProblem(makeColony([makeDwarf()]), "d1")).toBeNull();
  });

  it("rejects an unknown dwarf, a hungry dwarf, a dwarf at the forge and a dwarf who is already away", () => {
    expect(expeditionProblem(makeColony([makeDwarf()]), "nobody")).not.toBeNull();
    expect(expeditionProblem(makeColony([makeDwarf({ hungry: true })]), "d1")).not.toBeNull();
    expect(expeditionProblem(makeColony([makeDwarf({ status: "crafting" })]), "d1")).not.toBeNull();
    expect(expeditionProblem(makeColony([makeDwarf({ status: "expedition" })]), "d1")).not.toBeNull();
  });

  it("sends a dwarf away, records the trip and lets the dwarf keep the tool", () => {
    const state = makeColony([makeDwarf({ hasTool: true })]);
    const away = departExpedition(state, "trip-1", "d1", "old-mine");

    expect(away.dwarves[0].status).toBe("expedition");
    expect(away.dwarves[0].hasTool).toBe(true);
    expect(away.expedition).toEqual({ id: "trip-1", dwarfId: "d1", destination: "old-mine" });
    expect(state.dwarves[0].status).toBe("working"); // the old state is not changed
  });

  it("changes nothing when the dwarf is not allowed to go", () => {
    const state = makeColony([makeDwarf({ hungry: true })]);
    expect(departExpedition(state, "trip-1", "d1", "old-mine")).toBe(state);
  });

  it("allows only one expedition at a time", () => {
    const state = makeColony([makeDwarf(), makeDwarf({ id: "d2", name: "Yrsa" })]);
    const away = departExpedition(state, "trip-1", "d1", "old-mine");

    expect(expeditionProblem(away, "d2")).not.toBeNull();
    expect(departExpedition(away, "trip-2", "d2", "crystal-cave")).toBe(away);
  });

  it("does not let a dwarf on an expedition work at home", () => {
    const away = departExpedition(makeColony([makeDwarf()]), "trip-1", "d1", "old-mine");
    expect(advanceDay(away).resources.stone).toBe(0);
  });

  it("adds the rewards, brings the dwarf home with the same job and clears the trip on success", () => {
    const away = departExpedition(makeColony([makeDwarf()]), "trip-1", "d1", "old-mine");
    const back = finishExpedition(away, "trip-1", { stone: 12, wood: 2 });

    expect(back.resources).toMatchObject({ stone: 12, wood: 2 });
    expect(back.dwarves[0]).toMatchObject({ status: "working", assignment: "mining" });
    expect(back.expedition).toBeNull();
  });

  it("brings an unassigned dwarf home as idle", () => {
    const away = departExpedition(makeColony([makeDwarf({ assignment: null, status: "idle" })]), "trip-1", "d1", "old-mine");
    expect(finishExpedition(away, "trip-1", { stone: 1 }).dwarves[0].status).toBe("idle");
  });

  it("applies the same result only once", () => {
    const away = departExpedition(makeColony([makeDwarf()]), "trip-1", "d1", "old-mine");
    const once = finishExpedition(away, "trip-1", { stone: 12, wood: 2 });
    const twice = finishExpedition(once, "trip-1", { stone: 12, wood: 2 });

    expect(twice).toBe(once);
    expect(twice.resources.stone).toBe(12);
  });

  it("ignores the result of a trip that is not out", () => {
    const away = departExpedition(makeColony([makeDwarf()]), "trip-1", "d1", "old-mine");
    expect(finishExpedition(away, "another-trip", { stone: 99 })).toBe(away);
  });

  it("gives no rewards on failure but still brings the dwarf home", () => {
    const away = departExpedition(makeColony([makeDwarf()]), "trip-1", "d1", "blocked-pass");
    const back = finishExpedition(away, "trip-1", null);

    expect(back.resources).toEqual(away.resources);
    expect(back.dwarves[0].status).toBe("working");
    expect(back.expedition).toBeNull();
    expect(expeditionProblem(back, "d1")).toBeNull(); // can be sent again
  });
});

describe("species: production and jobs (D6)", () => {
  it("lets a dwarf produce 3 wood, 2 stone or 4 food and a cave fairy 6 food", () => {
    expect(dailyProduction(makeDwarf({ assignment: "woodcutting" }))).toEqual({ wood: 3 });
    expect(dailyProduction(makeDwarf({ assignment: "mining" }))).toEqual({ stone: 2 });
    expect(dailyProduction(makeDwarf({ assignment: "farming" }))).toEqual({ food: 4 });
    expect(dailyProduction(makeFairy())).toEqual({ food: 6 });
  });

  it("adds the tool bonus only for woodcutting and mining", () => {
    expect(dailyProduction(makeDwarf({ assignment: "mining", hasTool: true }))).toEqual({ stone: 3 });
    expect(dailyProduction(makeDwarf({ assignment: "farming", hasTool: true }))).toEqual({ food: 4 });
  });

  it("produces nothing when away, at the forge, unassigned or hungry (farmers still work when hungry)", () => {
    expect(dailyProduction(makeDwarf({ status: "expedition" }))).toEqual({});
    expect(dailyProduction(makeDwarf({ status: "crafting" }))).toEqual({});
    expect(dailyProduction(makeDwarf({ assignment: null, status: "idle" }))).toEqual({});
    expect(dailyProduction(makeDwarf({ hungry: true }))).toEqual({});
    expect(dailyProduction(makeFairy({ hungry: true }))).toEqual({ food: 6 });
  });

  it("produces nothing for a job the species cannot do", () => {
    expect(dailyProduction(makeFairy({ assignment: "mining" }))).toEqual({});
  });

  it("adds the fairy's 6 rations in the daily simulation", () => {
    // 5 food + 6 produced - 1 eaten = 10
    expect(advanceDay(makeColony([makeFairy()])).resources.food).toBe(10);
  });

  it("allows a fairy to farm or be unassigned, but not to mine or cut wood", () => {
    expect(canDoJob(makeFairy(), "farming")).toBe(true);
    expect(canDoJob(makeFairy(), null)).toBe(true);
    expect(canDoJob(makeFairy(), "mining")).toBe(false);
    expect(canDoJob(makeFairy(), "woodcutting")).toBe(false);
    expect(canDoJob(makeDwarf(), "mining")).toBe(true);
  });
});

describe("species: forging (D6)", () => {
  it("lets a fairy forge a tool but not a weapon", () => {
    const state = { ...makeColony([makeFairy()]), resources: { wood: 10, stone: 10, food: 5, tools: 0, weapons: 0 } };

    expect(forgeProblem(state, "f1", "tool")).toBeNull();
    expect(forgeProblem(state, "f1", "weapon")).toMatch(/cannot forge/);
  });

  it("still lets a dwarf forge both", () => {
    const state = { ...makeColony([makeDwarf()]), resources: { wood: 10, stone: 10, food: 5, tools: 0, weapons: 0 } };

    expect(forgeProblem(state, "d1", "tool")).toBeNull();
    expect(forgeProblem(state, "d1", "weapon")).toBeNull();
  });
});

describe("species: the newcomer (D6)", () => {
  it("brings the cave fairy after a successful Crystal Cave expedition", () => {
    const away = departExpedition(makeColony([makeDwarf()]), "trip-1", "d1", "crystal-cave");
    const back = finishExpedition(away, "trip-1", { stone: 8, tools: 1 });

    expect(back.dwarves).toHaveLength(2);
    expect(back.dwarves[1]).toMatchObject({ id: "fairy-1", species: "fairy", status: "idle", assignment: null, hasTool: false });
  });

  it("does not bring her after a failed trip or from another destination", () => {
    const failed = finishExpedition(departExpedition(makeColony([makeDwarf()]), "trip-1", "d1", "crystal-cave"), "trip-1", null);
    const oldMine = finishExpedition(departExpedition(makeColony([makeDwarf()]), "trip-1", "d1", "old-mine"), "trip-1", { stone: 12, wood: 2 });

    expect(failed.dwarves).toHaveLength(1);
    expect(oldMine.dwarves).toHaveLength(1);
  });

  it("brings her only once", () => {
    const first = finishExpedition(departExpedition(makeColony([makeDwarf()]), "trip-1", "d1", "crystal-cave"), "trip-1", { stone: 8, tools: 1 });
    const second = finishExpedition(departExpedition(first, "trip-2", "d1", "crystal-cave"), "trip-2", { stone: 8, tools: 1 });

    expect(newcomerJoins(first, "crystal-cave")).toBe(false);
    expect(second.dwarves.filter((dwarf) => dwarf.species === "fairy")).toHaveLength(1);
  });
});

// D7: helper that builds a colony with chosen wood, stone and weapons, and one dwarf who can be sent away
function makeStock(wood: number, stone: number, weapons: number): ColonyState {
  return { ...makeColony([makeDwarf()]), resources: { wood, stone, food: 5, tools: 1, weapons } };
}

describe("the dragon attack (D7)", () => {
  it("defends with 2 or more weapons: nothing is taken and the fight uses up 2 weapons", () => {
    const after = resolveAttack(makeStock(10, 10, 2), "trip-1");

    expect(after.resources).toEqual({ wood: 10, stone: 10, food: 5, tools: 1, weapons: 0 });
    expect(after.lastAttack).toEqual({ id: "trip-1", day: 1, defended: true, loot: {} });
  });

  it("uses up only 2 weapons when there are more", () => {
    expect(resolveAttack(makeStock(10, 10, 3), "trip-1").resources.weapons).toBe(1);
  });

  it("loots half of the wood and half of the stone (rounded down) with fewer than 2 weapons", () => {
    const after = resolveAttack(makeStock(10, 7, 1), "trip-1");

    expect(after.resources).toMatchObject({ wood: 5, stone: 4 });
    expect(after.lastAttack).toEqual({ id: "trip-1", day: 1, defended: false, loot: { wood: 5, stone: 3 } });
  });

  it("never takes food, tools or weapons", () => {
    const after = resolveAttack(makeStock(10, 10, 1), "trip-1");
    expect(after.resources).toMatchObject({ food: 5, tools: 1, weapons: 1 });
  });

  it("takes nothing from an empty or tiny stock (1 rounds down to 0)", () => {
    expect(resolveAttack(makeStock(0, 0, 0), "trip-1").lastAttack?.loot).toEqual({ wood: 0, stone: 0 });
    expect(resolveAttack(makeStock(1, 1, 0), "trip-1").resources).toMatchObject({ wood: 1, stone: 1 });
  });

  it("is deterministic: the same stock always gives the same result", () => {
    expect(resolveAttack(makeStock(9, 9, 0), "trip-1")).toEqual(resolveAttack(makeStock(9, 9, 0), "trip-1"));
  });

  it("does not change the old state", () => {
    const state = makeStock(10, 10, 0);
    resolveAttack(state, "trip-1");
    expect(state.resources.wood).toBe(10);
    expect(state.lastAttack).toBeNull();
  });

  it("brings the dragon after a successful Dragon's Lair expedition: the rewards count, then the loot is taken", () => {
    const away = departExpedition(makeStock(4, 5, 0), "trip-1", "d1", "dragon-lair");
    const back = finishExpedition(away, "trip-1", { stone: 10, wood: 6 });

    // 4 + 6 = 10 wood and 5 + 10 = 15 stone were stored, the dragon takes 5 wood and 7 stone
    expect(back.resources).toMatchObject({ wood: 5, stone: 8 });
    expect(back.lastAttack).toMatchObject({ id: "trip-1", defended: false, loot: { wood: 5, stone: 7 } });
    expect(back.expedition).toBeNull();
    expect(back.dwarves[0].status).toBe("working");  // the scout is home as usual
  });

  it("defends a successful Dragon's Lair expedition when there are enough weapons", () => {
    const away = departExpedition(makeStock(4, 5, 2), "trip-1", "d1", "dragon-lair");
    const back = finishExpedition(away, "trip-1", { stone: 10, wood: 6 });

    expect(back.resources).toMatchObject({ wood: 10, stone: 15, weapons: 0 });  // rewards kept, the 2 weapons are used up
    expect(back.lastAttack?.defended).toBe(true);
  });

  it("does not attack after a failed Dragon's Lair expedition", () => {
    const away = departExpedition(makeStock(4, 5, 0), "trip-1", "d1", "dragon-lair");
    const back = finishExpedition(away, "trip-1", null);

    expect(back.lastAttack).toBeNull();
    expect(back.resources).toEqual(away.resources);
  });

  it("does not attack after a successful expedition to another destination", () => {
    const away = departExpedition(makeStock(4, 5, 0), "trip-1", "d1", "old-mine");
    const back = finishExpedition(away, "trip-1", { stone: 12, wood: 2 });

    expect(back.lastAttack).toBeNull();
    expect(back.resources).toMatchObject({ wood: 6, stone: 17 });
  });

  it("attacks only once per trip, even if the same result arrives twice", () => {
    const away = departExpedition(makeStock(4, 5, 0), "trip-1", "d1", "dragon-lair");
    const once = finishExpedition(away, "trip-1", { stone: 10, wood: 6 });

    expect(finishExpedition(once, "trip-1", { stone: 10, wood: 6 })).toBe(once);
  });

  it("lists the rewards of an expedition with exact numbers", () => {
    expect(rewardsText({ stone: 10, wood: 6 })).toBe("+6 wood, +10 stone");
    expect(rewardsText({ stone: 8, tools: 1 })).toBe("+8 stone, +1 tool");
    expect(rewardsText({})).toBe("no rewards");
  });

  it("describes the result with the exact numbers", () => {
    expect(attackMessage({ id: "t", day: 1, defended: false, loot: { wood: 5, stone: 7 } })).toMatch(/5 wood and 7 stone/);
    expect(attackMessage({ id: "t", day: 1, defended: true, loot: {} })).toMatch(/drove it off.*used up 2 weapons/);
  });
});