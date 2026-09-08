---
'atemno': patch
---

Fix computeds destroying the dependencies they are about to reuse.

`updateComputed` released a computed's tracked dependencies before recomputing.
When a dependency's only tracker was the computed itself, the auto-cleanup path
destroyed that node, and the recomputation then recreated it from its initial
value. A computed therefore reset its own dependencies on every update, so
reads returned stale results and observers on computeds stopped firing.

Dependency tracking is now track-then-prune. The computation runs against a
fresh dependency set, and only the dependencies the new run did not track again
are released afterwards. Auto-cleanup of genuinely unused nodes is unchanged.
