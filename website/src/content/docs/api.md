---
title: API
description: Every export of atemno and atemno/react.
---

## atemno

| Export                                      | Description                                    |
| ------------------------------------------- | ---------------------------------------------- |
| `atom(name, initialValue, isEqual?)`        | Describes a writable value.                    |
| `lazyAtom(name, getInitialValue, isEqual?)` | Describes a writable value built on first use. |
| `computed(name, compute, isEqual?)`         | Describes a value derived from other sources.  |
| `action(callback)`                          | Describes a set of reads and writes.           |
| `atomFactory(name, options)`                | Builds a cached atom per key.                  |
| `computedFactory(name, options)`            | Builds a cached computed per key.              |
| `new ReactiveDomain(options)`               | Holds the state for a set of sources.          |

## ReactiveDomain

| Method                      | Description                                       |
| --------------------------- | ------------------------------------------------- |
| `get(source)`               | Reads any source, creating its node if needed.    |
| `set(source, value)`        | Writes an atom. Ignored if the value is equal.    |
| `reset(source)`             | Restores an initial value, or reruns a computed.  |
| `observe(source, callback)` | Subscribes. Returns a function that unsubscribes. |
| `getAction(action)`         | Binds an action to this domain.                   |
| `destroyAtom(source)`       | Releases one atom's node.                         |
| `destroyLazyAtom(source)`   | Releases one lazy atom's node.                    |
| `destroyComputed(source)`   | Releases one computed's node.                     |
| `destroy()`                 | Tears down the domain.                            |

## atemno/react

| Export                     | Description                                         |
| -------------------------- | --------------------------------------------------- |
| `AtemnoDomain`             | Builds a domain, supplies it, and tracks its graph. |
| `AtemnoProvider`           | Supplies a domain you built yourself.               |
| `AtemnoGraph`              | Renders the graph as elements for React DevTools.   |
| `useAtemnoDomain()`        | Returns the nearest domain.                         |
| `useAtomValue(source)`     | Reads an atom or lazy atom.                         |
| `useComputedValue(source)` | Reads a computed.                                   |
| `useSetAtom(source)`       | Returns a setter, without subscribing.              |
| `useAtomState(source)`     | Returns a value and a setter.                       |
| `useResetSource(source)`   | Returns a callback that resets the source.          |
| `useAction(action)`        | Binds an action to the nearest domain.              |
| `useAtemnoGraph()`         | Returns every live node with its state.             |
