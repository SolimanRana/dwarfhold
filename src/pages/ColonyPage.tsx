import { useState } from "react";
import { Chronicle } from "../components/Chronicle";
import { DwarfRoster } from "../components/DwarfRoster";
import { dailyProduction, expeditionProblem, jobLabel, NEWCOMER_DESTINATION, newcomerJoins, speciesRules } from "../simulation";
import { useColony } from "../state/ColonyContext";
import type { Dwarf, ResourceKey } from "../types";

// D4: readable destination names for the interface
const destinationLabels: Record<string, string> = {
  "crystal-cave": "Crystal Cave",
  "old-mine": "The Old Mine",
  "blocked-pass": "Blocked Pass",
};

// D4: short note behind a dwarf's name, so the player sees who can not go
const statusNote = (dwarf: Dwarf) =>
  dwarf.status === "expedition" ? " (away)" : dwarf.status === "crafting" ? " (at the forge)" : dwarf.hungry ? " (hungry)" : "";

export function ColonyPage() {
  const {
    colony,
    activities,
    expeditionPending,
    assignDwarf,
    sendExpedition,
    equipTool,
    returnTool,
  } = useColony();
  const [destination, setDestination] = useState("crystal-cave");
  const [expeditionDwarf, setExpeditionDwarf] = useState("dwarf-3");

  const sendProblem = expeditionProblem(colony, expeditionDwarf);  // D4: why the selected dwarf can not go right now, or null
  const travelling = colony.expedition ? colony.dwarves.find((dwarf) => dwarf.id === colony.expedition?.dwarfId) : null;  // D4: who is away right now
  const rumour = newcomerJoins(colony, NEWCOMER_DESTINATION);  // D6: true while the newcomer has not joined yet

  // D6: the preview asks dailyProduction, the same function the simulation uses, so both always agree
  const dailyOutput = colony.dwarves.reduce<Record<ResourceKey, number>>(
    (total, dwarf) => {
      Object.entries(dailyProduction(dwarf)).forEach(([resource, amount]) => {
        total[resource as ResourceKey] += amount ?? 0;
      });
      return total;
    },
    {
      wood: 0,
      stone: 0,
      food: -colony.dwarves.length,
      tools: 0,
      weapons: 0,
    },
  );

  return (
    <div className="dashboard">
      <DwarfRoster dwarves={colony.dwarves} onAssign={assignDwarf} onEquipTool={equipTool} onReturnTool={returnTool} toolsInStorage={colony.resources.tools} />

      <section className="center-stack">
        <section className="panel production">
          <header>
            <div>
              <small>SHIFT LEDGER</small>
              <h2>Daily Production</h2>
            </div>
            <span>updates each day</span>
          </header>

          <div className="job-grid">
            {(["woodcutting", "mining", "farming"] as const).map((job) => {
              // D6: one rate per species that can do this job (a species without that job is skipped)
              const rates = Object.values(speciesRules)
                .filter((rules) => rules.production[job])
                .map((rules) => ({ label: rules.label, amount: Object.values(rules.production[job] ?? {})[0] }));

              return (
                <article key={job}>
                  <b>
                    {job === "woodcutting"
                      ? "🌲"
                      : job === "mining"
                        ? "⛏️"
                        : "🍄"}
                  </b>
                  <h3>{jobLabel(job)}</h3>
                  <p>
                    {
                      colony.dwarves.filter(
                        (dwarf) => dwarf.assignment === job,
                      ).length
                    }{" "}
                    assigned
                  </p>
                  <strong>
                    {rates.length === 1
                      ? `+${rates[0].amount} / day`
                      : rates.map((rate) => `${rate.label} +${rate.amount}`).join(" · ") + " / day"}  {/* D6: e.g. "Dwarf +4 · Cave fairy +6 / day" */}
                  </strong>
                </article>
              );
            })}
          </div>

          <div className="net-line">
            <span>NET FOOD AFTER MEALS</span>
            <strong className={dailyOutput.food >= 0 ? "gain" : "loss"}>
              {dailyOutput.food >= 0 ? "+" : ""}
              {dailyOutput.food}
            </strong>
          </div>
        </section>
      </section>

      <aside className="side-stack">
        <section className="panel expedition">
          <header>
            <div>
              <small>BEYOND THE GATE</small>
              <h2>Expedition</h2>
            </div>
            <b>🗺️</b>
          </header>

          {/* D4: the scout list shows if a dwarf is away, at the forge or hungry */}
          <label>
            Scout
            <select
              value={expeditionDwarf}
              onChange={(event) => setExpeditionDwarf(event.target.value)}
            >
              {colony.dwarves.map((dwarf) => (
                <option key={dwarf.id} value={dwarf.id}>
                  {dwarf.name}{statusNote(dwarf)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Destination
            <select
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            >
              <option value="crystal-cave">Crystal Cave</option>
              <option value="old-mine">The Old Mine</option>
              <option value="blocked-pass">Blocked Pass</option>
            </select>
          </label>

          <button
            disabled={sendProblem !== null}  // D4: blocked whenever the rules in expeditionProblem say no
            onClick={() => sendExpedition(expeditionDwarf, destination)}
          >
            {expeditionPending ? "Beyond the gate…" : "Send expedition"}
          </button>

          {/* D4: tells the player who is away and where to, or why the selected dwarf can not go */}
          {travelling && colony.expedition && (
            <p style={{ color: "#e2a84f" }}>
              🧭 {travelling.name} is travelling to{" "}
              {destinationLabels[colony.expedition.destination] ?? colony.expedition.destination}.
            </p>
          )}
          {!colony.expedition && sendProblem && (
            <p style={{ color: "#d47459" }}>{sendProblem}</p>
          )}

          {/* D6: a rumour tells the player where the newcomer can be found, until she has joined */}
          {rumour && (
            <p style={{ color: "#8fd3c8" }}>
              🧚 Rumour: faint lights flicker deep inside the Crystal Cave. Someone may be waiting there.
            </p>
          )}

          <p>
            Only one expedition can travel at a time. A travelling dwarf does
            not work, forge or change jobs, and keeps their tool. If the
            expedition fails, the dwarf comes home without rewards.
          </p>
        </section>

        <Chronicle activities={activities} />
      </aside>
    </div>
  );
}