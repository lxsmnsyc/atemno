import { expect } from 'vitest';
import { atom, computed, lazyAtom, ReactiveDomain } from '../../src/graph';
import type { Atom, LazyAtom, ReadableSource } from '../../src/types';
import {
  evaluateComputed,
  evaluateOracle,
  readNodes,
  type GraphSpec,
} from './spec';

/** One call of an observer callback. */
interface ObserverEvent {
  observer: number;
  generation: number;
  value: number;
}

/** What the model remembers about a live subscription. */
interface Subscription {
  generation: number;
  /** The value the observer saw last. The next call must differ from it. */
  last: number;
  stop: () => void;
}

/** The plain-JS side: the atom values and the oracle's view of observers. */
export interface Model {
  graph: GraphSpec;
  atomValues: number[];
  subscriptions: (Subscription | undefined)[];
}

/** The library side: a domain and the probes that watch it. */
export interface Real {
  domain: ReactiveDomain;
  sources: ReadableSource<number>[];
  atoms: (Atom<number> | LazyAtom<number>)[];
  /** How often each node's compute function ran since the last reset. */
  evaluations: number[];
  /** The nodes each computed read during its latest run. */
  lastReads: (number[] | undefined)[];
  events: ObserverEvent[];
  nextGeneration: number;
}

export interface Write {
  atom: number;
  value: number;
}

function noop(): void {
  // Pins an atom in the domain.
}

export function createModel(graph: GraphSpec): Model {
  const atomValues: number[] = [];
  for (const spec of graph.atoms) {
    atomValues.push(spec.initial);
  }
  const subscriptions: (Subscription | undefined)[] = [];
  for (let index = 0; index < graph.observers.length; index++) {
    subscriptions.push(undefined);
  }
  return {
    graph,
    atomValues,
    subscriptions,
  };
}

export function createReal(graph: GraphSpec): Real {
  const domain = new ReactiveDomain({});
  const sources: ReadableSource<number>[] = [];
  const atoms: (Atom<number> | LazyAtom<number>)[] = [];
  const evaluations: number[] = [];
  const lastReads: (number[] | undefined)[] = [];

  // Atoms come first in the numbering.
  for (const [index, spec] of graph.atoms.entries()) {
    const name = `atom-${index}`;
    const source = spec.lazy
      ? lazyAtom(name, () => spec.initial)
      : atom(name, spec.initial);
    atoms.push(source);
    sources.push(source);
    evaluations.push(0);
    lastReads.push(undefined);
    // A domain destroys a node once nothing observes it, and the atom would
    // fall back to its initial value. Pinning keeps atom values stable, so
    // the oracle only has to model values.
    domain.observe(source, noop);
  }

  // Computeds follow, each reading nodes with a lower number.
  for (const [index, spec] of graph.computeds.entries()) {
    const node = graph.atoms.length + index;
    sources.push(
      computed<number>(`computed-${node}`, $ => {
        evaluations[node]!++;
        const reads: number[] = [];
        const value = evaluateComputed(spec, read => {
          reads.push(read);
          return $.get(sources[read]!);
        });
        lastReads[node] = reads;
        return value;
      }),
    );
    evaluations.push(0);
    lastReads.push(undefined);
  }

  return {
    domain,
    sources,
    atoms,
    evaluations,
    lastReads,
    events: [],
    nextGeneration: 0,
  };
}

function resetProbes(real: Real): void {
  real.events.length = 0;
  real.evaluations.fill(0);
}

function readAllNodes(real: Real, expected: readonly number[]): void {
  // High numbers first. A computed that stops reading a dependency lets the
  // domain release it, and a release followed by a read would run it twice.
  // Readers always have higher numbers than what they read, so they go first.
  for (let node = real.sources.length - 1; node >= 0; node--) {
    expect(real.domain.get(real.sources[node]!), `node ${node}`).toBe(
      expected[node],
    );
  }
}

/**
 * Reads every node twice. The first pass must match the oracle. The second
 * pass changes nothing, so it must not run any compute function.
 */
export function checkReads(model: Model, real: Real): void {
  const expected = evaluateOracle(model.graph, model.atomValues);

  // Each computed runs at most once to catch up.
  real.evaluations.fill(0);
  readAllNodes(real, expected);
  for (const count of real.evaluations) {
    expect(count).toBeLessThanOrEqual(1);
  }

  // Everything is up to date now, so a second read is free.
  real.evaluations.fill(0);
  readAllNodes(real, expected);
  for (const [node, runs] of real.evaluations.entries()) {
    expect(runs, `runs of node ${node} on a second read`).toBe(0);
  }
}

/**
 * Lists the computeds that may run during a write. A computed may run when a
 * changed atom reaches it through the reads of its latest run, or when a run
 * newly reads it.
 */
function findAllowedRuns(
  model: Model,
  previousReads: readonly (number[] | undefined)[],
  changed: Set<number>,
  after: readonly number[],
  probe: number | undefined,
): Set<number> {
  const atomCount = model.graph.atoms.length;
  const allowed = new Set<number>();
  const affected = new Set<number>(changed);

  // Walk up the numbering, so every read has been decided before its reader.
  for (let index = 0; index < model.graph.computeds.length; index++) {
    const node = atomCount + index;
    const reads = previousReads[node];
    if (!reads) {
      continue;
    }
    for (const read of reads) {
      if (affected.has(read)) {
        affected.add(node);
        allowed.add(node);
        break;
      }
    }
  }

  // A probe read inside a batch runs whatever it needs.
  if (probe !== undefined) {
    allowed.add(probe);
  }

  // Walk down, so a run that reads a new computed pulls it in as well.
  for (
    let node = atomCount + model.graph.computeds.length - 1;
    node >= atomCount;
    node--
  ) {
    if (allowed.has(node)) {
      const spec = model.graph.computeds[node - atomCount]!;
      for (const read of readNodes(spec, after)) {
        allowed.add(read);
      }
    }
  }
  return allowed;
}

/**
 * Applies atom writes in one batch, or one by one when `batched` is false,
 * and checks what the observers and compute functions did.
 */
export function commitWrites(
  model: Model,
  real: Real,
  writes: Write[],
  batched: boolean,
  probe: number | undefined,
): void {
  const lastReads = [...real.lastReads];
  resetProbes(real);

  // Apply the writes to the library.
  function applyWrites(): void {
    for (const write of writes) {
      real.domain.set(real.atoms[write.atom]!, write.value);
    }
    if (probe !== undefined) {
      // Reads inside a batch see every write made so far.
      const expected = evaluateOracle(model.graph, modelAfter(model, writes));
      expect(real.domain.get(real.sources[probe]!)).toBe(expected[probe]);
    }
  }
  if (batched) {
    real.domain.batch(applyWrites);
  } else {
    applyWrites();
  }

  // Apply the same writes to the model and note which atoms really changed.
  const changed = new Set<number>();
  for (const write of writes) {
    if (model.atomValues[write.atom] !== write.value) {
      changed.add(write.atom);
      model.atomValues[write.atom] = write.value;
    }
  }
  const after = evaluateOracle(model.graph, model.atomValues);

  // Each observer fires at most once, with the settled value, and only when
  // that value differs from the one it saw last.
  checkEvents(model, real, after);

  // Compute functions run at most once, and only where a change can reach.
  const allowed = findAllowedRuns(model, lastReads, changed, after, probe);
  for (const [node, count] of real.evaluations.entries()) {
    expect(count, `runs of node ${node}`).toBeLessThanOrEqual(1);
    if (count > 0) {
      expect(allowed.has(node), `node ${node} ran without a cause`).toBe(true);
    }
  }

  checkReads(model, real);
}

function modelAfter(model: Model, writes: Write[]): number[] {
  const values = [...model.atomValues];
  for (const write of writes) {
    values[write.atom] = write.value;
  }
  return values;
}

function checkEvents(model: Model, real: Real, after: readonly number[]): void {
  const fired = new Map<number, ObserverEvent>();
  for (const event of real.events) {
    // A second call in one commit would be a repeated notification.
    expect(
      fired.has(event.observer),
      `observer ${event.observer} fired twice`,
    ).toBe(false);
    fired.set(event.observer, event);
  }

  for (const [index, subscription] of model.subscriptions.entries()) {
    const event = fired.get(index);
    if (!subscription) {
      // A stopped observer never fires again.
      expect(event, `stopped observer ${index} fired`).toBeUndefined();
      continue;
    }
    const value = after[model.graph.observers[index]!.target]!;
    if (value === subscription.last) {
      expect(
        event,
        `observer ${index} fired for an equal value`,
      ).toBeUndefined();
    } else {
      expect(event, `observer ${index} missed a change`).toBeDefined();
      expect(event!.generation).toBe(subscription.generation);
      expect(event!.value).toBe(value);
      subscription.last = value;
    }
  }
}

export function subscribeObserver(
  model: Model,
  real: Real,
  index: number,
): void {
  resetProbes(real);
  const target = model.graph.observers[index]!.target;
  const generation = real.nextGeneration++;

  // The callback only records the call, so the checks run after the command.
  const stop = real.domain.observe(real.sources[target]!, value => {
    real.events.push({ observer: index, generation, value });
  });

  // Subscribing records the current value and does not call the observer.
  const expected = evaluateOracle(model.graph, model.atomValues);
  model.subscriptions[index] = { generation, last: expected[target]!, stop };
  expect(real.events).toEqual([]);
  for (const count of real.evaluations) {
    expect(count).toBeLessThanOrEqual(1);
  }
  checkReads(model, real);
}

export function unsubscribeObserver(
  model: Model,
  real: Real,
  index: number,
): void {
  resetProbes(real);
  model.subscriptions[index]!.stop();
  model.subscriptions[index] = undefined;
  expect(real.events).toEqual([]);
  checkReads(model, real);
}

export function readNode(model: Model, real: Real, node: number): void {
  resetProbes(real);
  const expected = evaluateOracle(model.graph, model.atomValues);
  expect(real.domain.get(real.sources[node]!)).toBe(expected[node]);
  expect(real.events).toEqual([]);
  checkReads(model, real);
}

export function resetComputed(model: Model, real: Real, node: number): void {
  resetProbes(real);
  real.domain.reset(real.sources[node]!);

  // The rerun gives the same value, so nobody is told.
  expect(real.events).toEqual([]);
  checkReads(model, real);
}
