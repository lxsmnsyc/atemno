---
title: Server rendering
description: Give every request its own domain. atemno does not move state from server to client, so seed the client with the same values.
---

## One domain per request

A module-level atom is only a description, so it is safe to share across requests. The domain is what must not be shared.

```tsx
export function handle(request: Request) {
  const current = readUser(request);

  return renderToString(
    <AtemnoDomain initialize={domain => domain.set(user, current)}>
      <App />
    </AtemnoDomain>,
  );
}
```

`AtemnoDomain` builds a new domain each time it mounts, so every request gets its own. `initialize` runs once, before anything below renders.

## Browser-only values

Use a [lazy atom](./lazy-atoms.md) for anything that only exists in a browser. Its function runs when a domain first needs it, so importing the module on a server is safe.

## Hydration

atemno does not serialize a domain. The client builds its own domain, which starts every atom at its initial value. If the server wrote to an atom, write the same value on the client before hydrating, or the first client render will disagree with the HTML.

```tsx
hydrateRoot(
  document,
  <AtemnoDomain initialize={domain => domain.set(user, window.__USER__)}>
    <App />
  </AtemnoDomain>,
);
```
