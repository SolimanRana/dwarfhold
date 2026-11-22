import { Chronicle } from "../components/Chronicle";
import { useColony } from "../state/ColonyContext";
import { speciesRules, recipes } from "../simulation";
import { useState } from "react";

export function ForgePage() {
  const { colony, activities, startForge } = useColony();
  const [smithId, setSmithId] = useState("dwarf-3");

  const forgeJob = colony.forge; // D3: current forge job or null
  const currentSmith = forgeJob ? colony.dwarves.find((dwarf) => dwarf.id === forgeJob.dwarfId) : null; // D3: who is at the forge

  const selectedSmith = colony.dwarves.find((dwarf) => dwarf.id === smithId);  // D6: the character chosen in the dropdown
  const canForge = (item: "tool" | "weapon") => !selectedSmith || speciesRules[selectedSmith.species].forge.includes(item);  // D6: does this species allow this item?

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

          {/* D6: explains why a button is disabled */}
          {selectedSmith && !canForge("weapon") && (
            <p className="forge-status">{selectedSmith.name} is a {speciesRules[selectedSmith.species].label.toLowerCase()} and cannot forge weapons.</p>
          )}

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
            <span>{recipes.tool.wood} 🪵</span>
            <i>+</i>
            <span>{recipes.tool.stone} 🪨</span>
            <i>→</i>
            <span>1 ⚒️</span>
            <i>·</i>
            <span>{recipes.tool.days} {recipes.tool.days === 1 ? "day" : "days"}</span>
            <button disabled={!canForge("tool")} onClick={() => startForge(smithId, "tool")}>Forge tool</button> {/* D3: starts a timed forge job (D6: disabled if the species cannot forge it) */}
          </div>
        </section>

        {/* D2: weapon recipe (costs in recipes) */}
        <section className="panel forge">
          <div>
            <small>EMBER FORGE</small>
            <h2>Craft a weapon</h2>
            <p>Prepare Stonehome for hostile events</p>
          </div>
          <div className="recipe">
            <span>{recipes.weapon.wood} 🪵</span>
            <i>+</i>
            <span>{recipes.weapon.stone} 🪨</span>
            <i>→</i>
            <span>1 🗡️</span>
            <i>·</i>
            <span>{recipes.weapon.days} {recipes.weapon.days === 1 ? "day" : "days"}</span>
            <button disabled={!canForge("weapon")} onClick={() => startForge(smithId, "weapon")}>Forge weapon</button> {/* D3: starts a timed forge job (D6: disabled if the species cannot forge it) */}
          </div>
        </section>
      </div>

      <Chronicle activities={activities} />
    </div>
  );
}