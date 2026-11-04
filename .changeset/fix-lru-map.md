---
'atemno': patch
---

Fix the cache that `atomFactory` and `computedFactory` use to keep instances. A read now makes an entry the most recent, instead of moving it up one place, so the least recently used instance is the one evicted.
