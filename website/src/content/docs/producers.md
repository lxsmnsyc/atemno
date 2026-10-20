---
title: Producers
description: A producer is a read-only source fed from outside the domain, such as a timer, an event or a socket. It subscribes while something tracks it and stops once it is released.
---

## Creating one

```ts
import { producer } from 'atemno';

const width = producer('width', 0, set => {
  const update = () => set(window.innerWidth);
  update();
  window.addEventListener('resize', update);
  return () => window.removeEventListener('resize', update);
});
```

`producer(name, initialValue, setup, isEqual?)` takes the value it holds until `setup` sets one, and a `setup` function that starts the feed.

- `setup` receives `set`, which writes a new value, and `get`, which returns the current one.
- It returns a function that stops the feed.
- A value set while `setup` runs becomes the starting value, before anything reads it.

:::demo clock
The clock only ticks while it is observed. Stop observing and the interval is cleared. Start again and it begins from 0.
:::

## Started by tracking

A producer starts when the first computed or observer tracks it. That is the same moment its node would start being kept alive. It stops when the node is released, which happens once nothing tracks it, and when the domain is destroyed.

- Reading it with `domain.get` does not start it. You get its latest value, or the initial one.
- A [weak observer](./observing.md#weak-observers) does not start it either, since it does not keep the node alive.
- Once released, its value is gone. The next time it is tracked, it starts again from `initialValue`.

## Read-only

A producer has no `domain.set`. Only its own `set` writes it. `domain.reset` puts it back to `initialValue`, and the feed can then write over that.

## Errors

An error thrown by `setup` or by the stop function goes to the domain's `onError`.
