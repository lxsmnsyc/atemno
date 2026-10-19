---
title: Actions
description: An action groups reads and writes behind one function. Like an atom, it is a description until a domain binds it.
---

## Creating and binding

```ts
import { action } from 'atemno';

const increment = action(($, amount: number) => {
  $.set(count, $.get(count) + amount);
  return $.get(count);
});

const bump = domain.getAction(increment);

bump(5); // 5
bump(3); // 8
```

`action` returns the function you gave it, typed. `getAction` binds it to a domain, so the same action works against any domain.

:::demo transfer
`transfer` checks the balance before moving anything, and returns whether it went through.
:::

## The action context

An action context has `get`, `set` and `reset`. It cannot track dependencies or register cleanups, because nothing reruns it. Observers of anything it writes are called as each write happens.

## Actions are not transactions

Each `$.set` inside an action takes effect immediately, and observers see it. If an action throws halfway, the writes before the throw stay made. Check first, then write, as `transfer` does.
