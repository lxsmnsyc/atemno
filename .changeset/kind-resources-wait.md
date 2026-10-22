---
'atemno': minor
---

Add `keepPrevious` to resources, and `isRefreshing`.

- `resource(name, compute, { keepPrevious: true })` keeps returning the last resolved value while a rerun is pending, instead of throwing a `ResourceNotReadyError`. In React, the component keeps its content instead of falling back to `Suspense`.
- `isRefreshing(source)` is a computed that is true while such a rerun is in flight.
- The third argument of `resource` still accepts an equality check, or an options object with `isEqual` and `keepPrevious`.
