---
'atemno': minor
---

Add `domain.batch`, `producer`, `$.peek` and per-observer `onError`.

- `domain.batch(callback)` holds observers back until the callback returns, so they see the end result once. Actions and writes to proxy atoms now run in a batch.
- An observer is no longer called with a value equal to the last one it saw.
- `producer(name, initialValue, setup)` describes a read-only value fed from outside the domain. `setup` starts when something first tracks it, and its cleanup runs when the node is released.
- `$.peek(source)` reads a source inside a computation without making it a dependency.
- `observe` and `observeWeak` take `{ onError }` to handle one observer's errors.
- `AtemnoDomain` takes an `initialize` callback that receives the new domain before anything renders.

Breaking: `AtemnoProvider` is no longer exported. Use `AtemnoDomain` with `initialize` to set the starting state.
