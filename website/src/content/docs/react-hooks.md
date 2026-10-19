---
title: React hooks
description: Hooks for reading atoms and computeds, writing atoms, resetting sources and binding actions, all against the nearest domain.
---

## Reading

| Hook                       | Returns                                          |
| -------------------------- | ------------------------------------------------ |
| `useAtomValue(atom)`       | The value of an atom or lazy atom.               |
| `useComputedValue(source)` | The value of a computed, proxy atom or resource. |
| `useAtomState(atom)`       | `[value, setter]`, like `useState`.              |

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

## Resources and Suspense

`useComputedValue` suspends while a [resource](./resources.md) is pending, and so does reading a computed that depends on one. The nearest `Suspense` boundary shows its fallback until the resource settles. A rejection is thrown during render, so it reaches the nearest error boundary.

```tsx
function Profile() {
  const name = useComputedValue(user);
  return <h1>{name}</h1>;
}

<ErrorBoundary fallback={<p>Could not load the user.</p>}>
  <Suspense fallback={<Spinner />}>
    <Profile />
  </Suspense>
</ErrorBoundary>;
```

When a dependency changes, the resource runs again and the component suspends again. React 19 waits on the request with `use`. React 18 waits on the thrown promise.

## Proxy atoms

The atom hooks accept [proxy atoms](./proxy-atoms.md), since a proxy atom is writable. `useAtomState(fahrenheit)` returns the derived value and a setter that writes through the proxy.

## The domain itself

`useAtemnoDomain()` returns the nearest domain, for anything the hooks do not cover. It throws if there is no `AtemnoDomain` or `AtemnoProvider` above it.
