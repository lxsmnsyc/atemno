---
title: How updates propagate
description: A write marks what depends on it. Observed computeds catch up during the write. Everything else waits until something reads it.
---

## A write only marks

When you write an atom, the domain does not recompute anything for its own sake. It marks the graph.

- Computeds that read the atom directly are **dirty**. Something they read has changed, so they must rerun before anyone trusts their value.
- Computeds further downstream are **maybe stale**. Something upstream changed, but whether it reaches them depends on what the dirty ones return.

## Observed computeds catch up during the write

If an observer is watching a computed, the domain brings that computed up to date before `set` returns, because the observer needs the new value. It marks everything the write affects first, without running anything. Then, for each observer, it walks upstream, reruns what is dirty, and checks what is maybe stale. A computed reachable through several paths, such as the bottom of a diamond, still runs once. Finally it calls the observers whose values changed.

## Everything else waits

A computed that nothing observes stays marked. The next read does the same walk, at that moment, with the latest inputs. Ten writes and one read cost one rerun.

:::demo graph/cart
`label` starts observed, so changing the price reruns the whole chain at once. Switch **observe label** off and the derived nodes are released. Press **Read label** to bring them back without observing, then change the price: now nodes turn dirty and maybe stale, and wait until you read again.
:::

## Equal results stop the update

A computed that reruns and returns a value equal to its last one does not count as changed. Nothing downstream of it reruns, and no observer is called.

:::demo graph/cutoff
**Add 2** keeps `n` even. `parity` reruns and returns `"even"` again, so `message` never runs. Step by one to see `message` run.
:::

Equality uses the computed's `isEqual`, which defaults to strict equality with `NaN` equal to itself. Pass a third argument to `computed` for a looser check.

## Batching writes

Each write runs the observers it affects before `set` returns. To write several sources and have observers see only the end result, wrap the writes in `domain.batch`.

```ts
domain.batch(() => {
  domain.set(first, 'Grace');
  domain.set(last, 'Hopper');
});
// Observers of `fullName` are called once, with "Grace Hopper".
```

- Reads inside the batch see each write straight away. Only observers wait.
- Batches nest. Observers run when the outermost batch ends, even if it throws.
- An observer whose value ends where it started is not called.
- [Actions](./actions.md) and writes to [proxy atoms](./proxy-atoms.md) run in a batch already.

## Reading the graph

The [explorer](/explorer) has these scenarios and two more, with a log of every write, run and release.
