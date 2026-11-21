import { Chronicle } from "../components/Chronicle";
import { useColony } from "../state/ColonyContext";
import { useState } from "react";

export function ForgePage() {
  const { colony, activities, startForge } = useColony();
  const [smithId, setSmithId] = useState("dwarf-3");

  const forgeJob = colony.forge; // D3: current forge job or null
  const currentSmith = forgeJob ? colony.dwarves.find((dwarf) => dwarf.id === forgeJob.dwarfId) : null; // D3: who is at the forge

  return (
    <div className="forge-layout">
      <div className="forge-recipes">
        <section className="panel forge-picker"> {/* D3: choose who forges */}
          <label>
            Smith
            <select
              value={smithId}
              onChange={(event) => setSmithId(event.target.value)}
            >
              {colony.dwarves.map((dwarf) => (
                <option key={dwarf.id} value={dwarf.id}>
                  {dwarf.name}
                </option>
              ))}
            </select>
          </label>

          {forgeJob ? (
            <p className="forge-status busy">
              {currentSmith?.name} is forging a {forgeJob.item}. Ready on day {forgeJob.readyDay}
            </p>
          ) : (
            <p className="forge-status">The forge is free!</p>
          )}
        </section>
        
        <section className="panel forge">
          <div>
            <small>EMBER FORGE</small>
            <h2>Craft a tool</h2>
            <p>Equip the hold for future work.</p>
          </div>
          <div className="recipe">
            <span>3 🪵</span>
            <i>+</i>
            <span>2 🪨</span>
            <i>→</i>
            <span>1 ⚒️</span>
            <i>·</i>
            <span>1 day</span>
            <button onClick={() => startForge(smithId, "tool")}>Forge tool</button> {/* D3: starts a timed forge job */}
          </div>
        </section>

        {/* D2: weapon recipe, cost 2 wood + 4 stone */}
        <section className="panel forge">
          <div>
            <small>EMBER FORGE</small>
            <h2>Craft a weapon</h2>
            <p>Prepare Stonehome for hostile events</p>
          </div>
          <div className="recipe">
            <span>2 🪵</span>
            <i>+</i>
            <span>4 🪨</span>
            <i>→</i>
            <span>1 🗡️</span>
            <i>·</i>
            <span>2 days</span>
            <button onClick={() => startForge(smithId, "weapon")}>Forge weapon</button> {/* D3: starts a timed forge job */}
          </div>
        </section>
      </div>

      <Chronicle activities={activities} />
    </div>
  );
}
