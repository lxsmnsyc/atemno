# atemno

> A fine-grained reactive state management library

[![NPM](https://img.shields.io/npm/v/atemno.svg)](https://www.npmjs.com/package/atemno) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

## Install

```bash
npm install --save atemno
```

```bash
yarn add atemno
```

```bash
pnpm add atemno
```

## Features

- Atoms and computeds are plain descriptions of state. They hold no value on their own.
- Atoms can defer their initial value to first read, for state that only exists on the client.
- A `ReactiveDomain` owns the actual values. The same atom can hold different state in different domains.
- Computeds track their dependencies automatically, including dependencies that change between runs.
- Computeds are lazy. They recompute on read, not on write.
- Nodes are reference counted. A node is released once nothing tracks it any more.
- No global state, so tests and server rendering get an isolated domain each.
- A React binding that renders the graph into React DevTools when you want it.

## Quick start

```js
import { atom, computed, ReactiveDomain } from 'atemno';

const greeting = atom('greeting', 'Hello');
const receiver = atom('receiver', 'World');

const message = computed(
  'message',
  $ => `${$.get(greeting)}, ${$.get(receiver)}!`,
);

const domain = new ReactiveDomain({
  onError(error) {
    console.error(error);
  },
});

console.log(domain.get(message)); // "Hello, World!"

domain.observe(message, value => {
  console.log(value);
});

domain.set(greeting, 'Bonjour'); // logs "Bonjour, World!"
```

## Core concepts

### Atoms

An atom is the simplest unit of state. It holds one value, can be written to,
and can be observed.

```js
import { atom } from 'atemno';

const message = atom(
  // A unique identifier for this atom
  'message',
  // The initial state
  'Hello, World!',
);
```

Creating an atom does not create any state. It only describes state. The name
must be unique, because a domain looks nodes up by name.

### Lazy atoms

`atom` evaluates its initial value immediately. Use `lazyAtom` when that is not
safe or not cheap, such as reading from `localStorage` in code that also runs on
a server.

```js
import { lazyAtom } from 'atemno';

const theme = lazyAtom('theme', () => localStorage.getItem('theme'));
```

The function runs the first time a domain reads the atom, and once per domain.
`reset` runs it again. Lazy atoms behave like atoms otherwise. They can be
written to and observed.

### `ReactiveDomain`

A `ReactiveDomain` is what gives atoms life. It holds the values, runs the
computeds, and notifies the observers.

```js
import { ReactiveDomain } from 'atemno';

const domain = new ReactiveDomain({
  onError(error) {
    console.error(error);
  },
});

console.log(domain.get(message)); // "Hello, World!"
```

Two domains never share state.

```js
const a = new ReactiveDomain({});
const b = new ReactiveDomain({});

a.set(message, 'Only in a');

a.get(message); // "Only in a"
b.get(message); // "Hello, World!"
```

This makes domains a good fit for per-request state on a server and for test
isolation.

#### Writing and resetting

```js
domain.set(message, 'foo, bar!');
domain.get(message); // "foo, bar!"

domain.reset(message);
domain.get(message); // "Hello, World!"
```

Resetting a computed, proxy atom or resource makes it run again without any of
its dependencies changing, such as to refetch a resource. It reruns straight
away if something observes it, and otherwise on its next read.

A write that produces an equal value is ignored. Nothing recomputes and no
observer runs. Equality defaults to `Object.is` semantics, so `NaN` equals
itself. Pass your own check as the third argument.

```js
const point = atom('point', { x: 0 }, (prev, next) => prev.x === next.x);
```

#### Observing changes

```js
const stop = domain.observe(message, value => {
  console.log('Message:', value);
});

domain.set(message, 'whut?'); // logs "Message: whut?"

stop();
```

`observe` returns a cleanup function. Call it to stop listening.

Subscribing never calls the callback. It only runs on later changes. Read the
current value with `domain.get` if you need it up front.

```js
const value = domain.get(message);
const stop = domain.observe(message, onChange);
```

`observeWeak` subscribes the same way without keeping the source alive. The
source is released once nothing else tracks it, and the weak observer ends with
it. Removing a weak observer never releases anything.

Both take `{ onError }` as a third argument, to handle that observer's errors
instead of the domain's `onError`.

#### Batching writes

Wrap several writes in `domain.batch` so observers are called once, with the
end result. Reads inside the batch still see each write.

```js
domain.batch(() => {
  domain.set(first, 'Grace');
  domain.set(last, 'Hopper');
});
```

Actions and writes to proxy atoms run in a batch already.

### Computeds

A computed derives a value from other atoms and computeds. It receives a
tracker context, and every source read through that context becomes a
dependency.

```js
import { computed } from 'atemno';

const count = atom('count', 1);
const double = computed('double', $ => $.get(count) * 2);

domain.get(double); // 2

domain.set(count, 5);
domain.get(double); // 10
```

Computeds are lazy. Writing to `count` marks `double` as stale but does not run
it. It recomputes on the next read, or immediately if something observes it.

Computeds also cache. Reading twice without an intervening change runs the
computation once.

#### Dynamic dependencies

Dependencies are collected on every run, so a branch that is not taken is not
tracked.

```js
const toggle = atom('toggle', true);
const left = atom('left', 'left');
const right = atom('right', 'right');

const branch = computed('branch', $ =>
  $.get(toggle) ? $.get(left) : $.get(right),
);

domain.get(branch); // "left"

// `right` is untracked while the toggle is on, so this changes nothing.
domain.set(right, 'changed');
domain.get(branch); // "left"

domain.set(toggle, false);
domain.get(branch); // "changed"
```

#### The previous value

`$.previous` holds the result of the last successful run. It is `undefined` on
the first run.

```js
const total = computed('total', $ => {
  const next = $.get(count);
  return $.previous ? $.previous.value + next : next;
});
```

Use `$.peek(source)` to read a source without making it a dependency.

#### Cleanups

`$.onCleanup` registers work to run before the next recomputation.

```js
const interval = atom('interval', 1000);

const timer = computed('timer', $ => {
  const id = setInterval(tick, $.get(interval));
  $.onCleanup(() => clearInterval(id));
  return id;
});
```

#### Errors

An error thrown inside a computation is stored. Every read rethrows it until a
dependency changes and the computation succeeds.

```js
const guarded = computed('guarded', $ => {
  if ($.get(shouldFail)) {
    throw new Error('boom');
  }
  return 'ok';
});

domain.get(guarded); // throws "boom"

domain.set(shouldFail, false);
domain.get(guarded); // "ok"
```

Errors thrown inside an observer callback go to `onError` instead. Without an
`onError` handler they are rethrown to the caller that triggered the write.

### Proxy atoms

A proxy atom reads like a computed and writes like an atom. A write runs your
`set`, which passes the value on to the sources the proxy is derived from.

```js
import { proxy } from 'atemno';

const celsius = atom('celsius', 20);
const fahrenheit = proxy('fahrenheit', {
  get: $ => ($.get(celsius) * 9) / 5 + 32,
  set($, value) {
    $.set(celsius, ((value - 32) * 5) / 9);
  },
});

domain.get(fahrenheit); // 68
domain.set(fahrenheit, 212);
domain.get(celsius); // 100
```

A proxy atom stores nothing of its own, and it is accepted anywhere a writable
source is.

### Resources

A resource is a computed whose computation can return a promise. While the
promise is pending, reading it throws a `ResourceNotReadyError` whose `request`
is the promise. Once it settles, reading it returns the value or rethrows the
rejection.

```js
import { resource, toResult } from 'atemno';

const userId = atom('userId', 1);
const user = resource('user', async $ => {
  const response = await fetch(`/api/users/${$.get(userId)}`);
  return response.json();
});

domain.get(toResult(user)); // { type: 'pending', request }
```

Only the reads made before the first `await` are tracked. Each run replaces the
one before it, and the result of a replaced run is dropped. A computed reading a
pending resource is pending too, and observers are only called once it settles.

Pass `{ keepPrevious: true }` as the third argument to keep returning the last
resolved value while a rerun is pending. `isRefreshing(user)` is true meanwhile.

`toResult`, `isPending`, `waitForNone`, `waitForAll`, `waitForAny` and
`waitForRace` take sources and return a computed that combines them, read like
any other source:

```js
const [owner, prefs] = domain.get(waitForAll([account, settings]));
```

### Actions

An action groups reads and writes behind one function. It is a description
until a domain binds it, the same way an atom is.

```js
import { action } from 'atemno';

const increment = action(($, amount) => {
  $.set(count, $.get(count) + amount);
  return $.get(count);
});

const boundIncrement = domain.getAction(increment);

boundIncrement(5); // 5
boundIncrement(3); // 8
```

An action context has `get`, `set`, and `reset`. It cannot track dependencies
or register cleanups, because it is not reactive. An action runs in a batch, so
observers see its result once it returns.

### Producers

A producer is a read-only value fed from outside the domain. Its `setup` starts
when the first computed or observer tracks it, and the function it returns runs
once the node is released.

```js
import { producer } from 'atemno';

const width = producer('width', 0, set => {
  const update = () => set(window.innerWidth);
  update();
  window.addEventListener('resize', update);
  return () => window.removeEventListener('resize', update);
});
```

### Factories

Use a factory when you need one atom or computed per key, such as one entry per
record id. Instances are cached in an LRU map, so the same key returns the same
instance.

```js
import { atomFactory, computedFactory } from 'atemno';

const todo = atomFactory('todo', {
  key: id => `${id}`,
  value: id => ({ id, done: false }),
  // Maximum number of cached instances. Defaults to 100.
  limit: 50,
});

todo(1) === todo(1); // true
todo(1).name; // "todo/1"

const todoLabel = computedFactory('todoLabel', {
  key: id => `${id}`,
  computed: id => $ => ($.get(todo(id)).done ? 'done' : 'pending'),
});
```

Names are namespaced as `<factory name>/<key>`, so they stay unique. The cache
only holds descriptions. Once it is full, the least recently used description is
dropped, which forgets the object and not any state. A domain finds nodes by
name, so asking for that key again builds a new description with the same name,
and a domain that still holds the node returns its current value through it.

### Node lifecycle

A domain creates a node the first time it sees an atom or computed. It releases
that node once nothing tracks it any more, which happens when the last observer
that depended on it goes away.

```js
const hits = atom('hits', 0);

const stop = domain.observe(hits, log);
domain.set(hits, 9);

stop();

domain.get(hits); // 0, the node was released and rebuilt from the initial value
```

A node that nothing ever tracked is never released on its own. Reading and
writing an atom without observing it keeps its value for the life of the
domain.

Release nodes yourself with `domain.destroyAtom` and `domain.destroyComputed`.
Tear down the whole domain with `domain.destroy`. After that, reads and new
subscriptions throw, and writes are ignored.

Pass `onCreate`, `onUpdate`, and `onDestroy` to the domain to watch this happen.

```js
const domain = new ReactiveDomain({
  onCreate: source => console.log('create', source.name),
  onUpdate: source => console.log('update', source.name),
  onDestroy: source => console.log('destroy', source.name),
});
```

## TypeScript

`atom` infers its type from the initial value. `computed` cannot infer, because
the type parameter appears in both the callback's argument and its return type.
Pass it explicitly.

```ts
const count = atom('count', 0); // Atom<number>

const double = computed<number>('double', $ => $.get(count) * 2);
```

Without the type argument the computed resolves to `Computed<unknown>`, and
every read of it is `unknown`.

## API

| Export                                      | Description                                       |
| ------------------------------------------- | ------------------------------------------------- |
| `atom(name, initialValue, isEqual?)`        | Describes a writable value.                       |
| `lazyAtom(name, getInitialValue, isEqual?)` | Describes a writable value built on first read.   |
| `computed(name, compute, isEqual?)`         | Describes a value derived from other sources.     |
| `proxy(name, { get, set, isEqual? })`       | Describes a derived value that can be written.    |
| `resource(name, compute, options?)`         | Describes a derived value that can be async.      |
| `producer(name, initialValue, setup)`       | Describes a value fed from outside the domain.    |
| `ResourceNotReadyError`                     | Thrown when reading a pending resource.           |
| `toResult(source)`, `isPending(source)`     | Computeds describing a read, never throwing.      |
| `isRefreshing(source)`                      | Whether a `keepPrevious` resource is rerunning.   |
| `waitForNone`, `waitForAll`                 | Computeds combining several sources.              |
| `waitForAny`, `waitForRace`                 | Computeds taking the first of several sources.    |
| `action(callback)`                          | Describes a set of reads and writes.              |
| `atomFactory(name, options)`                | Builds a cached atom per key.                     |
| `computedFactory(name, options)`            | Builds a cached computed per key.                 |
| `ReactiveDomain(options)`                   | Holds the state for a set of atoms and computeds. |

`ReactiveDomain` methods:

| Method                      | Description                                                      |
| --------------------------- | ---------------------------------------------------------------- |
| `get(source)`               | Reads any source, initializing it if needed.                     |
| `set(source, value)`        | Writes an atom or lazy atom, or passes a value to a proxy atom.  |
| `reset(source)`             | Restores an atom's initial value, or makes a computed run again. |
| `observe(source, callback)` | Subscribes to changes. Returns a cleanup function.               |
| `observeWeak(source, cb)`   | Subscribes without keeping the source alive.                     |
| `batch(callback)`           | Holds observers back until the callback returns.                 |
| `getAction(action)`         | Binds an action to this domain.                                  |
| `destroyAtom(source)`       | Releases one atom's node.                                        |
| `destroyLazyAtom(source)`   | Releases one lazy atom's node.                                   |
| `destroyComputed(source)`   | Releases one computed's, proxy atom's or resource's node.        |
| `destroy()`                 | Tears down the domain.                                           |

## React

`atemno/react` needs React 18 or newer, for `useSyncExternalStore`.

### Setting up a domain

`AtemnoDomain` builds a domain and supplies it to the tree. It takes the same
options as the `ReactiveDomain` constructor.

```jsx
import { AtemnoDomain } from 'atemno/react';

function App() {
  return (
    <AtemnoDomain onError={error => console.error(error)}>
      <Counter />
    </AtemnoDomain>
  );
}
```

The domain is built once and kept for the life of the component, so inline
handlers are fine. The latest ones are always the ones called.

It is not destroyed on unmount. Unmounting releases every subscription the tree
held, the domain releases its nodes in turn, and the domain becomes garbage.

Pass `initialize` to write the starting state. It receives the new domain once,
before anything below renders, which suits data the server loaded for this
request. `AtemnoDomain` nests, and hooks use the nearest one, so a subtree can
run against its own isolated state.

```jsx
<AtemnoDomain initialize={domain => domain.set(user, currentUser)}>
  <App />
</AtemnoDomain>
```

### Reading and writing

```jsx
import { useAtomState, useAtomValue, useComputedValue } from 'atemno/react';

const count = atom('count', 0);
const double = computed('double', $ => $.get(count) * 2);

function Counter() {
  const [value, setValue] = useAtomState(count);
  const doubled = useComputedValue(double);

  return (
    <button type="button" onClick={() => setValue(v => v + 1)}>
      {value} doubled is {doubled}
    </button>
  );
}
```

`useAtomValue` reads an atom or a lazy atom. `useComputedValue` reads a computed
and evaluates it if nothing has yet. Both rerender on change, including changes
made outside React.

`useSetAtom` returns only a setter. A component that writes but never reads does
not subscribe, so it does not rerender when the atom changes.

```jsx
function Reset() {
  const setCount = useSetAtom(count);
  return (
    <button type="button" onClick={() => setCount(0)}>
      reset
    </button>
  );
}
```

Setters take a value or a function of the current value, like `useState`. An
atom whose type is itself a function has to be written with a function
returning it.

`useResetSource` restores any source to its initial state. `useAction` binds an
action to the nearest domain.

```jsx
const bump = action(($, by) => {
  $.set(count, $.get(count) + by);
});

function Bump() {
  const run = useAction(bump);
  return (
    <button type="button" onClick={() => run(5)}>
      +5
    </button>
  );
}
```

### Node lifetime

A domain releases a node once nothing tracks it, and each reading component is
the only tracker it has. Unmounting the last reader of a source therefore
discards its state, and the next read starts from the initial value. State
survives for as long as at least one reader stays mounted.

Keep a source alive across unmounts by reading it somewhere that outlives the
components that come and go, or by holding a subscription yourself.

```js
const stop = domain.observe(count, () => {});
```

### Seeing the graph in React DevTools

Set `devtools` on `AtemnoDomain` to render one element per live node. The
elements draw nothing. They exist so the reactive state shows up as `Atom`,
`LazyAtom` and `Computed` entries in the React developer tools, with each node's
name and value on its props.

```jsx
<AtemnoDomain devtools={import.meta.env.DEV}>
  <App />
</AtemnoDomain>
```

It is off by default, because it rerenders on every write. Reading the graph
happens outside the render phase, so it never revives a released node, though a
stale computed does recompute a little earlier than it otherwise would. A
computed that throws is reported rather than rethrown.

`useAtemnoGraph` returns the same snapshot as a plain array, for building an
inspector of your own.

```jsx
function Inspector() {
  return (
    <ul>
      {useAtemnoGraph().map(node => (
        <li key={node.name}>
          {node.kind} {node.name}: {node.failed ? 'error' : String(node.value)}
        </li>
      ))}
    </ul>
  );
}
```

### Example

A Vite app covering all of the above lives in `examples/react`. Build the
library first, because the example resolves the published entry points.

```bash
pnpm install
pnpm run build
pnpm --filter atemno-example-react run dev
```

### React API

| Export                     | Description                                            |
| -------------------------- | ------------------------------------------------------ |
| `AtemnoDomain`             | Builds a domain, supplies it, and tracks its graph.    |
| `AtemnoGraph`              | Renders the graph as elements for the developer tools. |
| `useAtemnoDomain()`        | Returns the nearest domain.                            |
| `useAtomValue(source)`     | Reads an atom, lazy atom or proxy atom.                |
| `useComputedValue(source)` | Reads a computed, proxy atom or resource. Suspends.    |
| `useSetAtom(source)`       | Returns a setter, without subscribing.                 |
| `useAtomState(source)`     | Returns `[value, setter]`.                             |
| `useResetSource(source)`   | Returns a callback that resets the source.             |
| `useAction(action)`        | Binds an action to the nearest domain.                 |
| `useAtemnoGraph()`         | Returns every live node with its state.                |

## Sponsors

![Sponsors](https://github.com/lxsmnsyc/sponsors/blob/main/sponsors.svg?raw=true)

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
