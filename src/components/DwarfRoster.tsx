import { jobLabel, speciesRules } from "../simulation";
import type { Dwarf, JobType } from "../types";

const jobs: Exclude<JobType, null>[] = [
  "woodcutting",
  "mining",
  "farming",
];

interface Props {
  dwarves: Dwarf[];
  onAssign: (id: string, job: JobType) => void;
  onEquipTool: (id: string) => void;
  onReturnTool: (id: string) => void;
  toolsInStorage: number;
}

export function DwarfRoster({ dwarves, onAssign, onEquipTool, onReturnTool, toolsInStorage }: Props) {
  const presentDwarves = dwarves.filter(
    (dwarf) => dwarf.status !== "expedition",
  ).length;

  return (
    <section className="panel roster">
      <header>
        <div>
          <small>THE COMPANY</small>
          <h2>Holdfolk</h2>
        </div>
        <span>
          {presentDwarves} / {dwarves.length} present
        </span>
      </header>

      <div className="dwarf-list">
        {dwarves.map((dwarf) => {
          const isAway = dwarf.status === "expedition";
          const isBusy = isAway || dwarf.status === "crafting"; // D3: away or at the forge, so the job can't be changed
          const rules = speciesRules[dwarf.species];  // D6: what this species can and cannot do
          const allowedJobs = jobs.filter((job) => rules.jobs.includes(job));  // D6: the job list only offers what the species can do
          const specialty = dwarf.specialty
            ? `Skilled in ${jobLabel(dwarf.specialty)}`
            : rules.jobs.length < jobs.length
              ? `${rules.jobs.map((job) => jobLabel(job)).join(", ")} only`  // D6: shows the limitation, e.g. "Mushroom Farm only"
              : "Generalist";

          return (
            <article
              className={isAway ? "dwarf away" : "dwarf"}
              key={dwarf.id}
            >
              <div className="portrait">
                {dwarf.icon}
                <i className={dwarf.status} />
              </div>

              <div className="dwarf-details">
                <h3>{dwarf.name}</h3>
                <p>
                  {dwarf.title} · {specialty}
                </p>

                <select
                  value={dwarf.assignment ?? ""}
                  disabled={isBusy}
                  onChange={(event) =>
                    onAssign(
                      dwarf.id,
                      (event.target.value || null) as JobType,
                    )
                  }
                >
                  <option value="">Unassigned</option>
                  {allowedJobs.map((job) => (
                    <option value={job} key={job}>
                      {jobLabel(job)}
                    </option>
                  ))}
                </select>
                {/* D2: equip or return a tool, depending on whether the dwarf carries one */}
                {dwarf.hasTool ? (
                  <button className="tool-button" disabled={isAway} onClick={() => onReturnTool(dwarf.id)}>
                    Return tool
                  </button>
                ) : rules.canUseTools ? (
                  <button className="tool-button" disabled={dwarf.status === "expedition" || toolsInStorage < 1} onClick={() => {onEquipTool(dwarf.id)}}>
                    Equip tool
                  </button>
                ) : (
                  <small>{rules.label} cannot use tools.</small>  /* D6: no button, just the reason */
                )}
              </div>

              <div className="badges">
                <span className="status">{rules.label}</span> {/* D6: shows the species */}
                <span className="status">{dwarf.status}</span>
                {dwarf.hungry && <span className="status hungry">hungry</span>}  {/* D1: only shown when the dwarf got no food */}
                {dwarf.hasTool && <span className="status tool">tool</span>} {/* D2: only shown if dwarf is equipped with tool */}
              </div>
            </article>
          );
        })}
      </div>
      {dwarves.some((dwarf) => dwarf.hungry) && (
        <p className="hunger-note">
          {/* D1: explains the shortage consequence in the interface */}
          !!! Hungry dwarves got no food last evening and don't work today. 
          Farmers still work, assign more farmers to end the shortage !!!
        </p>
      )}
    </section>
  );
}