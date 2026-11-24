---
'atemno': patch
---

Recomputing a computed and notifying observers allocate less. A computed that reads 100 atoms updates about 1.8x faster, and 500 observed computeds on one atom update about 1.4x faster.
