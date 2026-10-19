---
'atemno': patch
---

Run each computed once per write when it is observed through several paths. A write now marks every affected node before any observer runs, so in a diamond such as `a → {b, c} → d` the observed `d` recomputes once instead of once per path. Observers that throw no longer stop the other observers of the same write; the first error is rethrown after they have all run.
