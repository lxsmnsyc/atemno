---
'atemno': minor
---

`reset` on a computed, proxy atom or resource now marks it stale instead of running it straight away. It reruns at once if something observes it, and otherwise on its next read. Readers are updated through the usual propagation, so a rerun that gives an equal value notifies no one. Resetting a source the domain has not evaluated yet does nothing. Use it to refetch a resource, or to recompute a value that reads something atemno does not track.
