# Qualitative goals

We chose three goals that fit how Dwarfhold is used: the game runs continuously (a day tick every 8 seconds), the player clicks while a slow expedition request is still running, and the browser can be refreshed at any time. The decisions behind each requirement (D1 to D7) are in [DECISIONS.md](DECISIONS.md).

## Goal 1 - Consistency of the game state

**Why it matters:**

Two things change the colony at the same time: the daily timer and the expedition result that arrives a few seconds after the click. If these updates are done in separate steps, the state can contradict itself, for example a dwarf marked as away without a trip, rewards added twice, or the attack happening without the rewards.

**Decisions and trade-offs:**

- All rules are pure functions in `simulation.ts` that take the whole colony state and return a new one (`advanceDay`, `giveTool`, `takeBackTool`, `beginForge`, `departExpedition`, `finishExpedition`, `resolveAttack`)
- The provider always uses `setColony((current) => ...)`, so every change is applied to the latest state, not to an old copy
- Rewards, the scout's return, the newcomer and the dragon attack are applied in one single update (see D6 and D7)
- Every expedition has a trip id, so a result can only be applied once and the result of a trip that is not out is ignored. A `useRef` guard ignores a quick second click
- `dailyProduction` and `expeditionProblem` are used by both the game and the screens, and the Forge page reads the same species table (`speciesRules`) as the rules, so the preview can't disagree with the simulation
- Rules are checked again inside the update (safety check on the latest state)
- Trade-off: only one expedition and one forge job at a time, which limits the player but keeps the state easy to reason about. The same rule is checked in several places (button, rule function, update), which is repetitive but safe

**How we evaluate it:**

- Unit tests: "applies the same result only once", "ignores the result of a trip that is not out", "allows only one expedition at a time", "changes nothing when the dwarf is not allowed to go", "attacks only once per trip", "does not change the old state"
- Manual: double-click "Send expedition" and only one trip starts. After a Dragon's Lair trip, the resource bar equals stock + rewards - loot

## Goal 2 - Reliability and recoverability

**Why it matters:**

The expedition server can fail or be slow, the browser can be refreshed during a trip, and saved data in the browser can be old, broken or edited. The game must stay playable and tell the player what happened instead of crashing or showing wrong data.

**Decisions and trade-offs:**

- A failed expedition request brings the dwarf home with no rewards, no newcomer and no attack. A guard is always released afterwards, so the player can try again
- The game is saved to the browser after every change. A save has a version and is fully validated before it is trusted (version, species rules, forge and expedition agree with the workers, attack report). Broken or old saves are ignored, a new colony starts and the chronicle says so
- Blocked browser storage is caught, so the game still runs without saving
- A trip that was interrupted by a refresh is cancelled with a message, because the server forgets the trip (see D5)
- The latest attack is stored in the save and announced in the chronicle only once
- Trade-off: when the save format changes (D6 and D7) old saves are discarded instead of migrated. This is simple and safe, but the player loses progress. An interrupted trip loses its rewards

**How we evaluate it:**

- Unit tests: "falls back to a new colony and says so when the saved text is broken", "rejects a save from another version", rejections of wrong species, jobs, tools and attack reports, "does not crash when the browser blocks storage", "cancels an interrupted expedition"
- Manual: stop the server and send an expedition (no attack, no rewards, the dwarf comes home), write a broken save into the browser and reload

## Goal 3 - Maintainability and testability

**Why it matters:**

Requirements were added during the exam by two people in the same files (D4 to D7), and rules will change, for example a new threshold or a new species. We must also be able to find and explain any rule quickly.

**Decisions and trade-offs:**

- Rules are separated from the interface: `simulation.ts` holds the rules as pure functions and small tables (`speciesRules`, `recipes`, `DEFENSE_THRESHOLD`, `DRAGON_DESTINATION`), `types.ts` the shapes, `persistence.ts` saving, and the components only show and call
- Pure functions can be tested without a browser
- Every change is marked with a `// Dn:` comment, every decision is documented in `DECISIONS.md`, and each requirement was developed on its own branch and merged through a pull request
- Trade-off: more small functions and indirection than a quick solution, and the `Dwarf` type now also describes fairies. Some behaviour (the chronicle effect, screens) is only tested by hand

**How we evaluate it:**

- `npm test` (all unit tests pass) and `npm run build` (no type errors)
- A rule change touches few places: the dragon threshold is one constant (tests and docs mention the number 2 too), and a new species needs the `Species` type, one entry in `speciesRules` (TypeScript reports an error if it is missing) and the list of species in the save check
- Searching `D7:` (Cmd/Ctrl + Shift + F) finds every place that belongs to a requirement

## Known limits

- Every requirement (D1 to D7) has its own unit tests. The screens and the provider have no automated tests, only the manual checks listed above.
- Some chronicle messages use the day from the moment of the click, so in rare cases they can be one day old (the game state is always correct).
- Double-clicking "Forge" can show the "started forging" message twice, although only one forge job is started.