---
title: Devtools graph
description: Set devtools on AtemnoDomain and every live node shows up in React DevTools with its name and value.
---

## Turning it on

```tsx
<AtemnoDomain devtools={import.meta.env.DEV}>
  <App />
</AtemnoDomain>
```

`AtemnoDomain` then renders one element per live node. The elements draw nothing. They exist so the state shows up in React DevTools as `Atom`, `LazyAtom`, `Computed`, `ProxyAtom` and `Resource` entries, with each node's name and value on its props.

It is off by default, because it rerenders on every write.

## What it reads

The graph comes from the domain's `onCreate`, `onUpdate` and `onDestroy` hooks. That is why only a domain built by `AtemnoDomain` can show it: a domain's options are fixed when it is constructed.

- The snapshot is taken outside the render phase, so drawing it never changes the graph.
- It only reads nodes the domain still holds, so it never brings a released node back.
- A stale computed recomputes a little earlier than it would have.
- A computed that throws is reported as failed instead of rethrown.
- A resource waiting on its promise, and a computed waiting on one, is reported as pending, with no value.

## Your own inspector

`useAtemnoGraph` returns the same snapshot as an array.

```tsx
function Inspector() {
  return (
    <ul>
      {useAtemnoGraph().map(node => (
        <li key={`${node.kind}:${node.name}`}>
          {node.kind} {node.name}:{' '}
          {node.pending
            ? 'pending'
            : node.failed
              ? 'error'
              : String(node.value)}
        </li>
      ))}
    </ul>
  );
}
```
