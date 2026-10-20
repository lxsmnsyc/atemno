# atemno

> A fine-grained reactive state management library

[![NPM](https://img.shields.io/npm/v/atemno.svg)](https://www.npmjs.com/package/atemno) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

## Install

```bash
npm install --save atemno
```

```bash
yarn add atemno
```

```bash
pnpm add atemno
```

## Usage

```js
import { atom, computed, ReactiveDomain } from 'atemno';

const greeting = atom('greeting', 'Hello');
const receiver = atom('receiver', 'World');

const message = computed(
  'message',
  $ => `${$.get(greeting)}, ${$.get(receiver)}!`,
);

const domain = new ReactiveDomain({});

console.log(domain.get(message)); // "Hello, World!"

domain.observe(message, value => {
  console.log(value);
});

domain.set(greeting, 'Bonjour'); // logs "Bonjour, World!"
```

Atoms and computeds only describe state. A `ReactiveDomain` holds the values, so the same atom can hold different state in different domains.

For React, import the hooks from `atemno/react`:

```jsx
import { atom } from 'atemno';
import { AtemnoDomain, useAtomState } from 'atemno/react';

const counter = atom('counter', 0);

function Counter() {
  const [count, setCount] = useAtomState(counter);
  return <button onClick={() => setCount(n => n + 1)}>{count}</button>;
}

<AtemnoDomain>
  <Counter />
</AtemnoDomain>;
```

## Docs

The documentation lives at [atemno.vercel.app](https://atemno.vercel.app).

- [Quick start](https://atemno.vercel.app/docs/quick-start)
- [Mental model](https://atemno.vercel.app/docs/mental-model)
- [Computeds](https://atemno.vercel.app/docs/computeds)
- [Proxy atoms](https://atemno.vercel.app/docs/proxy-atoms)
- [Resources](https://atemno.vercel.app/docs/resources)
- [Node lifetime](https://atemno.vercel.app/docs/node-lifetime)
- [React](https://atemno.vercel.app/docs/react)
- [API reference](https://atemno.vercel.app/docs/api)
- [Compared with Jotai and Recoil](https://atemno.vercel.app/docs/comparison)

## Sponsors

![Sponsors](https://github.com/lxsmnsyc/sponsors/blob/main/sponsors.svg?raw=true)

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
