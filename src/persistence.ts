import type { Activity, ColonyState, Dwarf } from "./types";
import { speciesRules } from "./simulation";

// D5: where and how the game is saved in the browser
export const SAVE_KEY = "dwarfhold-save";
export const SAVE_VERSION = 2;  // D5: raise this number whenever the shape of ColonyState changes, so old saves are rejected safely. D6: 2 because every character now has a species

// D5: the only two storage functions we need (a plain object with these works in tests too)
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

// D5: what the game needs to start: the colony and the chronicle
export interface LoadedGame {
  colony: ColonyState;
  activities: Activity[];
}

// D5: result of reading a save: nothing saved yet, saved data is broken, or saved data is fine
export type ParseResult =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "ok"; colony: ColonyState; activities: Activity[] };

// D5: small helpers to check unknown data
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;
const isText = (value: unknown): value is string => typeof value === "string";
const isStatus = (value: unknown) => ["idle", "working", "expedition", "crafting"].includes(value as string);
const isJob = (value: unknown) => value === null || ["woodcutting", "mining", "farming"].includes(value as string);
const isSpecies = (value: unknown) => ["dwarf", "fairy"].includes(value as string);  // D6: only known species are accepted

function isDwarf(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    isText(value.id) && isText(value.name) && isText(value.title) && isText(value.icon) &&
    isJob(value.assignment) && isStatus(value.status) &&
    typeof value.hungry === "boolean" && typeof value.hasTool === "boolean" &&
    isSpecies(value.species) &&  // D6: every character must have a valid species
    (value.specialty === undefined || (value.specialty !== null && isJob(value.specialty)))
  );
}

function isActivity(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    isText(value.id) && isCount(value.day) && isText(value.message) &&
    (value.tone === undefined || value.tone === "good" || value.tone === "warning")
  );
}

// D5: checks that unknown data really is a valid colony (including that the workers and the forge/expedition agree)
function isColony(value: unknown): value is ColonyState {
  if (!isObject(value) || !isCount(value.day)) return false;

  const resources = value.resources;
  if (!isObject(resources)) return false;
  for (const key of ["wood", "stone", "food", "tools", "weapons"]) {
    if (!isCount(resources[key])) return false;
  }

  if (!Array.isArray(value.dwarves) || value.dwarves.length === 0 || !value.dwarves.every(isDwarf)) return false;
  const dwarves = value.dwarves as Dwarf[];
  if (new Set(dwarves.map((dwarf) => dwarf.id)).size !== dwarves.length) return false;  // D5: every dwarf id must be unique

  // D6: a character must obey the rules of their species (only allowed jobs, no tool for species that cannot use one)
  for (const dwarf of dwarves) {
    const rules = speciesRules[dwarf.species];
    if (dwarf.assignment !== null && !rules.jobs.includes(dwarf.assignment)) return false;
    if (dwarf.hasTool && !rules.canUseTools) return false;
  }

  // D5: the forge job must belong to a real dwarf, and exactly that dwarf must be marked as crafting
  const forge = value.forge;
  const crafting = dwarves.filter((dwarf) => dwarf.status === "crafting");
  if (forge === null) {
    if (crafting.length !== 0) return false;
  } else {
    if (!isObject(forge) || !isText(forge.dwarfId) || !["tool", "weapon"].includes(forge.item as string) || !isCount(forge.readyDay)) return false;
    if (crafting.length !== 1 || crafting[0].id !== forge.dwarfId) return false;
  }

  // D5: the expedition must belong to a real dwarf, and exactly that dwarf must be marked as away
  const trip = value.expedition;
  const away = dwarves.filter((dwarf) => dwarf.status === "expedition");
  if (trip === null) {
    if (away.length !== 0) return false;
  } else {
    if (!isObject(trip) || !isText(trip.id) || !isText(trip.dwarfId) || !isText(trip.destination)) return false;
    if (away.length !== 1 || away[0].id !== trip.dwarfId) return false;
  }

  return true;
}

// D5: turns saved text into a result. Never throws, whatever the text contains
export function parseSave(raw: string | null): ParseResult {
  if (raw === null) return { kind: "none" };

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: "invalid" };  // D5: not even valid JSON
  }

  if (!isObject(data) || data.version !== SAVE_VERSION) return { kind: "invalid" };  // D5: wrong or old version
  if (!isColony(data.colony)) return { kind: "invalid" };
  if (!Array.isArray(data.activities) || !data.activities.every(isActivity)) return { kind: "invalid" };

  return { kind: "ok", colony: data.colony, activities: data.activities as Activity[] };
}

// D5: the expedition policy. The server forgets trips on refresh, so a saved trip is cancelled: no rewards, the dwarf comes home
export function cancelInterruptedExpedition(colony: ColonyState): { colony: ColonyState; message: string | null } {
  const trip = colony.expedition;
  if (!trip) return { colony, message: null };

  const traveller = colony.dwarves.find((dwarf) => dwarf.id === trip.dwarfId);

  return {
    colony: {
      ...colony,
      dwarves: colony.dwarves.map((dwarf) =>
        dwarf.id === trip.dwarfId
          ? { ...dwarf, status: dwarf.assignment ? ("working" as const) : ("idle" as const) } // D5: home again, keeps job and tool
          : dwarf,
      ),
      expedition: null,
    },
    message: `The expedition of ${traveller?.name ?? "a dwarf"} was interrupted by the refresh. ${traveller?.name ?? "The dwarf"} returned home empty-handed.`,
  };
}

// D5: a chronicle entry for the messages below
const note = (day: number, message: string, tone: "good" | "warning"): Activity => ({
  id: crypto.randomUUID(),
  day,
  message,
  tone,
});

// D5: reads the save when the game starts. Always returns something playable
export function loadGame(storage: StorageLike | null, fresh: LoadedGame): LoadedGame {
  let raw: string | null;
  try {
    raw = storage ? storage.getItem(SAVE_KEY) : null;
  } catch {
    return fresh;  // D5: the browser does not allow reading, so just start a new colony
  }

  const result = parseSave(raw);
  if (result.kind === "none") return fresh;

  if (result.kind === "invalid") {
    // D5: broken or incompatible save: ignore it, start fresh and say so (the next save overwrites it)
    return {
      colony: fresh.colony,
      activities: [note(fresh.colony.day, "The saved game could not be read, so a new colony was started.", "warning"), ...fresh.activities].slice(0, 6),
    };
  }

  const { colony, message } = cancelInterruptedExpedition(result.colony);
  const messages = [
    ...(message ? [note(colony.day, message, "warning")] : []),
    note(colony.day, `Stonehome was restored from the last save (day ${colony.day}).`, "good"),
  ];

  return { colony, activities: [...messages, ...result.activities].slice(0, 6) };
}

// D5: writes the save. If the browser refuses, the game just goes on without saving
export function saveGame(storage: StorageLike | null, colony: ColonyState, activities: Activity[]): void {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, colony, activities }));
  } catch {
    // D5: saving is optional, so a failed save must never break the game
  }
}

// D5: the browser's storage, or null if the browser blocks it
export function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}