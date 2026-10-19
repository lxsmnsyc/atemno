---
title: Keyed state
description: Factories build one atom or computed per key, with namespaced names, so a list of records gets one source each.
---

## Atom factories

```ts
import { atomFactory } from 'atemno';

const todo = atomFactory('todo', {
  key: (id: number) => `${id}`,
  value: id => ({ id, done: false }),
});

todo(1).name; // "todo/1"
todo(1) === todo(1); // true while cached
```

`key` turns a key into the part of the name after the slash. `value` builds the initial value for that key.

:::demo todos
Each row reads only its own atom. `remaining` is a computed over all three.
:::

## Computed factories

```ts
import { computedFactory } from 'atemno';

const label = computedFactory('label', {
  key: (id: number) => `${id}`,
  computed: id => $ => ($.get(todo(id)).done ? 'done' : 'pending'),
});
```

## The cache only holds descriptions

A factory keeps up to `limit` descriptions in an LRU, 100 by default. Dropping one from the cache forgets the description object, not any state.

A domain finds nodes by name. Asking for an evicted key builds a new description with the same name, and a domain that still holds that node returns its current value through it. State goes away only when the domain releases the node, as described in [node lifetime](./node-lifetime.md).

## Options

| Option     | Factory           | Meaning                                          |
| ---------- | ----------------- | ------------------------------------------------ |
| `key`      | both              | Turns a key into a string. Required.             |
| `value`    | `atomFactory`     | Builds the initial value. Required.              |
| `computed` | `computedFactory` | Builds the computation. Required.                |
| `isEqual`  | both              | Equality for every instance.                     |
| `limit`    | both              | How many descriptions to cache. Defaults to 100. |
