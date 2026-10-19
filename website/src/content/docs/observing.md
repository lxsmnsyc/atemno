---
title: Observing
description: observe subscribes to a source and calls back on every change after it. Observing also keeps a source up to date as it changes.
---

## Subscribing

```ts
const stop = domain.observe(message, value => {
  console.log('Message:', value);
});

domain.set(message, 'whut?'); // logs "Message: whut?"

stop();
```

`observe` returns a function that ends the subscription.

## Subscribing does not call back

The callback only runs on changes after you subscribe. Read the current value yourself if you need it now.

```ts
const current = domain.get(message);
const stop = domain.observe(message, onChange);
```

This is deliberate. It is the same split as `getSnapshot` and `subscribe` in React's `useSyncExternalStore`, and the [React binding](./react.md) relies on it.

## Observing makes a computed eager

An unobserved computed waits to be read. An observed one is brought up to date during the write that made it stale, because its observer needs the new value. See [propagation](./propagation.md) for both paths side by side.

## Errors in callbacks

An error thrown inside a callback goes to the domain's `onError`. Without `onError`, it is rethrown from the `set` that triggered it.

```ts
const domain = new ReactiveDomain({
  onError(error) {
    report(error);
  },
});
```

## Weak observers

`observeWeak` subscribes like `observe`, without keeping anything alive. The source is released once nothing else tracks it, as if the weak observer were not there, and the weak observer ends with it. Unsubscribing a weak observer never releases anything.

```ts
const stop = domain.observeWeak(cart, value => log('cart', value));
```

Use it to watch state that other parts of the program own, such as logging, analytics or an inspector, without changing what stays in memory.

## Pending resources

An observer of a [resource](./resources.md), or of a computed reading one, is not called while the resource is pending. It is called once the resource settles.

## Unsubscribing can release nodes

When the last subscription to a source ends and nothing else tracks it, the domain releases the node, and anything only it was reading. See [node lifetime](./node-lifetime.md).
