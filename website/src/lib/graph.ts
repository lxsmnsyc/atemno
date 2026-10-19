import { ReactiveDomain } from 'atemno';
import type { Atom, Cleanup, Computed, ReadableSource, TrackerContext } from 'atemno';
import { createMemo, createSignal } from 'solid-js';

/**
 * What a node is doing right now, read off the graph rather than guessed.
 *
 * - `idle`: never evaluated.
 * - `fresh`: its cached value is current.
 * - `dirty`: something it read changed after it last ran. It will rerun the
 *   next time anything reads it.
 * - `check`: nothing it read changed, but something further upstream did. It
 *   may or may not rerun; that depends on whether the change makes it this far.
 * - `released`: the domain dropped the node because nothing tracked it.
 */
export type NodeStatus = 'idle' | 'fresh' | 'dirty' | 'check' | 'released';

export type NodeKind = 'atom' | 'computed';

export interface GraphNode {
  name: string;
  kind: NodeKind;
  status: NodeStatus;
  /** Formatted for display. Empty while there is nothing to show. */
  value: string;
  failed: boolean;
  /** How many times a computed's function has run. */
  runs: number;
  /** How many times an atom's value has actually changed. */
  writes: number;
  /** What a computed read on its last run. */
  deps: string[];
  held: boolean;
  observed: boolean;
}

export type LogKind = 'write' | 'run' | 'fail' | 'release' | 'create' | 'observe' | 'fire' | 'read';

export interface LogEntry {
  id: number;
  kind: LogKind;
  text: string;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  log: LogEntry[];
}

export interface GraphOptions {
  /**
   * Fresh sources for this graph alone. The graph instruments every computed
   * in place, so sources must not be shared with another graph.
   */
  sources: ReadableSource<any>[];
  /** Atoms kept alive by a subscription the graph holds for good. */
  hold?: string[];
  /** Sources observed from the start. */
  observe?: string[];
}

export interface Graph {
  snapshot: () => GraphSnapshot;
  /** The current value of a source as the graph last saw it. */
  valueOf: <T>(name: string) => T;
  write: <T>(name: string, next: T | ((current: T) => T)) => void;
  read: (name: string) => void;
  observe: (name: string) => void;
  unobserve: (name: string) => void;
  isObserved: (name: string) => boolean;
}

interface Tracked {
  name: string;
  kind: NodeKind;
  source: ReadableSource<any>;
  alive: boolean;
  created: boolean;
  value: unknown;
  hasValue: boolean;
  failed: boolean;
  error: unknown;
  runs: number;
  writes: number;
  changedAt: number;
  deps: string[];
  /**
   * Each dependency's `changedAt` as it was when this node read it. A node is
   * dirty once a dependency has changed since. Comparing against when the
   * node started would be wrong: a dependency evaluated during this node's
   * own run changes after it starts.
   */
  seen: Map<string, number>;
}

const LOG_LIMIT = 14;

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

function isComputed(source: ReadableSource<unknown>): source is Computed<unknown> {
  return 'compute' in source;
}

/**
 * Builds a real `ReactiveDomain` over `sources` and watches it work.
 *
 * Every computed's function is wrapped so each run records what it read and
 * whether its result changed. A node's status is then derived from those
 * records, the same way the domain decides what to rerun. Nothing here
 * evaluates a computed on its own: reading one to show its value would defeat
 * the laziness the graph exists to show. A computed shows the value its last
 * run returned.
 */
export function createGraph(options: GraphOptions): Graph {
  const nodes = new Map<string, Tracked>();
  const log: LogEntry[] = [];
  const held = new Set(options.hold ?? []);
  const observers = new Map<string, Cleanup>();

  let clock = 0;
  let logId = 0;

  function tick(): number {
    clock += 1;
    return clock;
  }

  function record(kind: LogKind, text: string): void {
    logId += 1;
    log.unshift({ id: logId, kind, text });
    log.length = Math.min(log.length, LOG_LIMIT);
  }

  // Changes are batched into one rerender after the current task. The writes
  // happen inside the domain's own callbacks, which can run while Solid is
  // rendering, and a signal must not be written there.
  //
  // Setting the graph up schedules nothing: the first render already draws
  // that state. A rerender scheduled then would land while the server is
  // still streaming the page, and give the browser different markup to
  // hydrate than the server sent.
  const [version, setVersion] = createSignal(0);
  let scheduled = false;
  let settingUp = true;

  function schedule(): void {
    if (scheduled || settingUp) {
      return;
    }
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      setVersion((value) => value + 1);
    });
  }

  function track(name: string): Tracked {
    const node = nodes.get(name);
    if (!node) {
      throw new Error(`The graph has no source named "${name}".`);
    }
    return node;
  }

  for (const source of options.sources) {
    const node: Tracked = {
      name: source.name,
      kind: isComputed(source) ? 'computed' : 'atom',
      source,
      alive: false,
      created: false,
      value: undefined,
      hasValue: false,
      failed: false,
      error: undefined,
      runs: 0,
      writes: 0,
      changedAt: 0,
      deps: [],
      seen: new Map(),
    };
    nodes.set(source.name, node);

    if (isComputed(source)) {
      const original = source.compute;
      source.compute = ($: TrackerContext<unknown>) => {
        node.runs += 1;
        const deps = new Set<string>();
        const seen = new Map<string, number>();
        const traced: TrackerContext<unknown> = {
          ...$,
          get: <T>(dependency: ReadableSource<T>): T => {
            deps.add(dependency.name);
            const value = $.get(dependency);
            // After the read, so a dependency that ran because of it counts
            // as already seen.
            seen.set(dependency.name, nodes.get(dependency.name)?.changedAt ?? 0);
            return value;
          },
        };
        try {
          const value = original(traced);
          node.deps = [...deps];
          node.seen = seen;
          if (node.failed || !node.hasValue || !source.isEqual(node.value, value)) {
            node.changedAt = tick();
          }
          node.value = value;
          node.hasValue = true;
          node.failed = false;
          node.error = undefined;
          record('run', `${node.name} ran → ${formatValue(value)}`);
          return value;
        } catch (error) {
          node.deps = [...deps];
          node.seen = seen;
          node.failed = true;
          node.error = error;
          node.changedAt = tick();
          record('fail', `${node.name} threw ${error instanceof Error ? error.message : String(error)}`);
          throw error;
        } finally {
          schedule();
        }
      };
    }
  }

  const domain = new ReactiveDomain({
    onError(error) {
      record('fail', `observer threw ${error instanceof Error ? error.message : String(error)}`);
      schedule();
    },
    onCreate(source) {
      const node = nodes.get(source.name);
      if (!node) {
        return;
      }
      node.alive = true;
      if (node.created) {
        // A released node comes back from scratch, atoms at their initial value.
        if (node.kind === 'atom') {
          node.changedAt = tick();
        }
        record('create', `${node.name} rebuilt from scratch`);
      }
      node.created = true;
      schedule();
    },
    onDestroy(source) {
      const node = nodes.get(source.name);
      if (!node) {
        return;
      }
      node.alive = false;
      record('release', `${node.name} released, nothing tracks it`);
      schedule();
    },
  });

  function currentAtomValue(node: Tracked): unknown {
    const atom = node.source as Atom<unknown>;
    // A released atom has no value until something brings it back.
    return node.alive ? domain.get(atom) : atom.initialValue;
  }

  /**
   * Graphs are acyclic, so a status is computed once per build and shared by
   * every node downstream of it.
   */
  function status(node: Tracked, cache: Map<string, NodeStatus>): NodeStatus {
    const cached = cache.get(node.name);
    if (cached) {
      return cached;
    }
    let result: NodeStatus = 'fresh';
    if (!node.alive) {
      result = node.created ? 'released' : 'idle';
    } else if (node.kind === 'computed' && !node.hasValue && !node.failed) {
      result = 'idle';
    } else if (node.kind === 'computed') {
      for (const name of node.deps) {
        const dependency = nodes.get(name);
        if (!dependency) {
          continue;
        }
        if (dependency.changedAt > (node.seen.get(name) ?? 0)) {
          result = 'dirty';
          break;
        }
        const upstream = status(dependency, cache);
        if (upstream === 'dirty' || upstream === 'check') {
          result = 'check';
        }
      }
    }
    cache.set(node.name, result);
    return result;
  }

  function build(): GraphSnapshot {
    const cache = new Map<string, NodeStatus>();
    return {
      nodes: [...nodes.values()].map((node) => {
        let value = '';
        if (node.kind === 'atom') {
          value = node.alive ? formatValue(currentAtomValue(node)) : '';
        } else if (node.failed) {
          value = node.error instanceof Error ? node.error.message : String(node.error);
        } else if (node.hasValue) {
          value = formatValue(node.value);
        }
        return {
          name: node.name,
          kind: node.kind,
          status: status(node, cache),
          value,
          failed: node.failed,
          runs: node.runs,
          writes: node.writes,
          deps: node.deps,
          held: held.has(node.name),
          observed: observers.has(node.name),
        };
      }),
      log: [...log],
    };
  }

  function observe(name: string): void {
    if (observers.has(name)) {
      return;
    }
    const node = track(name);
    const stop = domain.observe(node.source, (value) => {
      record('fire', `observer of ${name} saw ${formatValue(value)}`);
      schedule();
    });
    observers.set(name, stop);
    record('observe', `observing ${name}`);
    schedule();
  }

  function unobserve(name: string): void {
    const stop = observers.get(name);
    if (!stop) {
      return;
    }
    observers.delete(name);
    record('observe', `stopped observing ${name}`);
    stop();
    schedule();
  }

  // Held atoms get a subscription that is never released, standing in for
  // whatever in a real app keeps reading them.
  for (const name of held) {
    domain.observe(track(name).source, () => {
      // Kept alive, nothing to do.
    });
  }
  for (const name of options.observe ?? []) {
    observe(name);
  }
  // Setting the graph up is not part of the story the log tells.
  log.length = 0;
  settingUp = false;

  const snapshot = createMemo(() => {
    version();
    return build();
  });

  return {
    snapshot,
    valueOf<T>(name: string): T {
      version();
      const node = track(name);
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The caller names the source, and so its type.
      return (node.kind === 'atom' ? currentAtomValue(node) : node.value) as T;
    },
    write<T>(name: string, next: T | ((current: T) => T)): void {
      const node = track(name);
      const atom = node.source as Atom<T>;
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Atoms named here hold a T.
      const current = currentAtomValue(node) as T;
      const value =
        typeof next === 'function' ? (next as (current: T) => T)(current) : (next as T);
      if (atom.isEqual(current, value)) {
        record('write', `${name} = ${formatValue(value)}, equal, so ignored`);
      } else {
        node.changedAt = tick();
        node.writes += 1;
        record('write', `${name} = ${formatValue(value)}`);
      }
      domain.set(atom, value);
      schedule();
    },
    read(name: string): void {
      record('read', `read ${name}`);
      try {
        domain.get(track(name).source);
      } catch {
        // A failing computed reports itself through its own log entry.
      }
      schedule();
    },
    observe,
    unobserve,
    isObserved(name: string): boolean {
      version();
      return observers.has(name);
    },
  };
}
