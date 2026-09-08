# Documentation

## Features

## Introduction

## Core Concepts

### Atoms

Atoms represent the simplest form of state in Atemno. An atom can hold a single value, can be written to and can be observed.

```js
import { atom } from 'atemno';

const message = atom(
  // A unique identifier for this atom
  'message',
  // The initial state of the atom
  'Hello, World!',
);
```

### `ReactiveDomain`

The key feature of Atemno is that creating atoms are merely a description of the actual state: the atoms aren't functional and describes what the state would be when evaluated.

The `ReactiveDomain` class is what gives the atoms life.

An instance of `ReactiveDomain` can accept an atom and create a state described by it.

```js
import { ReactiveDomain } from 'atemno';

const domain = new ReactiveDomain({
  onError(error) {
    console.error(error);
  },
});

const actualState = domain.get(message); // Atom is initialized

console.log(actualState); // "Hello, World!"
```

#### Updating an atom

```js
domain.set(message, 'foo, bar!');

console.log(domain.get(message)); // foo, bar!
```

#### Observing changes

```js
const cleanup = domain.observe(message, value => {
  console.log('Message:', value); // Message: foo, bar!
});

domain.set(message, 'whut?'); // logs "Message: whut?"

cleanup();
```

### Lazy atoms

`atom` requires the initial state to be evaluated immediately, but there are scenarios where this can be unideal e.g. working with isomorphic environments, accessing values that are limited to the client, etc.

`lazyAtom` is similar to `atom` except that it accepts a function that produces the initial value.

```js
import { lazyAtom } from 'atemno';

const theme = lazyAtom(
  // A unique identifier for this atom
  'theme',
  // The initial state of the atom
  () => localStorage.getItem('theme'),
);
```

The function is called when the state is first accessed and therefore initialized.

### Computeds

#### Async computeds

### Actions

## Bindings

### React

### SolidJS
