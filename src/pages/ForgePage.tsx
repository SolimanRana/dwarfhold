import { Chronicle } from "../components/Chronicle";
import { useColony } from "../state/ColonyContext";

export function ForgePage() {
  const { activities, craftTool, craftWeapon } = useColony();

  return (
    <div className="forge-layout">
      <div className="forge-recipes">
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
            <button onClick={craftTool}>Forge tool</button>
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
            <button onClick={craftWeapon}>Forge weapon</button>
          </div>
        </section>
      </div>

      <Chronicle activities={activities} />
    </div>
  );
}
