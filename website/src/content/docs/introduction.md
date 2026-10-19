---
title: Introduction
description: atemno is a fine-grained reactive state library. Atoms and computeds describe values, a domain holds them, and only what something reads ever reruns.
---

## What it is

atemno splits state into two halves.

- **Descriptions.** An [atom](./atoms.md) describes a value you can write. A [computed](./computeds.md) describes a value derived from other values. Creating either allocates nothing and holds nothing.
- **A domain.** A [`ReactiveDomain`](./domains.md) holds the actual values. It creates a node the first time it sees a description, tracks what every computed reads, and decides what has to rerun when something changes.

```ts
import { atom, computed, ReactiveDomain } from 'atemno';

const count = atom('count', 1);
const double = computed<number>('double', $ => $.get(count) * 2);

const domain = new ReactiveDomain({});

domain.get(double); // 2
domain.set(count, 5);
domain.get(double); // 10
```

## Why split them

Because a description is cheap and state is not. The same atom holds a different value in every domain, so there is no global store to share by accident.

- On a server, give every request its own domain. Nothing leaks between users.
- In tests, give every test its own domain. There is nothing to reset afterwards.
- In an app, nest domains to give a subtree isolated state.

## What it does for you

- **Computeds are lazy.** Writing to an atom marks what depends on it stale. A computed reruns when something reads it, or straight away if something [observes](./observing.md) it. See [how updates propagate](./propagation.md).
- **Dependencies are collected per run.** A computed depends on what it read last time, so a branch it did not take is not a dependency. See [dynamic dependencies](./dynamic-dependencies.md).
- **Equal values stop early.** A computed that returns an equal result ends the update there.
- **Unused nodes are released.** A node goes away once nothing tracks it. See [node lifetime](./node-lifetime.md), which also covers the sharpest edge in the library.
- **The core is framework agnostic.** [React](./react.md) ships as a binding. Anything else is [one subscription](./other-frameworks.md).

> [!TIP]
> The [explorer](/explorer) draws a live domain as it runs. It is the quickest way to see what "lazy" means here.

## Where to go next

Start with the [quick start](./quick-start.md), then read the [mental model](./mental-model.md). If you know Jotai or Recoil, the [comparison](./comparison.md) covers what is different.
