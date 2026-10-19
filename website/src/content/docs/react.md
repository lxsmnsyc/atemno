---
title: React
description: atemno/react supplies a domain to a component tree and reads sources through useSyncExternalStore. It needs React 18 or newer.
---

## Supplying a domain

`AtemnoDomain` builds a domain and supplies it to everything below it. It takes the same options as the `ReactiveDomain` constructor.

```tsx
import { AtemnoDomain } from 'atemno/react';

function App() {
  return (
    <AtemnoDomain onError={error => console.error(error)}>
      <Counter />
    </AtemnoDomain>
  );
}
```

The domain is built once and kept for the life of the component, so inline handlers are fine. The latest handlers are always the ones called.

It is not destroyed on unmount. Unmounting drops every subscription the tree held, the domain releases its nodes in turn, and the domain becomes garbage. Destroying it would break `StrictMode`, which remounts a component with the same state.

## Bringing your own domain

`AtemnoProvider` supplies a domain you built yourself, for example one per request on a server.

```tsx
import { AtemnoProvider } from 'atemno/react';

const domain = new ReactiveDomain({});

<AtemnoProvider domain={domain}>
  <App />
</AtemnoProvider>;
```

Both components nest. Hooks use the nearest one, so a subtree can run against its own isolated state.

## Reading

```tsx
import { useAtomState, useComputedValue } from 'atemno/react';

function Counter() {
  const [value, setValue] = useAtomState(count);
  const doubled = useComputedValue(double);

  return (
    <button onClick={() => setValue(v => v + 1)}>
      {value} doubled is {doubled}
    </button>
  );
}
```

Reads go through `useSyncExternalStore`, so server rendering works and concurrent rendering cannot tear. [Hooks](./react-hooks.md) lists them all.

## State and unmounting

A domain releases a node once nothing tracks it. If the only component reading an atom unmounts, the atom's state goes with it. See [node lifetime](./node-lifetime.md) for how to keep it.
