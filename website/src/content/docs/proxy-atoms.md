---
title: Proxy atoms
description: A proxy atom reads like a computed and writes like an atom. A write runs your own function, which passes the value on to the sources it is derived from.
---

## Creating one

```ts
import { atom, proxy } from 'atemno';

const celsius = atom('celsius', 20);

const fahrenheit = proxy<number>('fahrenheit', {
  get: $ => ($.get(celsius) * 9) / 5 + 32,
  set($, value) {
    $.set(celsius, ((value - 32) * 5) / 9);
  },
});

domain.get(fahrenheit); // 68
domain.set(fahrenheit, 212);
domain.get(celsius); // 100
```

`get` is a [computation](./computeds.md), with the same tracker context, the same laziness and the same cache. `set` receives an [action context](./actions.md) and the written value, and decides what to write where. The proxy stores nothing of its own.

:::demo temperature
Only Celsius is stored. Typing in either field writes it, the Fahrenheit one through the proxy.
:::

## Anywhere an atom goes

A proxy atom is a writable source, so `domain.set`, `$.set` inside actions and computations, and the React hooks for atoms all accept it.

```tsx
const [value, setValue] = useAtomState(fahrenheit);
```

Unlike an atom, a write does not compare the value first. `set` always runs, and the atoms it writes do their own equality checks.

## One write, several steps

When `set` writes several atoms, each write takes effect as it happens, the same as in an action. An observer of the proxy can see the value between the writes.

```ts
const fullName = proxy<string>('fullName', {
  get: $ => `${$.get(first)} ${$.get(last)}`,
  set($, value) {
    const [nextFirst = '', nextLast = ''] = value.split(' ');
    $.set(first, nextFirst);
    $.set(last, nextLast);
  },
});

domain.observe(fullName, console.log);
domain.set(fullName, 'Grace Hopper');
// "Grace Lovelace", then "Grace Hopper"
```

## Names and lifetime

Proxy atoms have their own namespace in a domain, so a proxy and a computed with the same name do not share a node. Like a computed, a proxy is released once nothing tracks it, and the atoms it read are released with it if nothing else holds them.
