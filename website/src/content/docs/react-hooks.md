---
title: React hooks
description: Hooks for reading atoms and computeds, writing atoms, resetting sources and binding actions, all against the nearest domain.
---

## Reading

| Hook                         | Returns                                                |
| ---------------------------- | ------------------------------------------------------ |
| `useAtomValue(atom)`         | The value of an atom or lazy atom.                     |
| `useComputedValue(computed)` | The value of a computed, evaluating it if nothing has. |
| `useAtomState(atom)`         | `[value, setter]`, like `useState`.                    |

Each rerenders the component when the value changes, including changes made outside React.

## Writing

```tsx
function Reset() {
  const setCount = useSetAtom(count);
  return <button onClick={() => setCount(0)}>reset</button>;
}
```

`useSetAtom` returns only a setter. A component that writes but never reads does not subscribe, so it does not rerender when the atom changes.

A setter takes a value or a function of the current value. An atom whose value is itself a function must be written with a function that returns it.

## Resetting and actions

```tsx
const resetCount = useResetSource(count);
const bump = useAction(increment);
```

`useResetSource` restores any source to its initial state, and forces a computed to rerun. `useAction` binds an action to the nearest domain, and the callback stays stable while the domain and the action do.

## The domain itself

`useAtemnoDomain()` returns the nearest domain, for anything the hooks do not cover. It throws if there is no `AtemnoDomain` or `AtemnoProvider` above it.
