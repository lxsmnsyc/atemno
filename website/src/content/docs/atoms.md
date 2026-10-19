---
title: Atoms
description: An atom is the smallest unit of state. It holds one value, can be written to, and can be observed.
---

## Creating one

```ts
import { atom } from 'atemno';

const message = atom(
  // A name, unique across everything a domain will see.
  'message',
  // The initial value.
  'Hello, World!',
);
```

Creating an atom allocates nothing in any domain. It is a plain object that says what the state is called and what it starts as.

## Reading and writing

Every read and write goes through a [domain](./domains.md).

```ts
domain.get(message); // "Hello, World!"

domain.set(message, 'foo, bar!');
domain.get(message); // "foo, bar!"

domain.reset(message);
domain.get(message); // "Hello, World!"
```

## Equality

A write that produces an equal value is ignored. Nothing is marked stale and no observer runs.

By default two values are equal when they are strictly equal, with one exception: `NaN` equals `NaN`. Pass your own check as the third argument when identity is too strict.

```ts
const point = atom(
  'point',
  { x: 0, y: 0 },
  (prev, next) => prev.x === next.x && prev.y === next.y,
);

domain.set(point, { x: 0, y: 0 }); // ignored
```

## Names

The name is how a domain recognises the atom. Two atoms with the same name share a node, so the second one's initial value is ignored once the node exists. Keep names unique. For many atoms of the same shape, use a [factory](./keyed-state.md), which namespaces names for you.

## Initial values that cannot wait

`atom` evaluates its initial value when you create the description. If that is not safe or not cheap, use a [lazy atom](./lazy-atoms.md).
