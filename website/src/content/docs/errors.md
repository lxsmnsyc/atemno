---
title: Errors
description: A computed that throws stores the error and rethrows it on every read, until a dependency changes and it succeeds. Observer errors go to onError.
---

## Thrown in a computed

The error is stored as the computed's result. Every read rethrows it. Reads do not rerun the computation, because nothing it read has changed.

```ts
const text = atom('text', '{ "ok": true }');
const parsed = computed<unknown>('parsed', $ => JSON.parse($.get(text)));

domain.set(text, '{ nope');
domain.get(parsed); // throws
domain.get(parsed); // throws the same error

domain.set(text, '{ "ok": false }');
domain.get(parsed); // { ok: false }
```

:::demo errors
Break the JSON and read. Fix it and read again.
:::

## Thrown in an observer

An error thrown by an observer callback goes to the domain's `onError`. Without one, it is rethrown from the `set` that triggered the observer. The other observers of that write still run first, and only the first error is rethrown.

```ts
const domain = new ReactiveDomain({
  onError(error) {
    report(error);
  },
});
```

## Thrown in an action

An [action](./actions.md) is a plain function call, so its errors reach the caller as usual. Writes it made before throwing stay made.
