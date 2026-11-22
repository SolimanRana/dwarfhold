import { describe, expect, it } from "vitest";
import { advanceDay, departExpedition, expeditionProblem, finishExpedition } from "./simulation";
import type { ColonyState, Dwarf } from "./types";

// D4: helper that builds a dwarf who is at home, fed and without a tool (change fields with `changes`)
function makeDwarf(changes: Partial<Dwarf> = {}): Dwarf {
  return { id: "d1", name: "Brom", title: "", icon: "", assignment: "mining", status: "working", hungry: false, hasTool: false, ...changes };
}

// D4: helper that builds a colony with the given dwarves, no forge job and no expedition
function makeColony(dwarves: Dwarf[]): ColonyState {
  return { day: 1, resources: { wood: 0, stone: 0, food: 5, tools: 0, weapons: 0 }, dwarves, forge: null, expedition: null };
}

describe("colony simulation", () => {
  it("produces assigned resources and feeds the company", () => {
    const state: ColonyState = { day: 1, resources: { wood: 0, stone: 0, food: 5, tools: 0, weapons: 0 }, dwarves: [{ id: "d1", name: "Brom", title: "", icon: "", assignment: "woodcutting", status: "working", hungry: false, hasTool: false }], forge: null, expedition: null };
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