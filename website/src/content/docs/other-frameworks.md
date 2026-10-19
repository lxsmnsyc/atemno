---
title: Other frameworks
description: The core has no framework in it. A binding is one subscription feeding one piece of local state.
---

## No framework at all

Every demo on this site is plain TypeScript. It reads a value, renders it, and subscribes to write the next one straight into the DOM.

```ts
const output = document.querySelector('output');

function render(value: number) {
  output.textContent = `Count: ${value}`;
}

render(domain.get(count));
const stop = domain.observe(count, render);
```

That is the whole contract a binding needs.

- **Read first.** Subscribing never delivers a value, so the first one comes from `domain.get`.
- **Subscribe for the rest.** The callback runs on every change after it.
- **Unsubscribe when done.** Call what `observe` returned.

## In a framework

A framework binding swaps `textContent` for the framework's own state. With any primitive that takes either a value or an updater function, store the value inside an object, so a source that holds a function is stored rather than called.

```ts
// The shape of a binding, in pseudocode for any framework.
const box = createState({ value: domain.get(source) });
const stop = domain.observe(source, next => box.set({ value: next }));
onDispose(stop);
```

[React](./react.md) is the binding that ships, and it is built on exactly this, through `useSyncExternalStore`.

## Lifetime

The subscription is what keeps the node alive. When it ends and nothing else tracks the node, the domain releases it. See [node lifetime](./node-lifetime.md).
