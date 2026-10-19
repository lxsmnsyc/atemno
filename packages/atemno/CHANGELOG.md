# atemno

## 0.1.0

### Minor Changes

- d9b9810: Add `proxy`, `resource` and `observeWeak`.

  - `proxy(name, { get, set })` describes a writable derived value. It reads like a computed, and a write runs `set`, which passes the value on to other sources.
  - `resource(name, compute)` describes a computed whose computation can return a promise. Reading it while pending throws a `ResourceNotReadyError` carrying the promise. Only the latest run's result is kept. `toResult`, `isPending`, `waitForNone`, `waitForAll`, `waitForAny` and `waitForRace` take sources, such as `waitForAll([user, settings])`, and return a computed to read like any other source.
  - `domain.observeWeak(source, callback)` subscribes without keeping the source alive.
  - In `atemno/react`, `useComputedValue` accepts proxy atoms and resources and suspends while a resource is pending. The atom hooks accept proxy atoms. The devtools graph lists `ProxyAtom` and `Resource` nodes and reports pending ones.

  Computations now track only the reads made before they return. A read after an `await` used to be tracked late, which could release and rebuild the atom it read.

  Destroying a node now ends the observers watching it.

- 1e40a9f: Raise the minimum Node version to 20. It claimed to support Node 10, which has
  been out of support since 2019 and cannot load the package at all, because the
  build is ESM only.

  The compiled output now targets Node 20 rather than Node 10, so it ships less
  downleveled syntax and is a little smaller.

- b4b433b: The package entry point is now `atemno` instead of `atemno/core`.

  ```js
  import { atom, computed, ReactiveDomain } from "atemno";
  ```

  Type declarations now resolve. The `types` field pointed at
  `./dist/types/index.d.ts`, which the build never emitted, so TypeScript
  consumers got no types from either the root or the subpath exports.

  `lazyAtom` is now exported. It was implemented and documented but never
  reachable from the entry point. These types are exported too: `Action`,
  `ActionContext`, `LazyAtom`, `NormalAction`, `ReactiveDomainOptions`,
  `ReadableSource`, `Ref`, and `WritableSource`.

  `observe` now accepts lazy atoms. It previously accepted only atoms and
  computeds.

  `observe` no longer calls the callback when you subscribe. It used to fire
  immediately if the subscription happened to trigger a computed's first
  evaluation, and stay silent otherwise. Read the current value with `domain.get`
  if you need it up front.

  ```js
  const value = domain.get(message);
  const stop = domain.observe(message, onChange);
  ```

  `destroyLazyAtom` now releases the node. It deleted from the wrong map, so a
  destroyed lazy atom kept its old value instead of rerunning its factory.

  `destroy` now tears down lazy atoms along with atoms and computeds.

- 1e40a9f: Add the React binding at `atemno/react`. It needs React 18 or newer.

  `AtemnoDomain` builds a domain and supplies it to the tree. It takes the same
  options as the `ReactiveDomain` constructor, and the domain survives rerenders,
  so inline handlers are fine.

  ```jsx
  <AtemnoDomain onError={(error) => console.error(error)}>
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

### Patch Changes

- 2942b54: Run each computed once per write when it is observed through several paths. A write now marks every affected node before any observer runs, so in a diamond such as `a → {b, c} → d` the observed `d` recomputes once instead of once per path. Observers that throw no longer stop the other observers of the same write; the first error is rethrown after they have all run.
- 2545a9f: Fix computeds destroying the dependencies they are about to reuse.

  `updateComputed` released a computed's tracked dependencies before recomputing.
  When a dependency's only tracker was the computed itself, the auto-cleanup path
  destroyed that node, and the recomputation then recreated it from its initial
  value. A computed therefore reset its own dependencies on every update, so
  reads returned stale results and observers on computeds stopped firing.

  Dependency tracking is now track-then-prune. The computation runs against a
  fresh dependency set, and only the dependencies the new run did not track again
  are released afterwards. Auto-cleanup of genuinely unused nodes is unchanged.
