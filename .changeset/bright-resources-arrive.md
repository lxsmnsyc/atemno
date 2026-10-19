---
'atemno': minor
---

Add `proxy`, `resource` and `observeWeak`.

- `proxy(name, { get, set })` describes a writable derived value. It reads like a computed, and a write runs `set`, which passes the value on to other sources.
- `resource(name, compute)` describes a computed whose computation can return a promise. Reading it while pending throws a `ResourceNotReadyError` carrying the promise. Only the latest run's result is kept. `toResult`, `isPending`, `waitForNone`, `waitForAll`, `waitForAny` and `waitForRace` combine reads that may be pending.
- `domain.observeWeak(source, callback)` subscribes without keeping the source alive.
- In `atemno/react`, `useComputedValue` accepts proxy atoms and resources and suspends while a resource is pending. The atom hooks accept proxy atoms. The devtools graph lists `ProxyAtom` and `Resource` nodes and reports pending ones.

Computations now track only the reads made before they return. A read after an `await` used to be tracked late, which could release and rebuild the atom it read.

Destroying a node now ends the observers watching it.
