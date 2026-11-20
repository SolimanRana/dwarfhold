import type { ColonyState, JobType, Resources } from "./types";

export const production: Record<Exclude<JobType, null>, Partial<Resources>> = {
  woodcutting: { wood: 3 }, mining: { stone: 2 }, farming: { food: 4 },
};

export function advanceDay(state: ColonyState): ColonyState {
  const resources = { ...state.resources };

  state.dwarves.forEach((dwarf) => {
    if (!dwarf.assignment) return;
    if (dwarf.status === "expedition") return; // D1: dwarves on expedition don't work at home
    if (dwarf.hungry && dwarf.assignment !== "farming") return;  // D1: hungry dwarves don't work (except farmers)

    const output = production[dwarf.assignment];

    Object.entries(output).forEach(([resource, amount]) => {
      resources[resource as keyof Resources] += amount ?? 0;
    });

  });

  // D1: eating order list
  const farmingDwarves = state.dwarves.filter((dwarf) => dwarf.assignment === "farming");
  const otherDwarves = state.dwarves.filter((dwarf) => dwarf.assignment !== "farming");
  const eatingOrder = [...otherDwarves, ...farmingDwarves];  // D1: roster order first, farmers later

  const fedDwarves = eatingOrder.slice(0, resources.food)  // D1: only as many dwarves eat as there is food
  resources.food = resources.food - fedDwarves.length;  // D1: remove only the food that was actually eaten (never below 0)

  const dwarves = state.dwarves.map((dwarf) => ({ ...dwarf, hungry: !fedDwarves.includes(dwarf)}));

  return { ...state, day: state.day + 1, resources, dwarves };
}

export const jobLabel = (job: JobType) => job ? ({ 
  woodcutting: "Woodcutting", 
  mining: "Deep Mining", 
  farming: "Mushroom Farm" 
}[job]) : "Unassigned";
