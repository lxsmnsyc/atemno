---
title: Quick start
description: Install atemno, describe some state, give it a domain, and watch it change.
---

## Install

```bash
npm install atemno
```

atemno has no dependencies. The React binding needs React 18 or newer, which you install yourself.

## Describe state

An atom needs a name and an initial value. The name must be unique, because a domain looks its nodes up by name.

```ts
import { atom, computed } from 'atemno';

const greeting = atom('greeting', 'Hello');
const receiver = atom('receiver', 'World');

const message = computed<string>(
  'message',
  $ => `${$.get(greeting)}, ${$.get(receiver)}!`,
);
```

Nothing has happened yet. These are descriptions.

## Give it a domain

```ts
import { ReactiveDomain } from 'atemno';

const domain = new ReactiveDomain({
  onError(error) {
    console.error(error);
  },
});

domain.get(message); // "Hello, World!"
```

The domain created three nodes on that read: `message`, then the two atoms it read.

## Change it

```ts
domain.set(greeting, 'Bonjour');
domain.get(message); // "Bonjour, World!"
```

## Watch it

```ts
const stop = domain.observe(message, value => {
  console.log(value);
});

domain.set(receiver, 'Monde'); // logs "Bonjour, Monde!"

stop();
```

Subscribing does not call the callback. It runs on the next change.

## Try it

:::demo counter
One atom, one domain. The buttons call `domain.set` and `domain.reset`.
:::

## Next

- The [mental model](./mental-model.md) explains the split between descriptions and domains.
- [React](./react.md) covers the binding.
- The [API reference](./api.md) lists everything.
