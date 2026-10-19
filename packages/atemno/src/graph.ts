import { IS_EQUAL } from './constants';
import type {
  ActionContext,
  Atom,
  Cleanup,
  Computation,
  Computed,
  DerivedSource,
  IsEqual,
  LazyAtom,
  ProxyAtom,
  ProxyWrite,
  ReadableSource,
  Ref,
  Resource,
  ResourceComputation,
  TrackerContext,
  WritableSource,
} from './types';
import { ComputedState, NodeType, State } from './types';

/**
 * Creates a writable state.
 * @param name a unique string to represent the atom
 * @param initialValue the initial state of the atom
 * @param isEqual tells whether the atom should update with the new value
 */
export function atom<T>(
  name: string,
  initialValue: T,
  isEqual?: IsEqual<T>,
): Atom<T> {
  return {
    type: NodeType.Atom,
    name,
    initialValue,
    isEqual: isEqual ?? IS_EQUAL,
  };
}

/**
 * Creates a computed state that produces a value based from other atoms or computeds
 * @param name a unique string to represent the computed
 * @param compute a function that produces the state of the computed
 * @param isEqual tells whether the computed should update with the new produced value
 * @returns
 */
export function computed<T>(
  name: string,
  compute: Computation<T>,
  isEqual?: IsEqual<T>,
): Computed<T> {
  return {
    type: NodeType.Computed,
    name,
    compute,
    isEqual: isEqual ?? IS_EQUAL,
  };
}

/**
 * Creates a writable state whose initial state is evaluated on first read.
 * @param name a unique string to represent the atom
 * @param initialValue the initial state of the atom
 * @param isEqual tells whether the atom should update with the new value
 */
export function lazyAtom<T>(
  name: string,
  initialValue: () => T,
  isEqual?: IsEqual<T>,
): LazyAtom<T> {
  return {
    type: NodeType.LazyAtom,
    name,
    initialValue,
    isEqual: isEqual ?? IS_EQUAL,
  };
}

export interface ProxyAtomOptions<T> {
  /** Derives the value, like a computed. */
  get: Computation<T>;
  /** Receives every write and passes it on to other writable sources. */
  set: ProxyWrite<T>;
  isEqual?: IsEqual<T>;
}

/**
 * Creates a writable state derived from other sources. It reads like a
 * computed, and a write to it runs `set`, which writes to the sources it is
 * derived from.
 * @param name a unique string to represent the proxy atom
 */
export function proxy<T>(
  name: string,
  options: ProxyAtomOptions<T>,
): ProxyAtom<T> {
  return {
    type: NodeType.Proxy,
    name,
    compute: options.get,
    write: options.set,
    isEqual: options.isEqual ?? IS_EQUAL,
  };
}

/**
 * Creates an asynchronous computed state. While the promise its computation
 * returns is pending, reading it throws a `ResourceNotReadyError` carrying
 * that promise. Once it settles, reading it returns the value or rethrows the
 * rejection. Only the reads made before the first `await` are tracked.
 * @param name a unique string to represent the resource
 * @param compute a function that produces the state of the resource
 * @param isEqual tells whether the resource should update with the resolved value
 */
export function resource<T>(
  name: string,
  compute: ResourceComputation<T>,
  isEqual?: IsEqual<T>,
): Resource<T> {
  return {
    type: NodeType.Resource,
    name,
    compute,
    isEqual: isEqual ?? IS_EQUAL,
  };
}

/**
 * Thrown when reading a resource whose promise is still pending. `request` is
 * the promise, so a caller can wait for it.
 */
export class ResourceNotReadyError extends Error {
  constructor(readonly request: Promise<unknown>) {
    super('Resource is not yet ready.');
  }
}

export interface ReactiveDomainOptions {
  /**
   * A default error handler that catches unhandled errors
   * from computeds and observers
   * @param reason the error cause
   */
  onError?: (reason: unknown) => void;

  onCreate?: <T>(source: ReadableSource<T> | WritableSource<T>) => void;
  onUpdate?: <T>(source: ReadableSource<T> | WritableSource<T>) => void;
  onDestroy?: <T>(source: ReadableSource<T> | WritableSource<T>) => void;
}

/**
 * A ReactiveDomain represents a boundary for where atoms and computeds can be instanciated
 * and the lifecycles managed. States of atoms and computeds are stored in a ReactiveDomain,
 * as well as processing of computeds and observers.
 */
export class ReactiveDomain {
  private alive = true;

  private atoms = new Map<string, AtomNode<any>>();

  private computeds = new Map<string, ComputedNode<any>>();

  private proxies = new Map<string, ComputedNode<any>>();

  private resources = new Map<string, ComputedNode<any>>();

  private lazyAtoms = new Map<string, LazyAtomNode<any>>();

  private observers = new Set<ObserverNode<any>>();

  /**
   * Observers marked by the current write, waiting to be revalidated once
   * every affected node has been marked.
   * @internal
   */
  pending: ObserverNode<any>[] = [];

  /** @internal */
  flushing = false;

  constructor(private options: ReactiveDomainOptions) {}

  destroy(): void {
    if (!this.alive) {
      return;
    }
    // Destroy all observers
    for (const observer of this.observers) {
      destroyObserverNode(this, observer);
    }
    this.observers.clear();
    // Destroy all computeds, proxies and resources
    for (const map of [this.computeds, this.proxies, this.resources]) {
      for (const [, node] of map) {
        destroyComputedNode(this, node);
      }
      map.clear();
    }
    // Destroy all atoms
    for (const [, node] of this.atoms) {
      destroyAtomNode(this, node);
    }
    // Destroy all lazy atoms
    for (const [, node] of this.lazyAtoms) {
      destroyAtomNode(this, node);
    }

    this.atoms.clear();
    this.lazyAtoms.clear();

    this.alive = false;
  }

  private assertAlive(): void {
    if (!this.alive) {
      throw new Error('Attempt to perform actions in a dead ReactiveDomain.');
    }
  }

  handleError(reason: unknown): void {
    if (this.options.onError) {
      this.options.onError(reason);
    } else {
      throw reason;
    }
  }

  onCreate<T>(source: ReadableSource<T> | WritableSource<T>): void {
    this.options?.onCreate?.(source);
  }

  onUpdate<T>(source: ReadableSource<T> | WritableSource<T>): void {
    this.options?.onUpdate?.(source);
  }

  onDestroy<T>(source: ReadableSource<T> | WritableSource<T>): void {
    this.options?.onDestroy?.(source);
  }

  getAtom<T>(source: Atom<T>): AtomNode<T> {
    this.assertAlive();
    const current = this.atoms.get(source.name);
    if (current) {
      return current;
    }
    const instance = new AtomNode(source);
    this.atoms.set(source.name, instance);
    this.onCreate(source);
    return instance;
  }

  private derivedNodes(
    source: DerivedSource<any>,
  ): Map<string, ComputedNode<any>> {
    switch (source.type) {
      case NodeType.Computed:
        return this.computeds;
      case NodeType.Proxy:
        return this.proxies;
      case NodeType.Resource:
        return this.resources;
    }
  }

  /** @internal */
  getDerived<T>(source: DerivedSource<T>): ComputedNode<T> {
    this.assertAlive();
    const nodes = this.derivedNodes(source);
    const current = nodes.get(source.name);
    if (current) {
      return current;
    }
    const instance = new ComputedNode(source);
    nodes.set(source.name, instance);
    this.onCreate(source);
    return instance;
  }

  getComputed<T>(source: Computed<T>): ComputedNode<T> {
    return this.getDerived(source);
  }

  getLazyAtom<T>(source: LazyAtom<T>): LazyAtomNode<T> {
    this.assertAlive();
    const current = this.lazyAtoms.get(source.name);
    if (current) {
      return current;
    }
    const instance = new LazyAtomNode(source);
    this.lazyAtoms.set(source.name, instance);
    this.onCreate(source);
    return instance;
  }

  readAtom<T>(source: Atom<T>): T {
    const instance = this.getAtom(source);
    return instance.value;
  }

  readComputed<T>(source: DerivedSource<T>): T {
    const instance = this.getDerived(source);
    revalidateComputed(this, instance);
    return readComputed(instance);
  }

  readLazyAtom<T>(source: LazyAtom<T>): T {
    const instance = this.getLazyAtom(source);
    return instance.value;
  }

  destroyAtom<T>(source: Atom<T>): void {
    const instance = this.getAtom(source);
    destroyAtomNode(this, instance);
    this.atoms.delete(source.name);
    this.onDestroy(source);
  }

  destroyComputed<T>(source: DerivedSource<T>): void {
    const instance = this.getDerived(source);
    destroyComputedNode(this, instance);
    this.derivedNodes(source).delete(source.name);
    this.onDestroy(source);
  }

  destroyLazyAtom<T>(source: LazyAtom<T>): void {
    const instance = this.getLazyAtom(source);
    destroyAtomNode(this, instance);
    this.lazyAtoms.delete(source.name);
    this.onDestroy(source);
  }

  get<T>(source: ReadableSource<T>): T {
    switch (source.type) {
      case NodeType.Atom:
        return this.readAtom(source);
      case NodeType.LazyAtom:
        return this.readLazyAtom(source);
      case NodeType.Computed:
      case NodeType.Proxy:
      case NodeType.Resource:
        return this.readComputed(source);
    }
  }

  set<T>(source: WritableSource<T>, value: T) {
    if (this.alive) {
      switch (source.type) {
        case NodeType.Atom:
          writeAtomNode(this, this.getAtom(source), value);
          break;
        case NodeType.LazyAtom:
          writeAtomNode(this, this.getLazyAtom(source), value);
          break;
        case NodeType.Proxy:
          source.write(createActionContext(this), value);
          break;
      }
    }
  }

  reset<T>(source: ReadableSource<T>): void {
    switch (source.type) {
      case NodeType.Atom:
        writeAtomNode(this, this.getAtom(source), source.initialValue);
        break;
      case NodeType.LazyAtom:
        writeAtomNode(this, this.getLazyAtom(source), source.initialValue());
        break;
      case NodeType.Computed:
      case NodeType.Proxy:
      case NodeType.Resource:
        updateComputed(this, this.getDerived(source));
        break;
    }
  }

  private destroyObserver<T>(instance: ObserverNode<T>): void {
    this.observers.delete(instance);
    destroyObserverNode(this, instance);
  }

  /** @internal */
  forgetObserver<T>(instance: ObserverNode<T>): void {
    this.observers.delete(instance);
  }

  private addObserver<T>(observer: ObserverNode<T>): Cleanup {
    this.assertAlive();
    const source = observer.source;

    // Track the source
    switch (source.type) {
      case NodeType.Atom:
        trackNode(observer.tracker, this.getAtom(source));
        break;
      case NodeType.LazyAtom:
        trackNode(observer.tracker, this.getLazyAtom(source));
        break;
      case NodeType.Computed:
      case NodeType.Proxy:
      case NodeType.Resource: {
        const instance = this.getDerived(source);
        // Initialize the computed before tracking it. The first evaluation
        // notifies its trackers, and this observer must not be one of them
        // yet, otherwise subscribing fires the callback.
        revalidateComputed(this, instance);
        trackNode(observer.tracker, instance);
        break;
      }
    }

    // The observer starts in sync with its source, so the next write marks it
    observer.tracker.state = State.Clean;

    // Add to active observers
    this.observers.add(observer);

    return (this.destroyObserver<T>).bind(this, observer);
  }

  /**
   * Calls `callback` with the source's value whenever it changes. The
   * subscription keeps the source alive until the returned cleanup is
   * called.
   */
  observe<T>(source: ReadableSource<T>, callback: (value: T) => void): Cleanup {
    return this.addObserver(new ObserverNode(source, callback, false));
  }

  /**
   * Like `observe`, except the subscription does not keep the source alive.
   * The source is released once nothing else tracks it, as if this observer
   * were not there, and the observer ends with it. Removing a weak observer
   * never releases anything.
   */
  observeWeak<T>(
    source: ReadableSource<T>,
    callback: (value: T) => void,
  ): Cleanup {
    return this.addObserver(new ObserverNode(source, callback, true));
  }

  getAction<T, R>(action: Action<T, R>): NormalAction<T, R> {
    return (bindAction<T, R>).bind(this, action);
  }
}

class TrackerContextInternal {
  alive = true;

  /**
   * Whether reads are recorded as dependencies. Only the synchronous part of
   * a computation is tracked: reads after an `await` happen once the run has
   * finished, so they are plain reads.
   */
  tracking = true;

  constructor(
    public domain: ReactiveDomain,
    public tracker: Tracker,
  ) {}

  readAtom<T>(source: Atom<T>): T {
    const instance = this.domain.getAtom(source);
    if (this.alive && this.tracking) {
      trackNode(this.tracker, instance);
    }
    return instance.value;
  }

  readLazyAtom<T>(source: LazyAtom<T>): T {
    const instance = this.domain.getLazyAtom(source);
    if (this.alive && this.tracking) {
      trackNode(this.tracker, instance);
    }
    return instance.value;
  }

  readComputed<T>(source: DerivedSource<T>): T {
    const instance = this.domain.getDerived(source);
    revalidateComputed(this.domain, instance);
    if (this.alive && this.tracking) {
      trackNode(this.tracker, instance);
    }
    return readComputed(instance);
  }

  get<T>(source: ReadableSource<T>): T {
    switch (source.type) {
      case NodeType.Atom:
        return this.readAtom(source);
      case NodeType.LazyAtom:
        return this.readLazyAtom(source);
      case NodeType.Computed:
      case NodeType.Proxy:
      case NodeType.Resource:
        return this.readComputed(source);
    }
  }

  set<T>(source: WritableSource<T>, value: T) {
    if (this.alive) {
      this.domain.set(source, value);
    }
  }

  reset<T>(source: ReadableSource<T>): void {
    if (this.alive) {
      this.domain.reset(source);
    }
  }

  private cleanups: Cleanup[] = [];

  onCleanup(cleanup: Cleanup): void {
    if (this.alive) {
      this.cleanups.push(cleanup);
    }
  }

  destroy() {
    if (this.alive) {
      this.alive = false;

      for (let i = 0, len = this.cleanups.length; i < len; i++) {
        this.cleanups[i]();
      }
    }
  }
}

type TrackableNode<T> = AtomNode<T> | ComputedNode<T> | LazyAtomNode<T>;
type TrackerNode<T> = ComputedNode<T> | ObserverNode<T>;

/**
 * A Tracker is just a fancy keyword for observables
 */
class Trackable {
  alive = true;
  version = 0;
  trackers: Set<Tracker> | undefined;

  constructor(public parent: TrackableNode<any>) {}
}

/**
 * A Tracker is just a fancy keyword for observers
 */
class Tracker {
  alive = true;
  state: State = State.Uninitialized;
  /**
   * Whether the tracker's computation is executing. Its dependencies are read
   * fresh while it runs, so their updates must not mark it again.
   */
  running = false;
  trackables: Set<Trackable> | undefined;
  context: TrackerContextInternal | undefined = undefined;

  constructor(
    public parent: TrackerNode<any>,
    /** A weak tracker does not keep what it tracks alive. */
    public weak = false,
  ) {}
}

class AtomNode<T> {
  type: NodeType.Atom = NodeType.Atom;

  trackable = new Trackable(this);

  value: T;

  constructor(public source: Atom<T>) {
    this.value = source.initialValue;
  }
}

class LazyAtomNode<T> {
  type: NodeType.LazyAtom = NodeType.LazyAtom;

  trackable = new Trackable(this);

  value: T;

  constructor(public source: LazyAtom<T>) {
    this.value = source.initialValue();
  }
}

type ComputedResult<T> =
  | { type: ComputedState.Pending; value: Promise<T> }
  | { type: ComputedState.Success; value: T }
  | { type: ComputedState.Failure; value: unknown };

/**
 * The node behind every derived source: computeds, proxy atoms and resources.
 */
class ComputedNode<T> {
  type: NodeType.Computed = NodeType.Computed;

  trackable = new Trackable(this);

  tracker = new Tracker(this);

  state: ComputedResult<T> | undefined;

  prev: Ref<T> | undefined;

  /**
   * Counts the runs, so a resource only accepts the result of its latest one.
   */
  run = 0;

  constructor(public source: DerivedSource<T>) {}
}

export type BaseOptions = {
  onError?: (value: unknown) => void;
};

class ObserverNode<T> {
  type: NodeType.Observer | NodeType.WeakObserver;

  tracker: Tracker;

  constructor(
    public source: ReadableSource<T>,
    public compute: (value: T) => void,
    weak: boolean,
    public options?: BaseOptions,
  ) {
    this.type = weak ? NodeType.WeakObserver : NodeType.Observer;
    this.tracker = new Tracker(this, weak);
  }
}

function addTrackable(node: Tracker, trackable: Trackable): void {
  if (!node.trackables) {
    node.trackables = new Set();
  }
  node.trackables.add(trackable);
}

function addTracker(node: Trackable, tracker: Tracker): void {
  if (!node.trackers) {
    node.trackers = new Set();
  }
  node.trackers.add(tracker);
}

/**
 * Detaches every tracker from a trackable that is going away. Observers of it
 * end, since there is nothing left for them to observe.
 */
function cleanTrackers(domain: ReactiveDomain, node: Trackable): void {
  if (!(node.trackers && node.trackers.size)) {
    return;
  }
  for (const tracker of [...node.trackers]) {
    if (tracker.trackables) {
      tracker.trackables.delete(node);
    }
    if (tracker.parent.type !== NodeType.Computed) {
      domain.forgetObserver(tracker.parent);
      destroyTracker(domain, tracker);
    }
  }
  node.trackers.clear();
}

function hasStrongTracker(node: Trackable): boolean {
  if (node.trackers) {
    for (const tracker of node.trackers) {
      if (!tracker.weak) {
        return true;
      }
    }
  }
  return false;
}

function releaseTrackable(
  domain: ReactiveDomain,
  node: Tracker,
  trackable: Trackable,
): void {
  if (!trackable.trackers) {
    return;
  }
  trackable.trackers.delete(node);

  // Once nothing keeps it alive, might as well destroy the node. Weak
  // trackers do not count, and letting go of one never releases anything.
  if (!node.weak && trackable.alive && !hasStrongTracker(trackable)) {
    switch (trackable.parent.type) {
      case NodeType.Atom:
        domain.destroyAtom(trackable.parent.source);
        break;
      case NodeType.Computed:
        domain.destroyComputed(trackable.parent.source);
        break;
      case NodeType.LazyAtom:
        domain.destroyLazyAtom(trackable.parent.source);
        break;
    }
  }
}

function cleanTrackables(domain: ReactiveDomain, node: Tracker): void {
  if (!(node.trackables && node.trackables.size)) {
    return;
  }
  for (const trackable of [...node.trackables]) {
    releaseTrackable(domain, node, trackable);
  }

  node.trackables.clear();
}

/**
 * Releases the trackables a tracker depended on before its latest run but did
 * not track again. Trackables that survived are left untouched, so a
 * recomputation never destroys a dependency it is about to reuse.
 */
function releaseUnusedTrackables(
  domain: ReactiveDomain,
  node: Tracker,
  previous: Set<Trackable> | undefined,
): void {
  if (!(previous && previous.size)) {
    return;
  }
  const current = node.trackables;
  for (const trackable of [...previous]) {
    if (!(current && current.has(trackable))) {
      releaseTrackable(domain, node, trackable);
    }
  }
}

function destroyTrackable(domain: ReactiveDomain, instance: Trackable): void {
  if (instance.alive) {
    instance.alive = false;
    cleanTrackers(domain, instance);
  }
}

function destroyTracker(domain: ReactiveDomain, instance: Tracker): void {
  if (instance.alive) {
    instance.alive = false;
    if (instance.context) {
      instance.context.destroy();
    }
    cleanTrackables(domain, instance);
  }
}

function destroyAtomNode<T>(
  domain: ReactiveDomain,
  node: AtomNode<T> | LazyAtomNode<T>,
): void {
  destroyTrackable(domain, node.trackable);
}
function destroyComputedNode<T>(
  domain: ReactiveDomain,
  node: ComputedNode<T>,
): void {
  destroyTracker(domain, node.tracker);
  destroyTrackable(domain, node.trackable);
}
function destroyObserverNode<T>(
  domain: ReactiveDomain,
  node: ObserverNode<T>,
): void {
  destroyTracker(domain, node.tracker);
}

function handleError(
  domain: ReactiveDomain,
  error: unknown,
  options?: BaseOptions,
): void {
  if (options?.onError) {
    try {
      options.onError(error);
    } catch (newError) {
      domain.handleError(error);
      domain.handleError(newError);
    }
  } else {
    domain.handleError(error);
  }
}

/**
 * Marks every node downstream of a trackable without evaluating anything:
 * direct trackers with the given state, and the trackers behind them as
 * maybe stale. Observers that become stale are queued, so they only run once
 * the whole graph is marked and each computed is pulled at most once.
 *
 * A trackable is marked when it was clean, so a node reachable through
 * several paths is visited once per write.
 */
function markTrackers(
  domain: ReactiveDomain,
  node: Trackable,
  state: State.Check | State.Dirty,
  skipRunning: boolean,
): void {
  if (!(node.alive && node.trackers && node.trackers.size)) {
    return;
  }
  for (const tracker of node.trackers) {
    if ((skipRunning && tracker.running) || tracker.state >= state) {
      continue;
    }
    const wasClean = tracker.state === State.Clean;
    tracker.state = state;
    if (wasClean) {
      if (tracker.parent.type === NodeType.Computed) {
        markTrackers(domain, tracker.parent.trackable, State.Check, false);
      } else {
        domain.pending.push(tracker.parent);
      }
    }
  }
}

/**
 * Revalidates the queued observers. Observers that write while the queue is
 * being flushed append to it instead of starting a nested flush. An observer
 * that throws does not stop the others, the first error is rethrown after.
 */
function flushObservers(domain: ReactiveDomain): void {
  if (domain.flushing) {
    return;
  }
  domain.flushing = true;
  let failed = false;
  let failure: unknown;
  try {
    for (let i = 0; i < domain.pending.length; i++) {
      try {
        revalidateObserver(domain, domain.pending[i]);
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
    }
  } finally {
    domain.pending = [];
    domain.flushing = false;
  }
  if (failed) {
    throw failure;
  }
}

/**
 * @param fromComputed the write is a computed taking a new value while it is
 * pulled, so the tracker reading it right now already sees that value.
 */
function writeTrackable(
  domain: ReactiveDomain,
  node: Trackable,
  fromComputed: boolean,
): void {
  if (node.alive) {
    node.version++;
    markTrackers(domain, node, State.Dirty, fromComputed);
    flushObservers(domain);
  }
}

function writeComputedSuccess<T>(
  domain: ReactiveDomain,
  node: ComputedNode<T>,
  value: T,
): void {
  if (
    node.state &&
    node.state.type === ComputedState.Success &&
    node.source.isEqual(node.state.value, value)
  ) {
    return;
  }
  node.prev = { value };
  node.state = { type: ComputedState.Success, value };
  writeTrackable(domain, node.trackable, true);
  domain.onUpdate(node.source);
}

function writeComputedFailure<T>(
  domain: ReactiveDomain,
  node: ComputedNode<T>,
  error: unknown,
): void {
  node.state = { type: ComputedState.Failure, value: error };
  writeTrackable(domain, node.trackable, true);
  domain.onUpdate(node.source);
}

function writeComputedPending<T>(
  domain: ReactiveDomain,
  node: ComputedNode<T>,
  request: Promise<T>,
): void {
  node.state = { type: ComputedState.Pending, value: request };
  writeTrackable(domain, node.trackable, true);
  domain.onUpdate(node.source);
}

function trackNode<T>(tracker: Tracker, node: TrackableNode<T>): void {
  addTrackable(tracker, node.trackable);
  addTracker(node.trackable, tracker);
}

function writeAtomNode<T>(
  domain: ReactiveDomain,
  node: AtomNode<T> | LazyAtomNode<T>,
  value: T,
): void {
  if (!node.source.isEqual(node.value, value)) {
    node.value = value;
    writeTrackable(domain, node.trackable, false);

    domain.onUpdate(node.source);
  }
}

function readComputed<T>(node: ComputedNode<T>): T {
  if (node.state) {
    if (node.state.type === ComputedState.Success) {
      // If the result succeeded, return
      return node.state.value;
    }
    if (node.state.type === ComputedState.Failure) {
      // ...otherwise, rethrow the error.
      throw node.state.value;
    }
    // A pending resource halts the reader, handing it the promise to wait on.
    throw new ResourceNotReadyError(node.state.value);
  }
  // This shouldn't happen at all
  throw new Error('Node is uninitialized.');
}

function createTrackerContext<T>(
  parent: TrackerContextInternal,
  previous: Ref<T> | undefined,
): TrackerContext<T> {
  return {
    get: parent.get.bind(parent),
    set: parent.set.bind(parent),
    reset: parent.reset.bind(parent),
    onCleanup: parent.onCleanup.bind(parent),
    previous,
  };
}

function updateTrackerContext<T>(
  domain: ReactiveDomain,
  node: Tracker,
  previous: Ref<T> | undefined,
): TrackerContext<T> {
  if (node.context) {
    node.context.destroy();
  }
  node.context = new TrackerContextInternal(domain, node);
  return createTrackerContext(node.context, previous);
}

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * Settles a resource with the outcome of its run, unless a newer run has
 * started or the node is gone by then.
 */
function settleResource<T>(
  domain: ReactiveDomain,
  node: ComputedNode<T>,
  run: number,
  request: PromiseLike<T>,
): void {
  const isCurrent = (): boolean =>
    node.run === run && node.trackable.alive && node.tracker.alive;
  request.then(
    value => {
      if (isCurrent()) {
        writeComputedSuccess(domain, node, value);
      }
    },
    (error: unknown) => {
      if (isCurrent()) {
        writeComputedFailure(domain, node, error);
      }
    },
  );
}

function updateComputed<T>(
  domain: ReactiveDomain,
  node: ComputedNode<T>,
): void {
  // Set aside the old dependencies and start collecting a fresh set. They are
  // only released after the recomputation, so dependencies that get tracked
  // again are never torn down in between.
  const previous = node.tracker.trackables;
  node.tracker.trackables = undefined;

  // Mark this node clean
  node.tracker.state = State.Clean;

  // A new run supersedes any promise an earlier run is still waiting on
  const run = ++node.run;

  // Attempt to recompute
  let result:
    | { type: ComputedState.Success; value: T | PromiseLike<T> }
    | { type: ComputedState.Failure; value: unknown };
  const context = updateTrackerContext(domain, node.tracker, node.prev);
  node.tracker.running = true;
  try {
    result = {
      type: ComputedState.Success,
      value: node.source.compute(context),
    };
  } catch (error) {
    result = { type: ComputedState.Failure, value: error };
  } finally {
    node.tracker.running = false;
    if (node.tracker.context) {
      node.tracker.context.tracking = false;
    }
  }
  if (result.type === ComputedState.Failure) {
    writeComputedFailure(domain, node, result.value);
  } else if (
    node.source.type === NodeType.Resource &&
    isPromiseLike<T>(result.value)
  ) {
    const request = Promise.resolve(result.value);
    writeComputedPending(domain, node, request);
    settleResource(domain, node, run, request);
  } else {
    writeComputedSuccess(domain, node, result.value as T);
  }

  releaseUnusedTrackables(domain, node.tracker, previous);
}

function updateObserver<T>(
  domain: ReactiveDomain,
  node: ObserverNode<T>,
): void {
  node.tracker.state = State.Clean;
  let value: T;
  node.tracker.running = true;
  try {
    value = domain.get(node.source);
  } catch (error) {
    // A pending resource is not an error. The observer runs once it settles.
    if (!(error instanceof ResourceNotReadyError)) {
      handleError(domain, error, node.options);
    }
    return;
  } finally {
    node.tracker.running = false;
  }
  try {
    node.compute(value);
  } catch (error) {
    handleError(domain, error, node.options);
  }
}

function isTrackerDirty(domain: ReactiveDomain, node: Tracker): boolean {
  // Check if one of the trackables are dirty
  if (node.trackables && node.trackables.size) {
    for (const trackable of [...node.trackables]) {
      if (trackable.parent.type === NodeType.Computed) {
        revalidateComputed(domain, trackable.parent);
      }
      if ((node as any).state === State.Dirty) {
        return true;
      }
    }
  }
  node.state = State.Clean;
  return false;
}

function canTrackerUpdate(domain: ReactiveDomain, node: Tracker): boolean {
  if (!node.alive) {
    return false;
  }
  switch (node.state) {
    case State.Clean:
      return false;
    case State.Check:
      return isTrackerDirty(domain, node);
    case State.Dirty:
    case State.Uninitialized:
      return true;
  }
}

function revalidateComputed<T>(
  domain: ReactiveDomain,
  node: ComputedNode<T>,
): void {
  if (canTrackerUpdate(domain, node.tracker)) {
    updateComputed(domain, node);
  }
}

function revalidateObserver<T>(
  domain: ReactiveDomain,
  node: ObserverNode<T>,
): void {
  if (canTrackerUpdate(domain, node.tracker)) {
    updateObserver(domain, node);
  }
}

export type Action<T, R> = ($: ActionContext, value: T) => R;
export type NormalAction<T, R> = (value: T) => R;

export function action<T, R>(callback: Action<T, R>) {
  return callback;
}

function createActionContext(domain: ReactiveDomain): ActionContext {
  return {
    get: domain.get.bind(domain),
    set: domain.set.bind(domain),
    reset: domain.reset.bind(domain),
  };
}

function bindAction<T, R>(
  this: ReactiveDomain,
  action: Action<T, R>,
  value: T,
): R {
  return action(createActionContext(this), value);
}
