---
'atemno': minor
---

Add the React binding at `atemno/react`. It needs React 18 or newer.

`AtemnoDomain` builds a domain and supplies it to the tree. It takes the same
options as the `ReactiveDomain` constructor, and the domain survives rerenders,
so inline handlers are fine.

```jsx
<AtemnoDomain onError={error => console.error(error)}>
  <App />
</AtemnoDomain>
```

Set `devtools` to render the domain's graph as elements. They draw nothing. They
exist so the reactive state shows up as `Atom`, `LazyAtom` and `Computed`
entries in the React developer tools, with each node's name and value on its
props. `useAtemnoGraph` returns the same snapshot as an array, for building an
inspector of your own.

`AtemnoProvider` supplies a domain you built yourself. Both components nest, and
hooks use the nearest one.

These hooks read and write state:

- `useAtomValue` reads an atom or a lazy atom.
- `useComputedValue` reads a computed.
- `useSetAtom` returns a setter without subscribing, so a component that only
  writes does not rerender.
- `useAtomState` returns a value and a setter, in the shape of `useState`.
- `useResetSource` resets a source.
- `useAction` binds an action to the nearest domain.
- `useAtemnoDomain` returns the domain itself.

Reads go through `useSyncExternalStore`, so server rendering works and
concurrent rendering cannot tear.

Note that a domain releases a node once nothing tracks it, and each reading
component is the only tracker it has. Unmounting the last reader of a source
discards its state. Keep a source alive by reading it somewhere that outlives
the components that come and go, or by holding a subscription yourself.
