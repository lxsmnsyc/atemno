import { IS_EQUAL } from './constants';
import type {
  ActionContext,
  Atom,
  Cleanup,
  Computation,
  Computed,
  IsEqual,
  LazyAtom,
  ReadableSource,
  Ref,
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

  private lazyAtoms = new Map<string, LazyAtomNode<any>>();

  private observers: (ObserverNode<any> | undefined)[] = [];

  private observersCount = 0;

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
    for (
      let i = 0,
        len = this.observersCount,
        observer: ObserverNode<any> | undefined;
      i < len;
      i++
    ) {
      observer = this.observers[i];
      if (observer) {
        destroyObserverNode(this, observer);
      }
    }
    // Destroy all computeds
    for (const [, node] of this.computeds) {
      destroyComputedNode(this, node);
    }
    // Destroy all atoms
    for (const [, node] of this.atoms) {
      destroyAtomNode(node);
    }
    // Destroy all lazy atoms
    for (const [, node] of this.lazyAtoms) {
      destroyAtomNode(node);
    }

    this.computeds.clear();
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

  getComputed<T>(source: Computed<T>): ComputedNode<T> {
    this.assertAlive();
    const current = this.computeds.get(source.name);
    if (current) {
      return current;
    }
    const instance = new ComputedNode(source);
    this.computeds.set(source.name, instance);
    this.onCreate(source);
    return instance;
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

  readComputed<T>(source: Computed<T>): T {
    const instance = this.getComputed(source);
    revalidateComputed(this, instance);
    return readComputed(instance);
  }

  readLazyAtom<T>(source: LazyAtom<T>): T {
    const instance = this.getLazyAtom(source);
    return instance.value;
  }

  destroyAtom<T>(source: Atom<T>): void {
    const instance = this.getAtom(source);
    destroyAtomNode(instance);
    this.atoms.delete(source.name);
    this.onDestroy(source);
  }

  destroyComputed<T>(source: Computed<T>): void {
    const instance = this.getComputed(source);
    destroyComputedNode(this, instance);
    this.computeds.delete(source.name);
    this.onDestroy(source);
  }

  destroyLazyAtom<T>(source: LazyAtom<T>): void {
    const instance = this.getLazyAtom(source);
    destroyAtomNode(instance);
    this.lazyAtoms.delete(source.name);
    this.onDestroy(source);
  }

  get<T>(source: ReadableSource<T>): T {
    switch (source.type) {
      case NodeType.Atom:
        return this.readAtom(source);
      case NodeType.Computed:
        return this.readComputed(source);
      case NodeType.LazyAtom:
        return this.readLazyAtom(source);
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
        updateComputed(this, this.getComputed(source));
        break;
    }
  }

  private destroyObserver<T>(index: number, instance: ObserverNode<T>): void {
    // TODO does order matter?
    this.observers[index] = this.observers[--this.observersCount];
    this.observers[this.observersCount] = undefined;
    destroyObserverNode(this, instance);
  }

  observe<T>(source: ReadableSource<T>, callback: (value: T) => void): Cleanup {
    this.assertAlive();
    // Create an observer node
    const observer = new ObserverNode(source, callback);

    // Track the source
    if (source.type === NodeType.Atom) {
      trackNode(observer.tracker, this.getAtom(source));
    } else if (source.type === NodeType.LazyAtom) {
      trackNode(observer.tracker, this.getLazyAtom(source));
    } else if (source.type === NodeType.Computed) {
      const instance = this.getComputed(source);
      // Initialize the computed before tracking it. The first evaluation
      // notifies its trackers, and this observer must not be one of them yet,
      // otherwise subscribing fires the callback.
      revalidateComputed(this, instance);
      trackNode(observer.tracker, instance);
    }

    // The observer starts in sync with its source, so the next write marks it
    observer.tracker.state = State.Clean;

    // Add to active observers
    this.observers.push(observer);

    return (this.destroyObserver<T>).bind(
      this,
      this.observersCount++,
      observer,
    );
  }

  getAction<T, R>(action: Action<T, R>): NormalAction<T, R> {
    return (bindAction<T, R>).bind(this, action);
  }
}

class TrackerContextInternal {
  alive = true;

  constructor(
    public domain: ReactiveDomain,
    public tracker: Tracker,
  ) {}

  readAtom<T>(source: Atom<T>): T {
    const instance = this.domain.getAtom(source);
    if (this.alive) {
      trackNode(this.tracker, instance);
    }
    return instance.value;
  }

  readLazyAtom<T>(source: LazyAtom<T>): T {
    const instance = this.domain.getLazyAtom(source);
    if (this.alive) {
      trackNode(this.tracker, instance);
    }
    return instance.value;
  }

  readComputed<T>(source: Computed<T>): T {
    const instance = this.domain.getComputed(source);
    revalidateComputed(this.domain, instance);
    if (this.alive) {
      trackNode(this.tracker, instance);
    }
    return readComputed(instance);
  }

  get<T>(source: ReadableSource<T>): T {
    switch (source.type) {
      case NodeType.Atom:
        return this.readAtom(source);
      case NodeType.Computed:
        return this.readComputed(source);
      case NodeType.LazyAtom:
        return this.readLazyAtom(source);
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

  constructor(public parent: TrackerNode<any>) {}
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

type SuccessResult<T> = { type: ComputedState.Success; value: T };

type ComputedResult<T> =
  | SuccessResult<T>
  | { type: ComputedState.Failure; value: unknown };

class ComputedNode<T> {
  type: NodeType.Computed = NodeType.Computed;

  trackable = new Trackable(this);

  tracker = new Tracker(this);

  state: ComputedResult<T> | undefined;

  prev: Ref<T> | undefined;

  constructor(public source: Computed<T>) {}
}

export type BaseOptions = {
  onError?: (value: unknown) => void;
};

class ObserverNode<T> {
  type: NodeType.Observer = NodeType.Observer;

  tracker = new Tracker(this);

  constructor(
    public source: ReadableSource<T>,
    public compute: (value: T) => void,
    public options?: BaseOptions,
  ) {}
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

function cleanTrackers(node: Trackable): void {
  if (!(node.trackers && node.trackers.size)) {
    return;
  }
  for (const tracker of [...node.trackers]) {
    if (tracker.trackables) {
      tracker.trackables.delete(node);
    }
  }
  node.trackers.clear();
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

  // If there's 0 trackers, might as well destroy the node
  if (trackable.alive && trackable.trackers.size === 0) {
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

function destroyTrackable(instance: Trackable): void {
  if (instance.alive) {
    instance.alive = false;
    cleanTrackers(instance);
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

function destroyAtomNode<T>(node: AtomNode<T> | LazyAtomNode<T>): void {
  destroyTrackable(node.trackable);
}
function destroyComputedNode<T>(
  domain: ReactiveDomain,
  node: ComputedNode<T>,
): void {
  destroyTracker(domain, node.tracker);
  destroyTrackable(node.trackable);
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

  // Attempt to recompute
  let result: ComputedResult<T>;
  node.tracker.running = true;
  try {
    result = {
      type: ComputedState.Success,
      value: node.source.compute(
        updateTrackerContext(domain, node.tracker, node.prev),
      ),
    };
  } catch (error) {
    result = { type: ComputedState.Failure, value: error };
  } finally {
    node.tracker.running = false;
  }
  if (result.type === ComputedState.Success) {
    writeComputedSuccess(domain, node, result.value);
  } else {
    writeComputedFailure(domain, node, result.value);
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
    handleError(domain, error, node.options);
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

function bindAction<T, R>(
  this: ReactiveDomain,
  action: Action<T, R>,
  value: T,
): R {
  const context: ActionContext = {
    get: this.get.bind(this),
    set: this.set.bind(this),
    reset: this.reset.bind(this),
  };
  return action(context, value);
}
