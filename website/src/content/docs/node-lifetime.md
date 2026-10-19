---
title: Node lifetime
description: A domain releases a node once nothing tracks it, and its state goes with it. Nodes that nothing ever tracked are kept.
---

## Created on first use

A domain creates a node the first time it sees a source: a read, a write, or a subscription.

## Released when untracked

A node is tracked by the computeds that read it and by the observers watching it. When the last of those lets go, the domain releases the node. Released state is gone. The next use builds the node again from its initial value.

```ts
const stop = domain.observe(count, log);
domain.set(count, 9);

stop();

domain.get(count); // 0, rebuilt from the initial value
```

:::demo graph/lifetime
Nothing holds `draft`. Write to it, switch **observe shout** off, and both nodes are released. Switch it back on and `draft` is back at `"hello"`.
:::

Release cascades. A computed that is released stops tracking what it read, which can release those in turn.

## Never tracked, never released

A node that nothing ever tracked is not released on its own. Reading and writing an atom without observing it keeps its value for the life of the domain.

## This is the sharpest edge

In a component tree, each reading component is usually the only tracker a source has. Unmounting the last reader therefore discards the state, which is not what Jotai or Recoil do. Keep a source alive by holding a subscription somewhere that outlives the components:

```ts
const keep = domain.observe(count, () => {});
```

## Releasing by hand

`domain.destroyAtom`, `domain.destroyLazyAtom` and `domain.destroyComputed` release one node. `domain.destroy` releases all of them and retires the domain.
