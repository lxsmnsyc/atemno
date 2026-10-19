---
title: Lazy atoms
description: A lazy atom computes its initial value the first time a domain needs it, once per domain.
---

## When to use one

`atom` evaluates its initial value immediately, at the moment you create the description. That is wrong for values that only exist in some environments, or that are expensive to produce.

```ts
import { lazyAtom } from 'atemno';

const theme = lazyAtom('theme', () => localStorage.getItem('theme') ?? 'light');
```

The function runs when a domain first creates the node: on the first read, write, or subscription in that domain. A module that defines this atom can be imported on a server without touching `localStorage`.

:::demo lazy-atom
The function runs on the first read, and again on every `reset`.
:::

## Behaviour

- The function runs once per domain, not once per read.
- `domain.reset(theme)` runs it again and writes the result.
- Otherwise a lazy atom is an atom. It can be written to, observed, and read by computeds.

## Releasing

A released lazy atom runs its function again when something brings it back, the same way a released atom starts over from its initial value. See [node lifetime](./node-lifetime.md). To release one yourself, call `domain.destroyLazyAtom(theme)`.
