---
'atemno': minor
---

Raise the minimum Node version to 20. It claimed to support Node 10, which has
been out of support since 2019 and cannot load the package at all, because the
build is ESM only.

The compiled output now targets Node 20 rather than Node 10, so it ships less
downleveled syntax and is a little smaller.
