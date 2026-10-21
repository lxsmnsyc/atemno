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

An action context has `get`, `set` and `reset`. It cannot track dependencies or register cleanups, because nothing reruns it.

## Observers see the whole action

An action runs in a [batch](./propagation.md#batching-writes). Each `$.set` takes effect immediately, so reads later in the action see it, but observers are only called once the action returns, with the final state.

## Actions are not transactions

If an action throws halfway, the writes before the throw stay made, and observers are still called for them. Check first, then write, as `transfer` does.
