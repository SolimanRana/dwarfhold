import type { AttackReport, ColonyState, Dwarf, JobType, ResourceKey, Resources, Species } from "./types";

export const production: Record<Exclude<JobType, null>, Partial<Resources>> = {
  woodcutting: { wood: 3 }, mining: { stone: 2 }, farming: { food: 4 },
};

// D6: what each species can and cannot do, all in one place
export const speciesRules: Record<Species, {
  label: string;
  jobs: Exclude<JobType, null>[];  // jobs this species can do
  production: Partial<Record<Exclude<JobType, null>, Partial<Resources>>>;  // daily output per job
  forge: ("tool" | "weapon")[];  // what this species can forge
  canUseTools: boolean;  // can this species be given a tool?
}> = {
  dwarf: {
    label: "Dwarf",
    jobs: ["woodcutting", "mining", "farming"],
    production,
    forge: ["tool", "weapon"],
    canUseTools: true,
  },
  fairy: {
    label: "Cave fairy",
    jobs: ["farming"],  // D6: fairies can only farm...
    production: { farming: { food: 6 } },  // ...but they farm 6 rations instead of 4
    forge: ["tool"],  // D6: fairies can forge tools but not weapons
    canUseTools: false,  // D6: the tool bonus only helps woodcutting and mining
  },
};

// D6: the one newcomer, who joins after the first successful expedition to NEWCOMER_DESTINATION
export const NEWCOMER_DESTINATION = "crystal-cave";
export const newcomer: Dwarf = {
  id: "fairy-1",
  name: "Lumi Glimmerwing",
  title: "Mushroom Whisperer",
  icon: "🧚",
  assignment: null,
  status: "idle",
  hungry: false,
  hasTool: false,
  species: "fairy",
};

// D6: true if a successful expedition to this destination brings the newcomer (only once)
export function newcomerJoins(state: ColonyState, destination: string): boolean {
  return destination === NEWCOMER_DESTINATION && !state.dwarves.some((dwarf) => dwarf.species === "fairy");
}

// D6: can this character do this job?
export function canDoJob(dwarf: Dwarf, job: JobType): boolean {
  return job === null || speciesRules[dwarf.species].jobs.includes(job);
}

// D6: what one character produces per day right now (one place for the simulation and the screen)
export function dailyProduction(dwarf: Dwarf): Partial<Resources> {
  if (!dwarf.assignment) return {};
  if (dwarf.status === "expedition" || dwarf.status === "crafting") return {}; // D1 & D3: dwarves on expedition/crafting don't work at home
  if (dwarf.hungry && dwarf.assignment !== "farming") return {};  // D1: hungry dwarves don't work (except farmers)

  const output = speciesRules[dwarf.species].production[dwarf.assignment];
  if (!output) return {};  // D6: this species cannot do this job

  const bonus = dwarf.hasTool && (dwarf.assignment === "woodcutting" || dwarf.assignment === "mining") ? 1 : 0; // D2: +1 with a tool on a compatible job

  const result: Partial<Resources> = {};
  (Object.keys(output) as ResourceKey[]).forEach((resource) => {
    result[resource] = (output[resource] ?? 0) + bonus;
  });
  return result;
}

// D7: the dragon. A successful expedition to its lair brings the dragon to Stonehome
export const DRAGON_DESTINATION = "dragon-lair";
export const DEFENSE_THRESHOLD = 2;  // D7: with at least this many weapons, Stonehome defends itself, and the fight uses up exactly this many

// D7: the dragon attacks. Defended if there are enough weapons (the fight uses them up), otherwise it takes half of the wood and half of the stone (rounded down)
export function resolveAttack(state: ColonyState, attackId: string): ColonyState {
  if (state.resources.weapons >= DEFENSE_THRESHOLD) {
    return {
      ...state,
      resources: { ...state.resources, weapons: state.resources.weapons - DEFENSE_THRESHOLD },  // D7: a successful defense uses up the weapons
      lastAttack: { id: attackId, day: state.day, defended: true, loot: {} },  // D7: nothing is taken
    };
  }

  const loot = { wood: Math.floor(state.resources.wood / 2), stone: Math.floor(state.resources.stone / 2) };  // D7: always the same result for the same stock

  return {
    ...state,
    resources: { ...state.resources, wood: state.resources.wood - loot.wood, stone: state.resources.stone - loot.stone },
    lastAttack: { id: attackId, day: state.day, defended: false, loot },
  };
}

// D7: the sentence for the chronicle and the attack panel
export function attackMessage(report: AttackReport): string {
  return report.defended
    ? `The dragon followed the scout home, but Stonehome had at least ${DEFENSE_THRESHOLD} weapons and drove it off. The fight used up ${DEFENSE_THRESHOLD} weapons.`
    : `The dragon followed the scout home and Stonehome had fewer than ${DEFENSE_THRESHOLD} weapons. It took ${report.loot.wood ?? 0} wood and ${report.loot.stone ?? 0} stone.`;
}

// D7: the rewards of an expedition as text, e.g. "+6 wood, +10 stone" (for the chronicle)
export function rewardsText(rewards: Partial<Resources>): string {
  const names: Record<ResourceKey, [string, string]> = { wood: ["wood", "wood"], stone: ["stone", "stone"], food: ["food", "food"], tools: ["tool", "tools"], weapons: ["weapon", "weapons"] };  // singular and plural
  const parts = (["wood", "stone", "food", "tools", "weapons"] as ResourceKey[])
    .filter((key) => (rewards[key] ?? 0) > 0)
    .map((key) => `+${rewards[key]} ${names[key][rewards[key] === 1 ? 0 : 1]}`);
  return parts.length > 0 ? parts.join(", ") : "no rewards";
}

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
  if (!speciesRules[dwarf.species].forge.includes(item)) return `${dwarf.name} cannot forge a ${item}!`; // D6: species limitation
  if (state.resources.wood < recipe.wood || state.resources.stone < recipe.stone){
    return `A ${item} needs ${recipe.wood} timber and ${recipe.stone} stone!`;
  }

  return null; // D3: if everything is fine
}

// D4: returns why a dwarf cannot be sent on an expedition or null if allowed
export function expeditionProblem(state: ColonyState, dwarfId: string): string | null {
  const dwarf = state.dwarves.find((d) => d.id === dwarfId);

  if (!dwarf) return "No dwarf selected!";
  if (state.expedition !== null) return "An expedition is already out. Wait until it returns!";
  if (dwarf.status === "expedition") return `${dwarf.name} is already away!`;
  if (dwarf.status === "crafting") return `${dwarf.name} is busy at the forge!`;
  if (dwarf.hungry) return `${dwarf.name} is too hungry to travel!`;

  return null; // D4: if everything is fine
}

// D4: the dwarf leaves. Status and expedition record change together, or nothing changes
export function departExpedition(state: ColonyState, tripId: string, dwarfId: string, destination: string): ColonyState {
  if (expeditionProblem(state, dwarfId)) return state;  // D4: invalid attempt changes nothing

  return {
    ...state,
    dwarves: state.dwarves.map((dwarf) =>
      dwarf.id === dwarfId ? { ...dwarf, status: "expedition" as const } : dwarf,
    ),
    expedition: { id: tripId, dwarfId, destination },
  };
}

// D4: the result arrived. rewards is null if the expedition failed
export function finishExpedition(state: ColonyState, tripId: string, rewards: Partial<Resources> | null): ColonyState {
  const trip = state.expedition;
  if (!trip || trip.id !== tripId) return state;  // D4: this trip is not out (anymore), so it can never be applied twice

  const resources = { ...state.resources };
  if (rewards) {
    (Object.keys(rewards) as ResourceKey[]).forEach((key) => {
      resources[key] += rewards[key] ?? 0;  // D4: rewards are added only on success
    });
  }

  const returned = state.dwarves.map((dwarf) =>
    dwarf.id === trip.dwarfId
      ? { ...dwarf, status: dwarf.assignment ? ("working" as const) : ("idle" as const) } // D4: the dwarf is home again, on success and on failure
      : dwarf,
  );
  const joins = rewards !== null && newcomerJoins(state, trip.destination);  // D6: only a successful expedition brings the newcomer

  const home: ColonyState = {
    ...state,
    resources,
    dwarves: joins ? [...returned, newcomer] : returned,  // D6: the newcomer joins in the same update
    expedition: null,  // D4: nobody is away anymore
  };

  // D7: only a successful expedition to the dragon's lair brings the attack, in the same update as the rewards
  return rewards !== null && trip.destination === DRAGON_DESTINATION ? resolveAttack(home, tripId) : home;
}

export function advanceDay(state: ColonyState): ColonyState {
  const resources = { ...state.resources };

  state.dwarves.forEach((dwarf) => {
    Object.entries(dailyProduction(dwarf)).forEach(([resource, amount]) => {
      resources[resource as ResourceKey] += amount ?? 0;  // D1, D2 & D6: what each character produces is decided in dailyProduction
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