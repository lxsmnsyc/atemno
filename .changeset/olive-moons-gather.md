---
'atemno': minor
---

The package entry point is now `atemno` instead of `atemno/core`.

```js
import { atom, computed, ReactiveDomain } from 'atemno';
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
