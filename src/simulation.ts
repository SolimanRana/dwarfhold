import type { ColonyState, JobType, Resources } from "./types";

export const production: Record<Exclude<JobType, null>, Partial<Resources>> = {
  woodcutting: { wood: 3 }, mining: { stone: 2 }, farming: { food: 4 },
};

// D3: all forge recipes in one place (cost and duration in days)
export const recipes = { tool: {wood: 3, stone: 2, days: 1}, weapon: {wood: 2, stone: 4, days: 2}};

// D3: returns why forging is not allowed or null if it is allowed
export function forgeProblem(state: ColonyState, dwarfId: string, item: "tool" | "weapon"): string | null {
  const recipe = recipes[item];
  const dwarf = state.dwarves.find((d) => d.id === dwarfId);

  if (!dwarf) return "No dwarf selected!";
  if (state.forge !==  null) return "The forge is busy!";
  if (dwarf.status === "expedition") return `${dwarf.name} is away on an expedition!`;
  if (dwarf.hungry) return `${dwarf.name} is too hungry to work the forge!`;
  if (state.resources.wood < recipe.wood || state.resources.stone < recipe.stone){
    return `A ${item} needs ${recipe.wood} timber and ${recipe.stone} stone!`;
  }

  return null; // D3: if everything is fine
}

export function advanceDay(state: ColonyState): ColonyState {
  const resources = { ...state.resources };

  state.dwarves.forEach((dwarf) => {
    if (!dwarf.assignment) return;
    if (dwarf.status === "expedition" || dwarf.status === "crafting") return; // D1 & D3: dwarves on expedition/crafting don't work at home
    if (dwarf.hungry && dwarf.assignment !== "farming") return;  // D1: hungry dwarves don't work (except farmers)

    const output = production[dwarf.assignment];

    const bonus = dwarf.hasTool && (dwarf.assignment === "woodcutting" || dwarf.assignment === "mining") ? 1 : 0; // D2: +1 with a tool on a compatible job
  
    Object.entries(output).forEach(([resource, amount]) => {
      resources[resource as keyof Resources] += (amount ?? 0) + bonus;  // D2: add the tool bonus
    });

  });

  // D1: eating order list
  const farmingDwarves = state.dwarves.filter((dwarf) => dwarf.assignment === "farming");
  const otherDwarves = state.dwarves.filter((dwarf) => dwarf.assignment !== "farming");
  const eatingOrder = [...otherDwarves, ...farmingDwarves];  // D1: roster order first, farmers later

  const fedDwarves = eatingOrder.slice(0, resources.food)  // D1: only as many dwarves eat as there is food
  resources.food = resources.food - fedDwarves.length;  // D1: remove only the food that was actually eaten (never below 0)

  let dwarves = state.dwarves.map((dwarf) => ({ ...dwarf, hungry: !fedDwarves.includes(dwarf)}));

  // D3: finish the forge job when ready day is reached
  const newDay = state.day + 1;
  let forge = state.forge;
  
  if (forge && newDay >= forge.readyDay) {
    const itemKey = forge.item === "tool" ? "tools" : "weapons";  // D3: which storage slot gets the item
    resources[itemKey] += 1; // D3: finished item goes into storage

    const smithId = forge.dwarfId;
    dwarves = dwarves.map((dwarf) =>
      dwarf.id === smithId
        ? { ...dwarf, status: dwarf.assignment ? "working" : "idle" } // D3: smith goes back to their job 
        : dwarf,    
    );

    forge = null; // D3: forge is free again
  }

  return { ...state, day: newDay, resources, dwarves, forge };
}

export const jobLabel = (job: JobType) => job ? ({ 
  woodcutting: "Woodcutting", 
  mining: "Deep Mining", 
  farming: "Mushroom Farm" 
}[job]) : "Unassigned";
