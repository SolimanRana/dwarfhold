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