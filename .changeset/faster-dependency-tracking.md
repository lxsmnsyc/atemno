---
'atemno': patch
---

Recomputing a computed and updating an observer allocate less. A computed reading 100 atoms updates about 2.4x faster, and 500 observers on one atom update about 2.2x faster.
