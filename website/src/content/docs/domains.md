---
title: Reactive domains
description: A ReactiveDomain holds the values, runs the computeds, and notifies the observers. Two domains never share state.
---

## Creating one

```ts
import { ReactiveDomain } from 'atemno';

const domain = new ReactiveDomain({
  onError(error) {
    console.error(error);
  },
});
```

There is no global domain. Every read and write names the domain it goes to.

## Isolation

A domain holds its own value for every description it sees.

```ts
const a = new ReactiveDomain({});
const b = new ReactiveDomain({});

a.set(message, 'Only in a');

a.get(message); // "Only in a"
b.get(message); // "Hello, World!"
```

That is what makes a domain a good fit for [per-request state on a server](./server-rendering.md) and for [test isolation](./testing.md).

## Options

All four are optional.

| Option      | Called with | When                                                                             |
| ----------- | ----------- | -------------------------------------------------------------------------------- |
| `onError`   | the error   | An observer throws. Without it, the error is rethrown to whoever made the write. |
| `onCreate`  | the source  | The domain creates a node for a source.                                          |
| `onUpdate`  | the source  | A node's value changes.                                                          |
| `onDestroy` | the source  | The domain releases a node.                                                      |

The three lifecycle hooks are how the [React devtools graph](./react-devtools.md) and the [explorer](/explorer) watch a domain work.

## Methods

| Method                                                                      | Does                                                             |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `get(source)`                                                               | Reads any source, creating its node if needed.                   |
| `set(source, value)`                                                        | Writes an atom or lazy atom. Ignored if the value is equal.      |
| `reset(source)`                                                             | Restores an atom's initial value, or forces a computed to rerun. |
| `observe(source, callback)`                                                 | Subscribes to changes. Returns a function that unsubscribes.     |
| `getAction(action)`                                                         | Binds an [action](./actions.md) to this domain.                  |
| `destroyAtom(source)`, `destroyLazyAtom(source)`, `destroyComputed(source)` | Release one node.                                                |
| `destroy()`                                                                 | Tears the whole domain down.                                     |

## Tearing down

After `destroy`, reads and new subscriptions throw, and writes are ignored.

```ts
domain.destroy();

domain.set(message, 'ignored'); // nothing happens
domain.get(message); // throws "Attempt to perform actions in a dead ReactiveDomain."
```
