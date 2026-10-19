---
title: Computeds
description: A computed derives a value from other sources. Whatever it reads through the tracker context becomes a dependency.
---

## Creating one

```ts
import { computed } from 'atemno';

const count = atom('count', 1);
const double = computed<number>('double', $ => $.get(count) * 2);

domain.get(double); // 2

domain.set(count, 5);
domain.get(double); // 10
```

`$` is the tracker context. Reading through `$.get` is what makes a source a dependency. Pass the type argument, because a computed cannot infer it. [TypeScript](./typescript.md) explains why.

:::demo full-name
`initials` is derived from `full`, which is derived from two atoms. Type in either field.
:::

## Lazy and cached

Writing to `count` marks `double` stale. It does not run it. `double` reruns on its next read, or during the write if something [observes](./observing.md) it. Reading twice with no change in between runs it once.

[Propagation](./propagation.md) shows this on a live graph.

## The tracker context

| Member               | Does                                                                         |
| -------------------- | ---------------------------------------------------------------------------- |
| `$.get(source)`      | Reads a source and records it as a dependency.                               |
| `$.set(atom, value)` | Writes an atom.                                                              |
| `$.reset(source)`    | Resets a source.                                                             |
| `$.onCleanup(fn)`    | Registers work to run before the next run.                                   |
| `$.previous`         | The last successful result, as `{ value }`, or `undefined` on the first run. |

## The previous value

```ts
const total = computed<number>('total', $ => {
  const next = $.get(count);
  return $.previous ? $.previous.value + next : next;
});
```

## Cleanups

`$.onCleanup` runs before the computed runs again. Use it to undo whatever the last run set up.

```ts
const interval = atom('interval', 1000);

const timer = computed<number>('timer', $ => {
  const id = setInterval(tick, $.get(interval));
  $.onCleanup(() => clearInterval(id));
  return id;
});
```

## Forcing a rerun

`domain.reset(double)` runs a computed again even if nothing it read has changed.

## Errors

A computed that throws stores the error and rethrows it on every read. See [errors](./errors.md).
