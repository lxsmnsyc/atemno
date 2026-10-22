---
title: Compared with Jotai and Recoil
description: All three split state into atoms and derive the rest. They differ in where the state lives, how atoms are named, and when state is let go.
---

## At a glance

|                    | atemno                                        | Jotai                                 | Recoil                               |
| ------------------ | --------------------------------------------- | ------------------------------------- | ------------------------------------ |
| Scope              | Framework agnostic core, with a React binding | React, with a store usable on its own | React                                |
| Where state lives  | An explicit `ReactiveDomain`, always          | A default store, `Provider` optional  | A `RecoilRoot`, required             |
| Atom identity      | A string name you choose                      | The atom object                       | A string key, unique across the app  |
| Derived state      | `computed` and writable `proxy`, lazy, cached | Derived atoms                         | Selectors                            |
| Keyed state        | `atomFactory`, `computedFactory`              | `atomFamily` from `jotai-family`      | `atomFamily`, `selectorFamily`       |
| Grouped writes     | `action`, bound to a domain                   | Write functions on atoms              | `useRecoilCallback` and transactions |
| Async and Suspense | `resource`, with Suspense in React            | Promises with Suspense                | Async selectors with Suspense        |
| State lifetime     | Released once nothing tracks it               | As long as the store                  | As long as the root                  |
| Maturity           | Not released yet                              | Stable, widely used                   | No longer under active development   |

## A counter

The same counter in each, with a derived value. Pick a tab and every example on this page switches to it.

:::code-group

```tsx title="atemno"
import { atom, computed } from 'atemno';
import { AtemnoDomain, useAtomState, useComputedValue } from 'atemno/react';

const count = atom('count', 0);
const double = computed<number>('double', $ => $.get(count) * 2);

function Counter() {
  const [value, setCount] = useAtomState(count);
  const doubled = useComputedValue(double);
  return (
    <button onClick={() => setCount(n => n + 1)}>
      {value} × 2 = {doubled}
    </button>
  );
}

export function App() {
  return (
    <AtemnoDomain>
      <Counter />
    </AtemnoDomain>
  );
}
```

```tsx title="Jotai"
import { atom, useAtom, useAtomValue } from 'jotai';

const countAtom = atom(0);
const doubleAtom = atom(get => get(countAtom) * 2);

function Counter() {
  const [value, setCount] = useAtom(countAtom);
  const doubled = useAtomValue(doubleAtom);
  return (
    <button onClick={() => setCount(n => n + 1)}>
      {value} × 2 = {doubled}
    </button>
  );
}

export function App() {
  return <Counter />;
}
```

```tsx title="Recoil"
import {
  RecoilRoot,
  atom,
  selector,
  useRecoilState,
  useRecoilValue,
} from 'recoil';

const countState = atom({ key: 'count', default: 0 });
const doubleState = selector({
  key: 'double',
  get: ({ get }) => get(countState) * 2,
});

function Counter() {
  const [value, setCount] = useRecoilState(countState);
  const doubled = useRecoilValue(doubleState);
  return (
    <button onClick={() => setCount(n => n + 1)}>
      {value} × 2 = {doubled}
    </button>
  );
}

export function App() {
  return (
    <RecoilRoot>
      <Counter />
    </RecoilRoot>
  );
}
```

:::

The components are nearly identical. The differences are in the first lines and the last ones: how a piece of state is named, and where it is stored.

## Where the state lives

Jotai keeps a default store, so an atom works with no setup and a `Provider` is something you add for isolation. Recoil puts the store in a `RecoilRoot` you must render. atemno has no implicit store, so every read names a domain. That is more ceremony in a small app and less on a server, where every request wants its own state and sharing one by accident is a bug.

Here is state for one server request, seeded with the signed-in user:

:::code-group

```tsx title="atemno"
import { AtemnoDomain } from 'atemno/react';

function renderPage(user: User) {
  return (
    <AtemnoDomain initialize={domain => domain.set(currentUser, user)}>
      <Page />
    </AtemnoDomain>
  );
}
```

```tsx title="Jotai"
import { Provider, createStore } from 'jotai';

function renderPage(user: User) {
  const store = createStore();
  store.set(currentUserAtom, user);
  return (
    <Provider store={store}>
      <Page />
    </Provider>
  );
}
```

```tsx title="Recoil"
import { RecoilRoot } from 'recoil';

function renderPage(user: User) {
  return (
    <RecoilRoot initializeState={({ set }) => set(currentUserState, user)}>
      <Page />
    </RecoilRoot>
  );
}
```

:::

In Jotai, forgetting the `Provider` falls back to the default store, which one server process shares across every request. atemno has nothing to fall back to: the hooks throw without a domain above them.

## Names

Jotai identifies an atom by the object, so there is nothing to keep unique and nothing to collide. atemno and Recoil take a string. That costs a decision per atom and buys a readable handle in devtools, logs and anything else that reads the graph.

The difference shows most in state keyed by an id, one atom per todo:

:::code-group

```ts title="atemno"
import { atomFactory } from 'atemno';

const todo = atomFactory('todo', {
  key: (id: number) => `${id}`,
  value: id => ({ id, done: false }),
});

todo(1).name; // "todo/1"
```

```ts title="Jotai"
import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

const todoAtom = atomFamily((id: number) => atom({ id, done: false }));

todoAtom(1) === todoAtom(1); // true, cached by id
```

```ts title="Recoil"
import { atomFamily } from 'recoil';

const todoState = atomFamily({
  key: 'todo',
  default: (id: number) => ({ id, done: false }),
});
```

:::

atemno's factory and Recoil's family both derive a name per key, `todo/1` in atemno. Jotai's family caches atom objects by key and keeps them until you remove them. atemno's cache holds only descriptions: the state for `todo/1` is found by its name, so it survives a description being evicted. See [keyed state](./keyed-state.md).

## Writing several atoms at once

:::code-group

```ts title="atemno"
import { action } from 'atemno';
import { useAction } from 'atemno/react';

const transfer = action(($, amount: number) => {
  $.set(checking, $.get(checking) - amount);
  $.set(savings, $.get(savings) + amount);
});

// In a component
const send = useAction(transfer);
send(50);
```

```ts title="Jotai"
import { atom, useSetAtom } from 'jotai';

const transferAtom = atom(null, (get, set, amount: number) => {
  set(checkingAtom, get(checkingAtom) - amount);
  set(savingsAtom, get(savingsAtom) + amount);
});

// In a component
const send = useSetAtom(transferAtom);
send(50);
```

```ts title="Recoil"
import { useRecoilCallback } from 'recoil';

// In a component
const send = useRecoilCallback(({ set }) => (amount: number) => {
  set(checkingState, value => value - amount);
  set(savingsState, value => value + amount);
});
send(50);
```

:::

An atemno action is a plain function of a context and an argument, so it can be called outside React with `domain.getAction(transfer)` too. A Jotai write atom lives in the store like any other atom. Recoil's callback is created inside a component.

## Lifetime

This is the one real behavioural difference, and the sharpest edge. atemno releases a node once nothing tracks it, so unmounting the last component reading an atom discards its state. Jotai and Recoil keep state for as long as the store or root lives. In atemno, hold a subscription to keep a source alive. See [node lifetime](./node-lifetime.md).

:::code-group

```ts title="atemno"
import { ReactiveDomain, atom } from 'atemno';

const count = atom('count', 0);
const domain = new ReactiveDomain({});

const stop = domain.observe(count, () => {});
domain.set(count, 5);
// Kept: the observer tracks it.
stop();
domain.get(count); // 0, released with its last tracker
```

```ts title="Jotai"
import { atom, createStore } from 'jotai';

const countAtom = atom(0);
const store = createStore();

const stop = store.sub(countAtom, () => {});
store.set(countAtom, 5);
stop();
store.get(countAtom); // 5, the store keeps it
```

:::

## Beyond React

The atemno core has no React in it. Every demo on this site uses no framework at all, just [one subscription writing to the DOM](./other-frameworks.md). Jotai's store also works on its own, through `get`, `set` and `sub`, as the lifetime example shows. Recoil has no supported way to read or write state outside a `RecoilRoot`.

## When to pick the others

Pick Jotai. It is stable, it has a large community, and its async support has been used in production for years. atemno's resources are new, and atemno has not had a release.

Recoil is worth reading for its ideas, but it is no longer under active development, so it is not where new work should start.
