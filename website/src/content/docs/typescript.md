---
title: TypeScript
description: atom infers its type. computed cannot, so pass the type argument.
---

## Atoms infer

```ts
const count = atom('count', 0); // Atom<number>
const theme = lazyAtom('theme', () => 'light'); // LazyAtom<string>
```

## Computeds need the type argument

```ts
const double = computed<number>('double', $ => $.get(count) * 2);
```

Without it a computed resolves to `Computed<unknown>`, and every read of it is `unknown`. The type parameter appears both in the callback's argument, through `$.previous`, and in its return type, so TypeScript cannot infer it from the body.

## Types

| Type                                    | Is                                      |
| --------------------------------------- | --------------------------------------- |
| `Atom<T>`, `LazyAtom<T>`, `Computed<T>` | The descriptions.                       |
| `ReadableSource<T>`                     | Any of the three.                       |
| `WritableSource<T>`                     | An atom or lazy atom.                   |
| `TrackerContext<T>`                     | The `$` a computed receives.            |
| `ActionContext`                         | The `$` an action receives.             |
| `Action<T, R>`, `NormalAction<T, R>`    | An action before and after binding.     |
| `IsEqual<T>`                            | An equality check.                      |
| `Ref<T>`                                | `{ value }`, the shape of `$.previous`. |
| `ReactiveDomainOptions`                 | What the domain constructor takes.      |
