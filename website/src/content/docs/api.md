---
title: API
description: Every export of atemno and atemno/react.
---

## atemno

| Export                                      | Description                                     |
| ------------------------------------------- | ----------------------------------------------- |
| `atom(name, initialValue, isEqual?)`        | Describes a writable value.                     |
| `lazyAtom(name, getInitialValue, isEqual?)` | Describes a writable value built on first use.  |
| `computed(name, compute, isEqual?)`         | Describes a value derived from other sources.   |
| `proxy(name, { get, set, isEqual? })`       | Describes a derived value that can be written.  |
| `resource(name, compute, options?)`         | Describes a derived value that can be async.    |
| `producer(name, initialValue, setup)`       | Describes a value fed from outside the domain.  |
| `ResourceNotReadyError`                     | Thrown when reading a pending resource.         |
| `toResult(source)`                          | A computed describing a read, never throwing.   |
| `isPending(source)`                         | A computed telling whether it is pending.       |
| `isRefreshing(source)`                      | A computed telling whether it is rerunning.     |
| `waitForNone(sources)`                      | A computed with one result per source.          |
| `waitForAll(sources)`                       | A computed with every value, once all resolved. |
| `waitForAny(sources)`                       | A computed with the first value that resolved.  |
| `waitForRace(sources)`                      | A computed with the first outcome to settle.    |
| `action(callback)`                          | Describes a set of reads and writes.            |
| `atomFactory(name, options)`                | Builds a cached atom per key.                   |
| `computedFactory(name, options)`            | Builds a cached computed per key.               |
| `new ReactiveDomain(options)`               | Holds the state for a set of sources.           |

## ReactiveDomain

| Method                      | Description                                               |
| --------------------------- | --------------------------------------------------------- |
| `get(source)`               | Reads any source, creating its node if needed.            |
| `set(source, value)`        | Writes an atom, or passes a value to a proxy.             |
| `reset(source)`             | Restores an initial value, or makes a computed run again. |
| `observe(source, callback)` | Subscribes. Returns a function that unsubscribes.         |
| `observeWeak(source, cb)`   | Subscribes without keeping the source alive.              |
| `batch(callback)`           | Holds observers back until the callback returns.          |
| `getAction(action)`         | Binds an action to this domain.                           |
| `destroyAtom(source)`       | Releases one atom's node.                                 |
| `destroyLazyAtom(source)`   | Releases one lazy atom's node.                            |
| `destroyComputed(source)`   | Releases a computed's, proxy's or resource's node.        |
| `destroy()`                 | Tears down the domain.                                    |

## atemno/react

| Export                     | Description                                         |
| -------------------------- | --------------------------------------------------- |
| `AtemnoDomain`             | Builds a domain, supplies it, and tracks its graph. |
| `AtemnoGraph`              | Renders the graph as elements for React DevTools.   |
| `useAtemnoDomain()`        | Returns the nearest domain.                         |
| `useAtomValue(source)`     | Reads an atom, lazy atom or proxy atom.             |
| `useComputedValue(source)` | Reads a computed, proxy or resource. Suspends.      |
| `useSetAtom(source)`       | Returns a setter, without subscribing.              |
| `useAtomState(source)`     | Returns a value and a setter.                       |
| `useResetSource(source)`   | Returns a callback that resets the source.          |
| `useAction(action)`        | Binds an action to the nearest domain.              |
| `useAtemnoGraph()`         | Returns every live node with its state.             |
