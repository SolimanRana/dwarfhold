# Team Decisions

This file records the design decisions our team made for Dwarfhold. (including the reasons and trade-offs behind them)

## D1 - Food shortage and its consequences

**Decision:** 

Only dwarves who ate the evening before can work

**Food distribution:** 

1. Every dwarf needs one food per day (including dwarves on expedition)
2. Non-Farmers eat first in a fixed order (top to bottom)
3. Farmers eat last, because they work even when they are hungry. That way the food goes to the dwarves who would otherwise stop working
4. A dwarf who gets no food is marked as "hungry" for the next day

**Effect of being hungry:**

- A hungry dwarf produces nothing on the next day
- Exception: hungry farmers still work, otherwise a colony with 0 food could never produce food again and starve
- Hunger lasts one day, a dwarf who eats again the next evening is no longer hungry
  
**Reason for this decision:**

We also considered a simpler rule where the whole colony stops working (except farmers) as soon as there is a food shortage. We preferred our rule, because each dwarf is handled individually. The player can see exactly who is affected and can react by assigning more farmers. The fixed order makes the result deterministic. At first we planned to let farmers eat first. We changed this, because hungry farmers still work anyway, so feeding them first would only make other dwarves hungry without any benefit.

**Trade-off:**

It needs a hunger flag per dwarf instead of one value for the whole colony  

## D1 - One activity per dwarf

**Decision:**

A dwarf on an expedition does not produce resources from their local job. They keep their assignment and continue working after they return.

**Reason for this decision:**

A dwarf can only be in one place at a time. Keeping the assignment means the player doesn't have to assign the dwarf again after the expedition.

## D2 - Compatible jobs for tools

**Decision:**

Tools only give a bonus for Woodcutting and Deep Mining. Farming gets no bonus.

**Reason for this decision:**

An axe or a pickaxe makes sense for wood and stone, but not for growing mushrooms. It also keeps food limited, so the food shortage rule from D1 still matters.

**Effect:**

- A dwarf with a tool produces one extra unit of their resource per day (Woodcutting 3 -> 4, Deep Mining 2 -> 3)
- A dwarf with a tool who is farming, unassigned, hungry or on an expedition gets no bonus

## D2 - Equipping tools

**Decision:**

Each dwarf has a flag that says whether they carry a tool. The tool count in the inventory only shows tools that are in storage and free to use.

- Equipping a tool: inventory -1 = the dwarf now carries a tool
- Returning a tool: inventory +1 = the dwarf no longer carries a tool
- A dwarf can carry at most one tool and a tool can only be equipped when one is in storage

**Reason for this decision:**

There is only one kind of tool and tools have no durability, so we don't need to track individual tools. The inventory number directly shows how many tools are still available.

**Trade-off:**

Equipping and returning always change two things (inventory and dwarf). We do both in a single state update, so they can never get out of sync.

## D2 - Weapon recipe

**Decision:**

A weapon costs 2 wood + 4 stone. Weapons are stored as a colony resource and are not equipped by individual dwarves.

**Reason for this decision:**

A tool costs 3 wood + 2 stone. Giving weapons a different cost that needs more stone makes the player choose between gathering wood or stone. It also makes a tool for the miner more useful.

**Note:**

How weapons are used when Stonehome is attacked is decided in D7.

## D3 - Crafting as colony work

**Decision:**

Forging takes time and needs a dwarf. A tool takes 1 day, a weapon takes 2 days.

**Rules:**

1. Time is measured in simulation days, so crafting also stops when the game is paused
2. Only one item can be forged at a time, because Stonehome has one forge
3. A dwarf can start forging if they are not on an expedition, not hungry and the forge is free
4. Materials are paid when forging starts, so the same wood or stone can't be used twice
5. While forging, the dwarf keeps their job but doesn't produce anything. After the item is done they continue their job
6. Once forging has started it always finishes on time, even if the dwarf gets hungry in the meantime
7. While forging, the dwarf can't change their job and can't go on an expedition (one activity at a time, see D1)

**Invalid attempts:**

If there are not enough materials, the dwarf is not eligible or the forge is busy, nothing changes. No materials are used and no dwarf is changed.

**Reason for this decision:**

Counting in days fits the daily simulation. Paying at the start and allowing only one forge job at a time keeps the inventory consistent and makes the interface simple: it shows one dwarf and the day the item will be ready.

**Trade-off:**

The player can't forge several items in parallel, even if several dwarves are free.

## D4 - Resilient expeditions

**Decision (who can go):**

A dwarf can only be sent on an expedition if they are at home (not already away and not at the forge) and not hungry. This is the same rule as for forging in D3, so Stonehome has one clear idea of "available".

**Decision (one expedition at a time):**

Only one expedition can be travelling at once. Sending is blocked until the current one has finished, and the interface says why.

**Decision (tools during an expedition):**

A dwarf keeps their tool while they are away. The tool stays assigned to that dwarf, so nobody else can take it and it can't be returned or equipped during the trip. It gives no production bonus while the dwarf is away.

**Decision (start and finish):**

When a dwarf leaves, the colony state records one expedition (who went and where). When the result arrives, one single state update does everything together: it adds the rewards (only on success), sends the dwarf home and clears the expedition record. A result is only applied if the matching expedition record still exists, so the same result can never be applied twice.

**Invalid or failed attempts:**

- An invalid attempt (dwarf not available, or another expedition already out) changes nothing and shows a warning.
- A failed expedition gives no rewards, but the dwarf still comes home and can work again.

**Reason for this decision:**

Recording the expedition in the colony state, and finishing it in one update, means the dwarf's status and the resources can never get out of sync, even if the server is slow or the player clicks twice. Keeping the tool with the dwarf avoids extra steps before departure and is consistent with the D2 rule that equipping and returning are blocked while a dwarf is away.

**Trade-off:**

One expedition at a time is simpler and safer, but the player can't send several dwarves at once. A tool is also unavailable to others while its owner is away.

## D5 - Save and restore

**Decision (what is saved):**

The colony is saved in the browser (`localStorage`) after every change: the day, the resources, all dwarves (job, status, hunger, tool), the forge job, the expedition record and the chronicle. The pause button is not saved, so after a refresh the hold always wakes up and runs. Days do not pass while the page is closed.

**Decision (forge job interrupted by a refresh):**

The forge job is restored exactly as it was and carries on. Forging is measured in game days, not in real seconds, so it finishes after the same number of days. The Forge page shows the smith and the day the item is ready, and the chronicle says that the colony was restored.

**Decision (expedition interrupted by a refresh):**

The expedition server does not remember trips, so the result is lost when the page is refreshed. The expedition is therefore cancelled: the dwarf comes home straight away with no rewards, keeps their job and their tool, and the chronicle says that the expedition was interrupted by the refresh.

**Decision (corrupt or incompatible data):**

The save contains a version number. When the game starts, the saved data is parsed and checked (version, numbers, known statuses and jobs, and that the forge and expedition refer to real dwarves). If anything is wrong, the whole save is ignored, a new colony starts and the chronicle says that the saved game could not be read. The game never crashes because of a bad save. If the browser does not allow saving, the game simply runs without saving.

**Reason for this decision:**

Counting forge time in game days means the forge needs no special handling after a refresh. Cancelling an expedition is safer than sending the request again, because we could not know whether the first request had already finished, and the player always sees what happened. Checking the whole save before using it, and starting fresh if it is wrong, is simple and predictable.

**Trade-off:**

An interrupted expedition is lost, and one wrong value costs the whole save instead of repairing it. When a later requirement changes the shape of the colony (for example a new species), the version number must be raised, so old saves are discarded safely instead of breaking the game.

## D6 - A new species joins Stonehome

**Decision (who joins):**

Lumi Glimmerwing, a cave fairy, joins Stonehome. Every character now has a species ("dwarf" or "fairy"), so the colony can tell them apart in the rules and in the interface. The newcomer arrives idle, not hungry and without a tool.

**Decision (when and where):**

Lumi joins after the first successful expedition to the Crystal Cave. A failed expedition never brings anyone. Lumi can only join once: the rule checks whether a fairy already lives in Stonehome, so no extra flag is needed. The Expedition panel tells the player about the rumour (until Lumi has joined), and the chronicle announces the arrival.

**Decision (production):**

Cave fairies are master mushroom farmers: 6 rations a day instead of 4. They can only farm (or stay unassigned), so they cannot mine or cut wood. The job list for a fairy only shows what she can do, and her card shows what she produces.

**Decision (crafting limitation):**

A fairy can forge tools but not weapons. If the player tries, the forge refuses with a clear message and nothing changes (the same rule as in D3: an invalid attempt changes nothing).

**Decision (equipment):**

The tool bonus only helps woodcutting and mining, which fairies cannot do. So fairies cannot be given a tool, and their card says so.

**Decision (shared rules):**

Lumi follows the same rules as the dwarves: eats one ration a day (and eats last, like all farmers, and still works when hungry), can be away on an expedition, can't change jobs while away or at the forge, and is saved and restored with the colony. Because saved characters now have a species, the save version is raised to 2, and older saves are rejected safely.

**Reason for this decision:**

One field (`species`) and one small table of species rules keep the differences in one place. The same function that calculates production is used by the daily simulation and by the Colony page, so the screen and the game cannot disagree. Making the differences a trade-off (high food output, but only one job and no weapons) gives the player a real decision.

**Trade-off:**

Only one new species and one fixed arrival make the rules simple to explain and test, but there is nothing more to discover after Lumi has joined. Raising the save version means players lose an old save once.