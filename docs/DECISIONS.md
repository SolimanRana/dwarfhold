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