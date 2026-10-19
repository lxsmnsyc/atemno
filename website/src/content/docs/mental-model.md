---
title: Mental model
description: Descriptions say what state is. Domains hold it. Reads build the graph, writes mark it, and reads again settle it.
---

## Descriptions and domains

Think of an atom as a column in a table and a domain as a row. The column says what can be stored and what it starts as. Each row stores its own value.

```ts
const theme = atom('theme', 'light');

const alice = new ReactiveDomain({});
const bob = new ReactiveDomain({});

alice.set(theme, 'dark');

alice.get(theme); // "dark"
bob.get(theme); // "light"
```

:::demo two-domains
The same `clicks` atom, held by two domains. Each panel only ever moves its own count.
:::

## Reads build the graph

A domain has no graph until something reads. Reading a computed runs it, and every source it reads through `$.get` becomes one of its dependencies. Those sources are created on the spot if this is their first read.

So the graph is always exactly what has been read, in the shape it was last read in.

## Writes mark, reads settle

A write does not recompute anything by itself. It marks what depends on the atom as stale.

- If something [observes](./observing.md) a stale computed, the domain brings it up to date during the write, because the observer needs the new value.
- If nothing observes it, it stays stale. The next read reruns it, once, with the latest inputs.

That is the whole trick, and [propagation](./propagation.md) shows it running.

## Nodes come and go

A node lives as long as something tracks it. When the last computed or observer that read it lets go, the domain releases the node and its state with it. A node that nothing ever tracked is kept for the life of the domain. [Node lifetime](./node-lifetime.md) covers when this matters.

## Names are identity

A domain finds a node by its source's name, not by the object. Two descriptions with the same name are the same state as far as a domain is concerned. That is what lets [factories](./keyed-state.md) hand out fresh description objects for a key without losing anything, and it is why names must be unique.
