import { describe, expect, it } from "vitest";
import { advanceDay, attackMessage, canDoJob, dailyProduction, departExpedition, expeditionProblem, finishExpedition, forgeProblem, newcomerJoins, resolveAttack, rewardsText, giveTool, takeBackTool, beginForge } from "./simulation";
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

describe("food and hunger (D1)", () => {
  it("leaves nobody hungry when there is enough food", () => {
    const after = advanceDay(makeColony([makeDwarf(), makeDwarf({ id: "d2" })]));  // D1: 5 food for 2 dwarves

    expect(after.dwarves.map((dwarf) => dwarf.hungry)).toEqual([false, false]);
    expect(after.resources.food).toBe(3);  // D1: each dwarf ate one ration
  });

  it("feeds the dwarves in roster order when there is not enough food", () => {
    const state = { ...makeColony([makeDwarf(), makeDwarf({ id: "d2" }), makeDwarf({ id: "d3" })]), resources: { wood: 0, stone: 0, food: 2, tools: 0, weapons: 0 } };
    const after = advanceDay(state);

    expect(after.dwarves.map((dwarf) => dwarf.hungry)).toEqual([false, false, true]);  // D1: the last one in the roster gets nothing
    expect(after.resources.food).toBe(0);
  });

  it("lets farmers eat last, even when they are first in the roster", () => {
    // D1: the farmer harvests 4 food, which is enough for the 4 miners but not for the farmer
    const state = { ...makeColony([makeDwarf({ assignment: "farming" }), makeDwarf({ id: "d2" }), makeDwarf({ id: "d3" }), makeDwarf({ id: "d4" }), makeDwarf({ id: "d5" })]), resources: { wood: 0, stone: 0, food: 0, tools: 0, weapons: 0 } };
    const after = advanceDay(state);

    expect(after.dwarves.map((dwarf) => dwarf.hungry)).toEqual([true, false, false, false, false]);
  });

  it("keeps a dwarf hungry for one day only", () => {
    const after = advanceDay(makeColony([makeDwarf({ hungry: true })]));  // D1: hungry yesterday, but there is food today
    expect(after.dwarves[0].hungry).toBe(false);
  });

  it("never lets the food go below 0", () => {
    const state = { ...makeColony([makeDwarf(), makeDwarf({ id: "d2" }), makeDwarf({ id: "d3" })]), resources: { wood: 0, stone: 0, food: 0, tools: 0, weapons: 0 } };
    const after = advanceDay(state);

    expect(after.resources.food).toBe(0);
    expect(after.dwarves.every((dwarf) => dwarf.hungry)).toBe(true);  // D1: nobody ate
  });

  it("feeds a dwarf on an expedition too", () => {
    const after = advanceDay(makeColony([makeDwarf({ status: "expedition" }), makeDwarf({ id: "d2" })]));

    expect(after.resources.food).toBe(3);  // D1: both dwarves ate, also the one who is away
    expect(after.dwarves[0].hungry).toBe(false);
  });
});

describe("equipping tools (D2)", () => {
  // D2: helper that builds a colony with the given dwarves and the given number of tools in storage
  function withTools(dwarves: Dwarf[], tools: number): ColonyState {
    return { ...makeColony(dwarves), resources: { wood: 0, stone: 0, food: 5, tools, weapons: 0 } };
  }

  it("moves a tool from storage to the dwarf", () => {
    const after = giveTool(withTools([makeDwarf()], 1), "d1");

    expect(after.resources.tools).toBe(0);  // D2: one tool left the storage...
    expect(after.dwarves[0].hasTool).toBe(true);  // ...and the dwarf carries it
  });

  it("does not give a second tool to a dwarf who already has one", () => {
    const state = withTools([makeDwarf({ hasTool: true })], 1);
    expect(giveTool(state, "d1")).toBe(state);  // D2: one dwarf carries at most one tool, nothing changes
  });

  it("changes nothing when there is no tool in storage", () => {
    const state = withTools([makeDwarf()], 0);
    expect(giveTool(state, "d1")).toBe(state);
  });

  it("gives the last tool to only one dwarf", () => {
    const once = giveTool(withTools([makeDwarf(), makeDwarf({ id: "d2" })], 1), "d1");
    const twice = giveTool(once, "d2");  // D2: one tool can't be equipped by two dwarves

    expect(twice.dwarves.map((dwarf) => dwarf.hasTool)).toEqual([true, false]);
    expect(twice.resources.tools).toBe(0);
  });

  it("does not give or take back a tool while the dwarf is on an expedition", () => {
    const withoutTool = withTools([makeDwarf({ status: "expedition" })], 1);
    const withTool = withTools([makeDwarf({ status: "expedition", hasTool: true })], 0);

    expect(giveTool(withoutTool, "d1")).toBe(withoutTool);
    expect(takeBackTool(withTool, "d1")).toBe(withTool);
  });

  it("does not give a tool to a cave fairy", () => {
    const state = withTools([makeFairy()], 1);
    expect(giveTool(state, "f1")).toBe(state);  // D6: fairies cannot use tools
  });

  it("moves a returned tool back to storage", () => {
    const after = takeBackTool(withTools([makeDwarf({ hasTool: true })], 0), "d1");

    expect(after.resources.tools).toBe(1);
    expect(after.dwarves[0].hasTool).toBe(false);
  });

  it("changes nothing when a dwarf without a tool returns one", () => {
    const state = withTools([makeDwarf()], 1);
    expect(takeBackTool(state, "d1")).toBe(state);
  });

  it("keeps the total number of tools the same when equipping and returning", () => {
    const start = withTools([makeDwarf(), makeDwarf({ id: "d2" })], 2);
    const after = takeBackTool(giveTool(giveTool(start, "d1"), "d2"), "d1");
    const total = after.resources.tools + after.dwarves.filter((dwarf) => dwarf.hasTool).length;

    expect(total).toBe(2);  // D2: tools in storage + tools carried never change
  });
});

describe("forging takes time (D3)", () => {
  // D3: helper that builds a colony with enough wood and stone for both recipes
  function withMaterials(dwarves: Dwarf[], wood = 10, stone = 10): ColonyState {
    return { ...makeColony(dwarves), resources: { wood, stone, food: 5, tools: 0, weapons: 0 } };
  }

  it("allows a dwarf at home who is fed to forge when there are enough materials", () => {
    expect(forgeProblem(withMaterials([makeDwarf()]), "d1", "weapon")).toBeNull();
  });

  it("rejects a busy forge, a dwarf on an expedition and a hungry dwarf", () => {
    const busy = { ...withMaterials([makeDwarf(), makeDwarf({ id: "d2", status: "crafting" })]), forge: { dwarfId: "d2", item: "tool" as const, readyDay: 2 } };

    expect(forgeProblem(busy, "d1", "tool")).toBe("The forge is busy!");  // D3: only one forge job at a time
    expect(forgeProblem(withMaterials([makeDwarf({ status: "expedition" })]), "d1", "tool")).not.toBeNull();
    expect(forgeProblem(withMaterials([makeDwarf({ hungry: true })]), "d1", "tool")).not.toBeNull();
  });

  it("rejects forging when there is not enough wood or not enough stone", () => {
    expect(forgeProblem(withMaterials([makeDwarf()], 2, 10), "d1", "tool")).not.toBeNull();  // D3: a tool needs 3 wood
    expect(forgeProblem(withMaterials([makeDwarf()], 10, 3), "d1", "weapon")).not.toBeNull();  // D3: a weapon needs 4 stone
  });

  it("pays the materials at the start and records who forges what and when it is ready", () => {
    const after = beginForge(withMaterials([makeDwarf()]), "d1", "weapon");

    expect(after.resources).toMatchObject({ wood: 8, stone: 6, weapons: 0 });  // D3: paid now, the weapon comes later
    expect(after.dwarves[0].status).toBe("crafting");
    expect(after.forge).toEqual({ dwarfId: "d1", item: "weapon", readyDay: 3 });  // D3: day 1 + 2 days
  });

  it("changes nothing when the attempt is invalid", () => {
    const state = withMaterials([makeDwarf()], 0, 0);
    expect(beginForge(state, "d1", "tool")).toBe(state);  // D3: no materials used, no dwarf changed
  });

  it("finishes a tool after 1 day: the tool is stored and the dwarf goes back to work", () => {
    const after = advanceDay(beginForge(withMaterials([makeDwarf()]), "d1", "tool"));

    expect(after.resources.tools).toBe(1);
    expect(after.dwarves[0].status).toBe("working");  // D3: back to their job (mining)
    expect(after.forge).toBeNull();  // D3: the forge is free again
  });

  it("is not finished before the ready day", () => {
    const after = advanceDay(beginForge(withMaterials([makeDwarf()]), "d1", "weapon"));  // D3: a weapon takes 2 days

    expect(after.resources.weapons).toBe(0);
    expect(after.dwarves[0].status).toBe("crafting");
    expect(advanceDay(after).resources.weapons).toBe(1);  // D3: done after the second day
  });

  it("sends an unassigned smith back as idle", () => {
    const after = advanceDay(beginForge(withMaterials([makeDwarf({ assignment: null, status: "idle" })]), "d1", "tool"));
    expect(after.dwarves[0].status).toBe("idle");
  });

  it("finishes on time even if the smith gets hungry while forging", () => {
    const forging = { ...beginForge(withMaterials([makeDwarf()]), "d1", "tool"), dwarves: [makeDwarf({ status: "crafting", hungry: true })] };
    expect(advanceDay(forging).resources.tools).toBe(1);  // D3: once started, it always finishes
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