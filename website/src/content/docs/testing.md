---
title: Testing
description: There is no global store, so a test only needs a domain of its own.
---

## A domain per test

```ts
import { afterEach, expect, it } from 'vitest';

let domain: ReactiveDomain;

beforeEach(() => {
  domain = new ReactiveDomain({});
});

afterEach(() => {
  domain.destroy();
});

it('doubles', () => {
  domain.set(count, 4);
  expect(domain.get(double)).toBe(8);
});
```

Atoms and computeds can stay at module level. They hold no state, so nothing leaks from one test into the next.

## Counting runs

Laziness is easy to assert. Count inside the computation.

```ts
let runs = 0;
const double = computed<number>('double', $ => {
  runs++;
  return $.get(count) * 2;
});

domain.set(count, 1);
domain.set(count, 2);
domain.get(double);

expect(runs).toBe(1);
```

## Lifecycle hooks

Pass `onCreate` and `onDestroy` to assert what a domain created and released.

```ts
const destroyed: string[] = [];
const domain = new ReactiveDomain({
  onDestroy: source => destroyed.push(source.name),
});
```

## React

Render the component inside `AtemnoDomain`. Use `initialize` to write the starting state, and to keep the domain so the test can assert on it.

```tsx
let domain: ReactiveDomain | undefined;

render(
  <AtemnoDomain
    initialize={created => {
      created.set(count, 3);
      domain = created;
    }}
  >
    <Counter />
  </AtemnoDomain>,
);

expect(domain?.get(count)).toBe(3);
```
