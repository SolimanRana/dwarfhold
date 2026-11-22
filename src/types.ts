export type ResourceKey = "wood" | "stone" | "food" | "tools" | "weapons";
export type JobType = "woodcutting" | "mining" | "farming" | null;
export type DwarfStatus = "idle" | "working" | "expedition" | "crafting";
export type Species = "dwarf" | "fairy";  // D6: who the character is
export interface Resources { wood: number; stone: number; food: number; tools: number; weapons: number }

export interface Dwarf { 
    id: string;
    name: string; 
    title: string; 
    icon: string; 
    assignment: JobType; 
    status: DwarfStatus; 
    specialty?: Exclude<JobType, null> ;
    hungry: boolean;  // D1: true if dwarf got no food last evening
    hasTool: boolean; // D2: true if dwarf has a tool
    species: Species; // D6: dwarf or fairy (the type is still called Dwarf, but it covers every character)
}

export interface ColonyState { 
    day: number; 
    resources: Resources; 
    dwarves: Dwarf[];
    forge: ForgeJob | null;  // D3: current forge job, null if forge is free
    expedition: ExpeditionTrip | null;  // D4: the expedition that is travelling right now, null if nobody is away
    lastAttack: AttackReport | null;  // D7: result of the latest dragon attack, null if there was none yet
}

export interface ExpeditionResult { 
    expeditionId: string; 
    status: "completed"; 
    rewards: Partial<Resources>; 
    message: string 
}

export interface Activity { 
    id: string; 
    day: number; 
    message: string; 
    tone?: "good" | "warning" 
}

// D3: one job at the forge (who, what and when is it ready)
export interface ForgeJob {
    dwarfId: string;
    item: "tool" | "weapon";
    readyDay: number;
}

// D4: one expedition that is travelling (which trip, who and where to)
export interface ExpeditionTrip {
    id: string;
    dwarfId: string;
    destination: string;
}

// D7: what happened in the latest dragon attack
export interface AttackReport {
    id: string;  // the id of the expedition that caused the attack
    day: number;  // the day of the attack
    defended: boolean;  // true if Stonehome had enough weapons and drove the dragon off
    loot: Partial<Resources>;  // what the dragon took (empty if defended)
}