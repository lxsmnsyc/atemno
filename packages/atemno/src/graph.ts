import { IS_EQUAL } from './constants';
import type {
  ActionContext,
  Atom,
  Cleanup,
  Computation,
  Computed,
  IsEqual,
  Ref,
  TrackerContext,
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

export interface ReactiveDomainOptions {
  /**
   * A default error handler that catches unhandled errors
   * from computeds and observers
   * @param reason the error cause
   */
  onError?: (reason: unknown) => void;
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

  private observers: (ObserverNode<any> | undefined)[] = [];

  private observersCount = 0;

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

    this.computeds.clear();
    this.atoms.clear();

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

  getAtom<T>(source: Atom<T>): AtomNode<T> {
    this.assertAlive();
    const current = this.atoms.get(source.name);
    if (current) {
      return current;
    }
    const instance = new AtomNode(source);
    this.atoms.set(source.name, instance);
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

  destroyAtom<T>(source: Atom<T>): void {
    const instance = this.getAtom(source);
    destroyAtomNode(instance);
    this.atoms.delete(source.name);
  }

  destroyComputed<T>(source: Computed<T>): void {
    const instance = this.getComputed(source);
    destroyComputedNode(this, instance);
    this.computeds.delete(source.name);
  }

  get<T>(source: Atom<T> | Computed<T>): T {
    if (source.type === NodeType.Atom) {
      return this.readAtom(source);
    }
    return this.readComputed(source);
  }

  set<T>(source: Atom<T>, value: T) {
    if (this.alive) {
      const instance = this.getAtom(source);
      writeAtomNode(this, instance, value);
    }
  }

  reset<T>(source: Atom<T> | Computed<T>): void {
    if (source.type === NodeType.Atom) {
      const instance = this.getAtom(source);
      writeAtomNode(this, instance, source.initialValue);
    } else {
      const instance = this.getComputed(source);
      updateComputed(this, instance);
    }
  }

  private destroyObserver<T>(index: number, instance: ObserverNode<T>): void {
    // TODO does order matter?
    this.observers[index] = this.observers[--this.observersCount];
    this.observers[this.observersCount] = undefined;
    destroyObserverNode(this, instance);
  }

  observe<T>(
    source: Atom<T> | Computed<T>,
    callback: (value: T) => void,
  ): Cleanup {
    this.assertAlive();
    // Create an observer node
    const observer = new ObserverNode(source, callback);

    // Track the source
    if (source.type === NodeType.Atom) {
      trackNode(observer.tracker, this.getAtom(source));
    } else if (source.type === NodeType.Computed) {
      const instance = this.getComputed(source);
      trackNode(observer.tracker, instance);
      // Ensure that the computed has been initialized
      // so that the observer is recognized before
      // tracking
      revalidateComputed(this, instance);
    }

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

  readComputed<T>(source: Computed<T>): T {
    const instance = this.domain.getComputed(source);
    revalidateComputed(this.domain, instance);
    if (this.alive) {
      trackNode(this.tracker, instance);
    }
    return readComputed(instance);
  }

  get<T>(source: Atom<T> | Computed<T>): T {
    if (source.type === NodeType.Atom) {
      return this.readAtom(source);
    }
    return this.readComputed(source);
  }

  set<T>(source: Atom<T>, value: T) {
    if (this.alive) {
      const instance = this.domain.getAtom(source);
      writeAtomNode(this.domain, instance, value);
    }
  }

  reset<T>(source: Atom<T> | Computed<T>): void {
    if (this.alive) {
      if (source.type === NodeType.Atom) {
        const instance = this.domain.getAtom(source);
        writeAtomNode(this.domain, instance, source.initialValue);
      } else {
        const instance = this.domain.getComputed(source);
        updateComputed(this.domain, instance);
      }
    }
  }

  private cleanups: Cleanup[] = [];

  onCleanup(cleanup: Cleanup): void {
    this.cleanups.push(cleanup);
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

type TrackableNode<T> = AtomNode<T> | ComputedNode<T>;
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
    public source: Atom<T> | Computed<T>,
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

function cleanTrackables(domain: ReactiveDomain, node: Tracker): void {
  if (!(node.trackables && node.trackables.size)) {
    return;
  }
  for (const trackable of [...node.trackables]) {
    if (trackable.trackers) {
      trackable.trackers.delete(node);

      // If there's 0 trackers, might as well destroy the node
      if (trackable.trackers.size === 0) {
        if (trackable.parent.type === NodeType.Atom) {
          domain.destroyAtom(trackable.parent.source);
        } else {
          domain.destroyComputed(trackable.parent.source);
        }
      }
    }
  }

  node.trackables.clear();
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

function destroyAtomNode<T>(node: AtomNode<T>): void {
  destroyTrackable(node.trackable);
}
function destroyComputedNode<T>(domain: ReactiveDomain, node: ComputedNode<T>): void {
  destroyTracker(domain, node.tracker);
  destroyTrackable(node.trackable);
}
function destroyObserverNode<T>(domain: ReactiveDomain, node: ObserverNode<T>): void {
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

function notifyTrackers(
  domain: ReactiveDomain,
  node: Trackable,
  state: State,
): void {
  if (!(node.alive && node.trackers && node.trackers.size)) {
    return;
  }
  const trackers = [...node.trackers];
  // Mark trackers with the new state
  for (const tracker of trackers) {
    tracker.state = state;
  }
  // 1st step, notify each tracker with the new state
  // This is a recursive process, which defers
  // any observers from immediately occuring
  for (const tracker of trackers) {
    if (tracker.parent.type === NodeType.Computed) {
      notifyTrackers(domain, tracker.parent.trackable, State.Check);
    }
  }
  // 2nd step, run the observers.
  for (const tracker of trackers) {
    if (tracker.parent.type === NodeType.Observer) {
      revalidateObserver(domain, tracker.parent);
    }
  }
}

function writeTrackable(
  domain: ReactiveDomain,
  node: Trackable,
  notify: boolean,
): void {
  if (node.alive) {
    node.version++;
    if (notify) {
      notifyTrackers(domain, node, State.Dirty);
    }
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
}

function writeComputedFailure<T>(
  domain: ReactiveDomain,
  node: ComputedNode<T>,
  error: unknown,
): void {
  node.state = { type: ComputedState.Failure, value: error };
  writeTrackable(domain, node.trackable, true);
}

function trackNode<T>(tracker: Tracker, node: TrackableNode<T>): void {
  addTrackable(tracker, node.trackable);
  addTracker(node.trackable, tracker);
}

function writeAtomNode<T>(
  domain: ReactiveDomain,
  node: AtomNode<T>,
  value: T,
): void {
  if (!node.source.isEqual(node.value, value)) {
    node.value = value;
    writeTrackable(domain, node.trackable, true);
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

function createTrackerContext(parent: TrackerContextInternal): TrackerContext {
  return {
    get: parent.get.bind(parent),
    set: parent.set.bind(parent),
    reset: parent.reset.bind(parent),
    onCleanup: parent.onCleanup.bind(parent),
  };
}

function updateTrackerContext(
  domain: ReactiveDomain,
  node: Tracker,
): TrackerContext {
  if (node.context) {
    node.context.destroy();
  }
  node.context = new TrackerContextInternal(domain, node);
  return createTrackerContext(node.context);
}

function updateComputed<T>(
  domain: ReactiveDomain,
  node: ComputedNode<T>,
): void {
  // Mark this node clean
  cleanTrackables(domain, node.tracker);
  node.tracker.state = State.Clean;

  // Attempt to recompute
  try {
    writeComputedSuccess(
      domain,
      node,
      node.source.compute(
        updateTrackerContext(domain, node.tracker),
        node.prev,
      ),
    );
  } catch (error) {
    writeComputedFailure(domain, node, error);
  }
}

function updateObserver<T>(
  domain: ReactiveDomain,
  node: ObserverNode<T>,
): void {
  node.tracker.state = State.Clean;
  try {
    const type = node.source.type;
    if (type === NodeType.Atom) {
      const instance = domain.getAtom(node.source);
      node.compute(instance.value);
    } else if (type === NodeType.Computed) {
      const instance = domain.getComputed(node.source);
      revalidateComputed(domain, instance);
      node.compute(readComputed(instance));
    }
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
