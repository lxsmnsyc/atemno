---
title: Resources
description: A resource is a computed whose computation can return a promise. Reading it while the promise is pending throws a ResourceNotReadyError, so a caller can wait or show something else.
---

## Creating one

```ts
import { atom, resource } from 'atemno';

const userId = atom('userId', 1);

const user = resource<User>('user', async $ => {
  const response = await fetch(`/api/users/${$.get(userId)}`);
  return response.json();
});
```

A resource is lazy and cached like a [computed](./computeds.md). It runs on the first read, and again on the next read after a dependency changes. If something observes it, it reruns during the write instead.

:::demo user-loader
Larger ids answer sooner, so stepping quickly makes an old request finish after a newer one. Its result is dropped. User 4 does not exist, so its request rejects.
:::

## Reading one

Reading a resource has three outcomes.

- While the promise is pending, it throws a `ResourceNotReadyError`. Its `request` property is the promise, so the caller can wait for it.
- Once the promise resolves, it returns the value.
- Once the promise rejects, it rethrows the reason on every read, until a dependency changes and it runs again.

A computation that returns a plain value instead of a promise resolves at once.

```ts
import { ResourceNotReadyError } from 'atemno';

try {
  render(domain.get(user));
} catch (error) {
  if (error instanceof ResourceNotReadyError) {
    showSpinner();
    error.request.then(() => render(domain.get(user)));
  } else {
    throw error;
  }
}
```

`domain.get(toResult(user))` does the same without the `try`. It is described below.

## Only reads before the first await are tracked

A resource records the dependencies it reads while its computation runs synchronously, up to the first `await`. Reads after that still return the current value, but they are not dependencies, so changing them does not rerun the resource.

```ts
const user = resource<User>('user', async $ => {
  const id = $.get(userId); // tracked
  const response = await fetch(`/api/users/${id}`);
  const token = $.get(session); // read, not tracked
  return parse(response, token);
});
```

Read everything the request depends on first. This applies to plain computeds too, which should not be `async` at all.

## The latest run wins

Each run replaces the one before it. When an older request settles after a newer one started, its result is dropped. Use `onCleanup` to cancel the request as well, which runs before the next run and when the node is released.

```ts
const user = resource<User>('user', async $ => {
  const controller = new AbortController();
  $.onCleanup(() => controller.abort());
  const response = await fetch(`/api/users/${$.get(userId)}`, {
    signal: controller.signal,
  });
  return response.json();
});
```

## Refetching

`domain.reset(user)` runs a resource again without changing anything it reads. If something observes it, the new request starts straight away. In React, `useResetSource(user)` returns a callback that does the same.

```tsx
function Reload() {
  const reload = useResetSource(user);
  return <button onClick={reload}>Reload</button>;
}
```

## Downstream of a resource

A computed that reads a pending resource throws the same `ResourceNotReadyError`, and so does anything reading that computed. When the resource settles, they rerun like after any other change.

An observer is not called while its source is pending, and pending is not an error, so `onError` does not hear about it. The observer is called once the resource settles. A rejection goes to `onError` like any other error from a read.

To show every state, loading included, observe `toResult(user)` instead. It changes on each step, so its observer is called for all of them. The demo above does this.

```ts
domain.observe(toResult(user), result => render(result));
```

## Waiting on several

The helpers take sources and return a computed, which you read like any other: `$.get`, `domain.get` or `useComputedValue`.

| Helper                 | Holds                                          | Pending while                    | Throws                                  |
| ---------------------- | ---------------------------------------------- | -------------------------------- | --------------------------------------- |
| `toResult(source)`     | `{ type, value }` or `{ type, request }`       | never, it reports it             | never                                   |
| `isPending(source)`    | whether the source is pending                  | never, it reports it             | never                                   |
| `waitForNone(sources)` | one result per source                          | never, it reports it             | never                                   |
| `waitForAll(sources)`  | every value                                    | any is pending                   | an `AggregateError` if any failed       |
| `waitForAny(sources)`  | the first value, in list order, that resolved  | none resolved and any is pending | an `AggregateError` if all failed       |
| `waitForRace(sources)` | the first outcome, in list order, that settled | all are pending                  | the error, if that outcome is a failure |

```ts
import { computed, waitForAll } from 'atemno';

const profile = computed<string>('profile', $ => {
  const [owner, prefs] = $.get(waitForAll([account, settings]));
  return `${owner.name} (${prefs.theme})`;
});
```

Each call with the same sources returns the same description, named after them, such as `waitForAll(resource:account, resource:settings)`. That keeps it cheap to call during render and readable in the devtools graph.

## In React

`useComputedValue` suspends while a resource is pending, so the nearest `Suspense` boundary shows its fallback, and a rejection goes to the nearest error boundary. See [React hooks](./react-hooks.md#resources-and-suspense).
