import { useEffect, useRef, useState, type ReactNode } from "react";
import { beginExpedition } from "../api";
import { browserStorage, loadGame, saveGame } from "../persistence";
import { advanceDay, attackMessage, canDoJob, departExpedition, expeditionProblem, finishExpedition, forgeProblem, jobLabel, newcomer, newcomerJoins, recipes, rewardsText, speciesRules } from "../simulation";
import type {
  Activity,
  ColonyState,
  JobType,
} from "../types";
import { ColonyContext, type ColonyContextValue } from "./ColonyContext";

const initialState: ColonyState = {
  day: 12,
  resources: {
    wood: 14,
    stone: 9,
    food: 18,
    tools: 1,
    weapons: 0,
  },
  dwarves: [
    {
      id: "dwarf-1",
      name: "Bromli Copperkeg",
      title: "Hold Warden",
      icon: "🧔🏻",
      assignment: "mining",
      status: "working",
      specialty: "mining",
      hungry: false,  // D1: no dwarf starts hungry
      hasTool: false, // D2: no dwarf starts with a tool
      species: "dwarf", // D6: the three starting characters are dwarves
    },
    {
      id: "dwarf-2",
      name: "Yrsa Flintbraid",
      title: "Trail Scout",
      icon: "🧔🏼‍♀️",
      assignment: "woodcutting",
      status: "working",
      specialty: "woodcutting",
      hungry: false,  // D1: no dwarf starts hungry
      hasTool: false, // D2: no dwarf starts with a tool
      species: "dwarf", // D6
    },
    {
      id: "dwarf-3",
      name: "Dori Ashmantle",
      title: "Stone Singer",
      icon: "🧔🏽",
      assignment: null,
      status: "idle",
      hungry: false,  // D1: no dwarf starts hungry
      hasTool: false, // D2: no dwarf starts with a tool
      species: "dwarf", // D6
    },
  ],
  forge: null,  // D3: no forge job at the start
  expedition: null,  // D4: nobody is away at the start
  lastAttack: null,  // D7: no dragon attack yet
};

const welcomeActivities: Activity[] = [
  {
    id: "welcome",
    day: 12,
    message: "The forge fires are lit. Stonehome wakes.",
  },
];

export function ColonyProvider({ children }: { children: ReactNode }) {
  // D5: on start, load the saved game (or a new colony if there is none or it is broken)
  const [loaded] = useState(() => loadGame(browserStorage(), { colony: initialState, activities: welcomeActivities }));
  const [colony, setColony] = useState(loaded.colony);
  const [paused, setPaused] = useState(false);
  const [activities, setActivities] = useState<Activity[]>(loaded.activities);

  const expeditionPending = colony.expedition !== null;  // D4: derived from the colony state, so it can't get out of sync
  const sendingRef = useRef(false);  // D4: remembers at once that a send is in progress, so a quick double click is ignored
  const announcedAttackRef = useRef(loaded.colony.lastAttack?.id ?? null);  // D7: the attack that is already in the chronicle (a restored save must not announce its old attack again)

  // D5: save the game after every change of the colony or the chronicle
  useEffect(() => {
    saveGame(browserStorage(), colony, activities);
  }, [colony, activities]);

  // D7: when a new attack result appears in the colony, write it to the chronicle exactly once
  useEffect(() => {
    const report = colony.lastAttack;
    if (!report || report.id === announcedAttackRef.current) return;

    announcedAttackRef.current = report.id;
    setActivities((current) => [
      {
        id: `attack-${report.id}`,
        day: report.day,
        message: `🐉 ${attackMessage(report)}`,
        tone: report.defended ? ("good" as const) : ("warning" as const),
      },
      ...current,
    ].slice(0, 6));
  }, [colony.lastAttack]);

  useEffect(() => {
    if (paused) return;

    const timer = window.setInterval(
      () => setColony((current) => advanceDay(current)),
      8_000,
    );

    return () => window.clearInterval(timer);
  }, [paused]);

  function assignDwarf(id: string, assignment: JobType) {
    const dwarf = colony.dwarves.find((item) => item.id === id);

    // D4: a dwarf who is away or at the forge keeps their job, so the worker state can't contradict itself
    if (!dwarf || dwarf.status === "expedition" || dwarf.status === "crafting") {
      setActivities((current) => [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: `${dwarf?.name ?? "A dwarf"} is busy and can't change jobs now.`,
          tone: "warning" as const,
        },
        ...current,
      ].slice(0, 6));
      return;
    }

    // D6: a character can only take jobs that their species can do
    if (!canDoJob(dwarf, assignment)) {
      setActivities((current) => [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: `${dwarf.name} is a ${speciesRules[dwarf.species].label.toLowerCase()} and cannot do ${jobLabel(assignment)}.`,
          tone: "warning" as const,
        },
        ...current,
      ].slice(0, 6));
      return;
    }

    setColony((current) => ({
      ...current,
      dwarves: current.dwarves.map((item) =>
        item.id === id && item.status !== "expedition" && item.status !== "crafting" && canDoJob(item, assignment)  // D4 & D6: safety check on the latest state
          ? {
              ...item,
              assignment,
              status: assignment ? "working" : "idle",
            }
          : item,
      ),
    }));

    setActivities((current) =>
      [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: `${dwarf?.name ?? "A dwarf"} assigned to ${jobLabel(assignment)}.`,
        },
        ...current,
      ].slice(0, 6),
    );
  }

  // D2: give a tool from storage to a dwarf
  function equipTool(id: string) {
    const target = colony.dwarves.find((item) => item.id === id);

    // D6: species that cannot use tools get a clear warning instead of a silent nothing
    if (target && !speciesRules[target.species].canUseTools) {
      setActivities((current) => [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: `${target.name} cannot use tools.`,
          tone: "warning" as const,
        },
        ...current,
      ].slice(0, 6));
      return;
    }

    setColony((current) => {
      const dwarf = current.dwarves.find((item) => item.id === id);

      // D2: invalid attempt changes nothing (D6: also when the species cannot use tools)
      if(!dwarf || dwarf.hasTool || dwarf.status === "expedition" || current.resources.tools < 1 || !speciesRules[dwarf.species].canUseTools) {
        return current;
      }

      return {
        ...current,
        resources: { ...current.resources, tools: current.resources.tools - 1 }, // D2: one tool leaves storage
        dwarves: current.dwarves.map((item) =>
          item.id === id ? { ...item, hasTool: true } : item, // D2: ...and goes to this dwarf
        ),
      };
    });
  }

  // D2: take a tool from dwarf and return it to storage
  function returnTool(id: string) {
    setColony((current) => {
      const dwarf = current.dwarves.find((item) => item.id === id);

      // D2: invalid attempt changes nothing
      if(!dwarf || !dwarf.hasTool || dwarf.status === "expedition") {
        return current;
      }

      return {
        ...current,
        resources: { ...current.resources, tools: current.resources.tools + 1 }, // D2: one tool is added to storage
        dwarves: current.dwarves.map((item) =>
          item.id === id ? { ...item, hasTool: false } : item, // D2: ...taken back from this dwarf
        ),
      };
    });
  }


  /*function craftTool() {
    if (colony.resources.wood < 3) {
      setActivities((current) => [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: "The forge needs more timber.",
          tone: "warning" as const,
        },
        ...current,
      ]);
      return;
    }

    setColony((current) => ({
      ...current,
      resources: {
        ...current.resources,
        wood: current.resources.wood - 3,
        stone: current.resources.stone - 2,
        tools: current.resources.tools + 1,
      },
    }));
    setActivities((current) =>
      [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: "A sturdy iron tool joins the stores.",
          tone: "good" as const,
        },
        ...current,
      ].slice(0, 6),
    );
  }

  // D2: forge a weapon (stored as a colony resource)
  function craftWeapon() {
    if (colony.resources.wood < 2 || colony.resources.stone < 4) {  // D2: weapon costs 2 wood + 4 stone
      setActivities((current) => [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: "A weapon needs 2 timber and 4 stone",
          tone: "warning" as const,
        },
        ...current,
      ]);
      return;
    }

    setColony((current) => ({
      ...current,
      resources: {
        ...current.resources,
        wood: current.resources.wood - 2,
        stone: current.resources.stone - 4,
        weapons: current.resources.weapons + 1,  // D2: one weapon added to storage
      },
    }));
    setActivities((current) =>
      [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: "A new weapon joins the armory.",
          tone: "good" as const,
        },
        ...current,
      ].slice(0, 6),
    );
  }*/

  // D3: start forging an item with a chosen dwarf (takes time)
  function startForge(dwarfId: string, item: "tool" | "weapon") {
    const problem = forgeProblem(colony, dwarfId, item); // D3: check all rules first (D6: includes the species limit)

    if (problem) {
      // D3: invalid attempt, only write a warning, change nothing else
      setActivities((current) => [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: problem,
          tone: "warning" as const,
        },
        ...current,
      ].slice(0, 6));
      return;
    }

    const recipe = recipes[item];  // D3: cost and duration for item

    setColony((current) => {
      if (forgeProblem(current, dwarfId, item)) return current; // D3: safety check on the latest state (double clicks)
      
      return {
        ...current,
        resources: { 
          ...current.resources,
          wood: current.resources.wood - recipe.wood,  // D3: materials are paid when forging starts
          stone: current.resources.stone - recipe.stone,
        },
        dwarves: current.dwarves.map((d) =>
          d.id === dwarfId ? { ...d, status: "crafting" as const } : d, // D3: dwarf is at forge
        ),
        forge: {dwarfId, item, readyDay: current.day + recipe.days },  // D3: who what and when it is ready
      };
    });

    const smith = colony.dwarves.find((dwarf) => dwarf.id === dwarfId); // D3: for the name in the message
    setActivities((current) => [
      {
        id: crypto.randomUUID(),
        day: colony.day,
        message: `${smith?.name ?? "A dwarf"} started forging a ${item}. Ready on day ${colony.day + recipe.days}.`, // D3: shows who and when
        tone: "good" as const,
      },
      ...current,
    ].slice(0, 6));
  }

  async function sendExpedition(dwarfId: string, destination: string) {
    if (sendingRef.current) return;  // D4: a send is already in progress, ignore repeated clicks

    const dwarf = colony.dwarves.find((item) => item.id === dwarfId);
    const problem = expeditionProblem(colony, dwarfId);  // D4: check all rules first

    if (!dwarf || problem) {
      // D4: invalid attempt, only write a warning, change nothing else
      setActivities((current) => [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: problem ?? "No dwarf selected!",
          tone: "warning" as const,
        },
        ...current,
      ].slice(0, 6));
      return;
    }

    sendingRef.current = true;  // D4: from now on repeated clicks are ignored
    const tripId = crypto.randomUUID();  // D4: identifies this one trip, so its result can only be applied once
    const bringsNewcomer = newcomerJoins(colony, destination);  // D6: decided before leaving, with the same rule that finishExpedition uses (only one trip is out at a time)

    setColony((current) => departExpedition(current, tripId, dwarf.id, destination));  // D4: dwarf leaves and the trip is recorded together
    setActivities((current) => [
      {
        id: crypto.randomUUID(),
        day: colony.day,
        message: `${dwarf.name} departed for ${destination.replace("-", " ")}.`,
      },
      ...current,
    ].slice(0, 6));

    try {
      const result = await beginExpedition(dwarf.id, destination);

      setColony((current) => finishExpedition(current, tripId, result.rewards));  // D4: rewards are added and the dwarf comes home in one update (D6: and the newcomer joins, D7: and the dragon attacks)
      setActivities((current) =>
        [
          // D6: announce the newcomer (newest entry goes on top, so it is listed first)
          ...(bringsNewcomer
            ? [{
                id: crypto.randomUUID(),
                day: colony.day,
                message: `${newcomer.name}, a cave fairy, followed the expedition home and joins Stonehome!`,
                tone: "good" as const,
              }]
            : []),
          {
            id: result.expeditionId,
            day: colony.day,
            message: `${result.message} (${rewardsText(result.rewards)})`,  // D7: shows exactly what the scout brought home
            tone: "good" as const,
          },
          ...current,
        ].slice(0, 6),
      );
    } catch (error) {
      setColony((current) => finishExpedition(current, tripId, null));  // D4: no rewards, but the dwarf still comes home (D6: no newcomer either, D7: and no attack)
      setActivities((current) =>
        [
          {
            id: crypto.randomUUID(),
            day: colony.day,
            message: `${
              error instanceof Error
                ? error.message
                : "The expedition was lost from view."
            } ${dwarf.name} returned home empty-handed.`,
            tone: "warning" as const,
          },
          ...current,
        ].slice(0, 6),
      );
    } finally {
      sendingRef.current = false;  // D4: the next expedition may be sent
    }
  }

  const value: ColonyContextValue = {
    colony,
    paused,
    activities,
    expeditionPending,
    togglePaused: () => setPaused((value) => !value),
    assignDwarf,
    //craftTool,
    sendExpedition,
    equipTool,  // D2
    returnTool,  // D2
    //craftWeapon, // D2
    startForge, // D3: replaces craftTool & craftWeapon
  };

  return <ColonyContext value={value}>{children}</ColonyContext>;
}