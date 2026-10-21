import type { ReactNode } from 'react';
import * as React from 'react';
import {
  createContext,
  createElement,
  Fragment,
  useCallback,
  useContext,
  useDebugValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type {
  Action,
  Cleanup,
  DerivedSource,
  NormalAction,
  ReactiveDomainOptions,
  ReadableSource,
  Result,
  WritableSource,
} from '../index';
import { isSameResult, readResult } from '../concurrency';
import { ReactiveDomain, ResourceNotReadyError } from '../index';
import { NodeType } from '../types';

// ---------------------------------------------------------------------------
// Graph inspection
// ---------------------------------------------------------------------------

export type AtemnoNodeKind =
  | 'atom'
  | 'lazyAtom'
  | 'computed'
  | 'proxy'
  | 'resource'
  | 'producer';

export interface AtemnoNodeSnapshot {
  name: string;
  kind: AtemnoNodeKind;
  /**
   * The node's current state. Absent when reading it threw.
   */
  value?: unknown;
  /**
   * What reading the node threw, for a computed that failed.
   */
  error?: unknown;
  failed: boolean;
  /**
   * Whether the node is a resource still waiting on its promise, or a
   * computed waiting on one. A pending node has no value and is not failed.
   */
  pending: boolean;
}

interface GraphSnapshot {
  version: number;
  nodes: AtemnoNodeSnapshot[];
}

const EMPTY_SNAPSHOT: GraphSnapshot = { version: 0, nodes: [] };

interface GraphRegistry {
  subscribe: (listener: () => void) => Cleanup;
  getSnapshot: () => GraphSnapshot;
  add: (source: ReadableSource<any>) => void;
  touch: () => void;
  remove: (source: ReadableSource<any>) => void;
  attach: (domain: ReactiveDomain) => void;
}

function kindOf(source: ReadableSource<any>): AtemnoNodeKind {
  switch (source.type) {
    case NodeType.Atom:
      return 'atom';
    case NodeType.Computed:
      return 'computed';
    case NodeType.Proxy:
      return 'proxy';
    case NodeType.Resource:
      return 'resource';
    case NodeType.LazyAtom:
      return 'lazyAtom';
    case NodeType.Producer:
      return 'producer';
  }
}

/** Each kind of node has its own namespace of names in a domain. */
function keyOf(source: ReadableSource<any>): string {
  return `${kindOf(source)}:${source.name}`;
}

/**
 * Tracks which nodes a domain currently holds, so they can be rendered for the
 * React developer tools.
 *
 * Lifecycle events arrive in the middle of reactive work, which can happen
 * during a render. Notifications are therefore deferred to a microtask, keeping
 * the update out of the render phase.
 */
function createGraphRegistry(): GraphRegistry {
  const sources = new Map<string, ReadableSource<any>>();
  const listeners = new Set<() => void>();
  let domain: ReactiveDomain | undefined;
  let snapshot = EMPTY_SNAPSHOT;
  let scheduled = false;

  function read(source: ReadableSource<any>): AtemnoNodeSnapshot {
    const base = { name: source.name, kind: kindOf(source) };
    if (!domain) {
      return { ...base, failed: false, pending: false };
    }
    try {
      // Only nodes the domain still holds are read, so this never revives a
      // released one. A stale computed does recompute here, earlier than it
      // otherwise would have.
      return {
        ...base,
        value: domain.get(source),
        failed: false,
        pending: false,
      };
    } catch (error) {
      if (error instanceof ResourceNotReadyError) {
        return { ...base, failed: false, pending: true };
      }
      return { ...base, error, failed: true, pending: false };
    }
  }

  function flush(): void {
    scheduled = false;
    snapshot = {
      version: snapshot.version + 1,
      nodes: [...sources.values()].map(read),
    };
    for (const listener of [...listeners]) {
      listener();
    }
  }

  function schedule(): void {
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
  }

  return {
    attach(next) {
      domain = next;
    },
    add(source) {
      sources.set(keyOf(source), source);
      schedule();
    },
    touch: schedule,
    remove(source) {
      sources.delete(keyOf(source));
      schedule();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return snapshot;
    },
  };
}

const GraphContext = createContext<GraphRegistry | undefined>(undefined);

/**
 * Returns every node the domain currently holds, with its state.
 *
 * Rerenders when the graph changes. Use it to build an inspector of your own.
 * The list is a snapshot taken outside the render phase, so reading it has no
 * effect on the graph.
 *
 * Must sit under an `AtemnoDomain`, which is what tracks the graph.
 */
export function useAtemnoGraph(): AtemnoNodeSnapshot[] {
  const registry = useContext(GraphContext);
  if (!registry) {
    throw new Error('useAtemnoGraph requires an AtemnoDomain above it.');
  }

  return useSyncExternalStore(
    registry.subscribe,
    registry.getSnapshot,
    registry.getSnapshot,
  ).nodes;
}

/**
 * Renders one element per node the domain holds, so the reactive state shows up
 * in the React developer tools. Renders nothing itself.
 *
 * Must sit under an `AtemnoDomain`, which is what tracks the graph.
 */
export function AtemnoGraph(): ReactNode {
  const nodes = useAtemnoGraph();

  return createElement(
    Fragment,
    null,
    nodes.map(node =>
      createElement(NODE_COMPONENTS[node.kind], {
        key: `${node.kind}:${node.name}`,
        ...node,
      }),
    ),
  );
}

// These draw nothing. They exist so each node shows up as its own element in
// the React developer tools, labelled by kind, with the node's name and value
// on its props.
//
// The identifiers are suffixed because the plain names would shadow the `Atom`,
// `LazyAtom` and `Computed` types in the generated declarations, which silently
// breaks the public signatures that reference them. The developer tools read
// `displayName`, so the labels stay clean.
function AtomNodeElement(_props: AtemnoNodeSnapshot): ReactNode {
  return null;
}
AtomNodeElement.displayName = 'Atom';

function LazyAtomNodeElement(_props: AtemnoNodeSnapshot): ReactNode {
  return null;
}
LazyAtomNodeElement.displayName = 'LazyAtom';

function ComputedNodeElement(_props: AtemnoNodeSnapshot): ReactNode {
  return null;
}
ComputedNodeElement.displayName = 'Computed';

function ProxyAtomNodeElement(_props: AtemnoNodeSnapshot): ReactNode {
  return null;
}
ProxyAtomNodeElement.displayName = 'ProxyAtom';

function ResourceNodeElement(_props: AtemnoNodeSnapshot): ReactNode {
  return null;
}
ResourceNodeElement.displayName = 'Resource';

function ProducerNodeElement(_props: AtemnoNodeSnapshot): ReactNode {
  return null;
}
ProducerNodeElement.displayName = 'Producer';

const NODE_COMPONENTS: Record<
  AtemnoNodeKind,
  (props: AtemnoNodeSnapshot) => ReactNode
> = {
  atom: AtomNodeElement,
  lazyAtom: LazyAtomNodeElement,
  computed: ComputedNodeElement,
  proxy: ProxyAtomNodeElement,
  resource: ResourceNodeElement,
  producer: ProducerNodeElement,
};

// ---------------------------------------------------------------------------
// Domain
// ---------------------------------------------------------------------------

const DomainContext = createContext<ReactiveDomain | undefined>(undefined);

export interface AtemnoDomainProps extends ReactiveDomainOptions {
  /**
   * Renders the domain's graph as elements, for the React developer tools.
   * Off by default, because it re-renders on every write.
   */
  devtools?: boolean;
  /**
   * Called once with the new domain, before anything below renders. Write the
   * starting state here, such as data loaded on the server for this request.
   */
  initialize?: (domain: ReactiveDomain) => void;
  children?: ReactNode;
}

/**
 * Creates a domain, supplies it to the tree, and tracks its graph.
 *
 * The domain is built once and kept for the life of the component. The option
 * handlers may change freely between renders; the latest ones are always the
 * ones called.
 *
 * The domain is deliberately not destroyed on unmount. Unmounting releases
 * every subscription the tree held, which lets the domain's own cleanup release
 * the nodes, and the domain itself becomes garbage. Calling `destroy` here
 * would break `StrictMode`, whose remount reuses this component's state and
 * would find a dead domain.
 */
export function AtemnoDomain(props: AtemnoDomainProps): ReactNode {
  const options = useRef(props);
  useEffect(() => {
    options.current = props;
  });

  const [handle] = useState(() => {
    const registry = createGraphRegistry();
    const domain = new ReactiveDomain({
      onError(reason) {
        const handler = options.current.onError;
        if (handler) {
          handler(reason);
        } else {
          throw reason;
        }
      },
      onCreate(source) {
        registry.add(source);
        options.current.onCreate?.(source);
      },
      onUpdate(source) {
        registry.touch();
        options.current.onUpdate?.(source);
      },
      onDestroy(source) {
        registry.remove(source);
        options.current.onDestroy?.(source);
      },
    });
    registry.attach(domain);
    props.initialize?.(domain);
    return { domain, registry };
  });

  return createElement(
    GraphContext.Provider,
    { value: handle.registry },
    props.devtools ? createElement(AtemnoGraph, null) : null,
    createElement(
      DomainContext.Provider,
      { value: handle.domain },
      props.children,
    ),
  );
}

/**
 * Returns the nearest domain.
 *
 * @throws if there is no provider above the caller.
 */
export function useAtemnoDomain(): ReactiveDomain {
  const domain = useContext(DomainContext);
  if (!domain) {
    throw new Error('useAtemnoDomain requires an AtemnoDomain above it.');
  }
  return domain;
}

// ---------------------------------------------------------------------------
// Reading and writing
// ---------------------------------------------------------------------------

// `use` arrived in React 19. React 18 suspends on a thrown promise instead.
const reactUse = (React as { use?: <T>(usable: Promise<T>) => T }).use;

function suspend(request: Promise<unknown>): never {
  if (reactUse) {
    reactUse(request);
  }
  throw request;
}

function useSourceValue<T>(source: ReadableSource<T>): T {
  const domain = useAtemnoDomain();

  const subscribe = useCallback(
    (onChange: () => void) => domain.observe(source, onChange),
    [domain, source],
  );
  // The snapshot is the outcome of the read, kept while it is the same, since
  // useSyncExternalStore compares snapshots by identity.
  const last = useRef<Result<T> | undefined>(undefined);
  const read = useCallback((): Result<T> => {
    const next = readResult(() => domain.get(source));
    if (last.current && isSameResult(last.current, next)) {
      return last.current;
    }
    last.current = next;
    return next;
  }, [domain, source]);

  // The third argument covers server rendering, where there is nothing to
  // subscribe to.
  const result = useSyncExternalStore(subscribe, read, read);
  useDebugValue(result);
  switch (result.type) {
    case 'success':
      return result.value;
    case 'failure':
      throw result.value;
    case 'pending':
      return suspend(result.request);
  }
}

export type AtomUpdate<T> = T | ((previous: T) => T);
export type AtomSetter<T> = (update: AtomUpdate<T>) => void;

function isUpdater<T>(update: AtomUpdate<T>): update is (previous: T) => T {
  return typeof update === 'function';
}

/**
 * Reads an atom, lazy atom or proxy atom and rerenders when it changes.
 * Suspends while a proxy atom waits on a pending resource.
 */
export function useAtomValue<T>(source: WritableSource<T>): T {
  return useSourceValue(source);
}

/**
 * Reads a computed, proxy atom or resource and rerenders when it changes.
 * Evaluates it if nothing has yet.
 *
 * While a resource, or a computed reading one, waits on its promise, the
 * component suspends, so the nearest `Suspense` boundary shows its fallback.
 * A rejection or a thrown error goes to the nearest error boundary.
 */
export function useComputedValue<T>(source: DerivedSource<T>): T {
  return useSourceValue(source);
}

/**
 * Returns a setter for an atom. The caller does not subscribe, so writing from
 * a component that never reads the atom causes no rerender.
 *
 * The setter takes a value or a function of the current value. An atom whose
 * type is itself a function has to be written with a function returning it.
 */
export function useSetAtom<T>(source: WritableSource<T>): AtomSetter<T> {
  const domain = useAtemnoDomain();

  return useCallback(
    (update: AtomUpdate<T>) => {
      domain.set(
        source,
        isUpdater(update) ? update(domain.get(source)) : update,
      );
    },
    [domain, source],
  );
}

/**
 * Reads an atom and returns a setter for it, in the shape of `useState`.
 */
export function useAtomState<T>(source: WritableSource<T>): [T, AtomSetter<T>] {
  return [useAtomValue(source), useSetAtom(source)];
}

/**
 * Returns a callback that restores a source to its initial state. Resetting a
 * computed forces it to run again.
 */
export function useResetSource<T>(source: ReadableSource<T>): () => void {
  const domain = useAtemnoDomain();

  return useCallback(() => {
    domain.reset(source);
  }, [domain, source]);
}

/**
 * Binds an action to the nearest domain. The returned callback is stable for as
 * long as the domain and the action are.
 */
export function useAction<T, R>(action: Action<T, R>): NormalAction<T, R> {
  const domain = useAtemnoDomain();

  return useMemo(() => domain.getAction(action), [domain, action]);
}
