import { useEffect, useState, type ReactNode } from "react";
import { beginExpedition } from "../api";
import { advanceDay, jobLabel } from "../simulation";
import type {
  Activity,
  ColonyState,
  JobType,
  ResourceKey,
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
    },
  ],
};

export function ColonyProvider({ children }: { children: ReactNode }) {
  const [colony, setColony] = useState(initialState);
  const [paused, setPaused] = useState(false);
  const [expeditionPending, setExpeditionPending] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([
    {
      id: "welcome",
      day: 12,
      message: "The forge fires are lit. Stonehome wakes.",
    },
  ]);

  useEffect(() => {
    if (paused) return;

    const timer = window.setInterval(
      () => setColony((current) => advanceDay(current)),
      8_000,
    );

    return () => window.clearInterval(timer);
  }, [paused]);

  function assignDwarf(id: string, assignment: JobType) {
    setColony((current) => ({
      ...current,
      dwarves: current.dwarves.map((dwarf) =>
        dwarf.id === id
          ? {
              ...dwarf,
              assignment,
              status: assignment ? "working" : "idle",
            }
          : dwarf,
      ),
    }));

    const dwarf = colony.dwarves.find((item) => item.id === id);
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
    setColony((current) => {
      const dwarf = current.dwarves.find((item) => item.id === id);

      // D2: invalid attempt changes nothing
      if(!dwarf || dwarf.hasTool || dwarf.status === "expedition" || current.resources.tools < 1) {
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

  function craftTool() {
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
  }

  async function sendExpedition(dwarfId: string, destination: string) {
    const dwarf = colony.dwarves.find((item) => item.id === dwarfId);
    if (!dwarf) return;

    setExpeditionPending(true);
    setColony((current) => ({
      ...current,
      dwarves: current.dwarves.map((item) =>
        item.id === dwarf.id ? { ...item, status: "expedition" } : item,
      ),
    }));
    setActivities((current) => [
      {
        id: crypto.randomUUID(),
        day: colony.day,
        message: `${dwarf.name} departed for ${destination.replace("-", " ")}.`,
      },
      ...current,
    ]);

    try {
      const result = await beginExpedition(dwarf.id, destination);

      setColony((current) => ({
        ...current,
        resources: Object.entries(result.rewards).reduce(
          (all, [key, amount]) => ({
            ...all,
            [key]: all[key as ResourceKey] + (amount ?? 0),
          }),
          current.resources,
        ),
        dwarves: current.dwarves.map((item) =>
          item.id === dwarf.id
            ? {
                ...item,
                status: item.assignment ? "working" : "idle",
              }
            : item,
        ),
      }));
      setActivities((current) =>
        [
          {
            id: result.expeditionId,
            day: colony.day,
            message: result.message,
            tone: "good" as const,
          },
          ...current,
        ].slice(0, 6),
      );
    } catch (error) {
      setActivities((current) =>
        [
          {
            id: crypto.randomUUID(),
            day: colony.day,
            message:
              error instanceof Error
                ? error.message
                : "The expedition was lost from view.",
            tone: "warning" as const,
          },
          ...current,
        ].slice(0, 6),
      );
    }

    setExpeditionPending(false);
  }

  const value: ColonyContextValue = {
    colony,
    paused,
    activities,
    expeditionPending,
    togglePaused: () => setPaused((value) => !value),
    assignDwarf,
    craftTool,
    sendExpedition,
    equipTool,  // D2
    returnTool,  // D2
    craftWeapon, // D2
  };

  return <ColonyContext value={value}>{children}</ColonyContext>;
}
