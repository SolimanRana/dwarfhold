export type ResourceKey = "wood" | "stone" | "food" | "tools" | "weapons";
export type JobType = "woodcutting" | "mining" | "farming" | null;
export type DwarfStatus = "idle" | "working" | "expedition" | "crafting";
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
}

export interface ColonyState { 
    day: number; 
    resources: Resources; 
    dwarves: Dwarf[];
    forge: ForgeJob | null;  // D3: current forge job, null if forge is free
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