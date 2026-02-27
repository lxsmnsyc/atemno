import { IS_EQUAL } from './constants';
import type { Cleanup, IsEqual, Ref } from './types';
import { ComputedState, NodeType, State } from './types';

type TrackableNode<T> = AtomNode<T> | ComputedNode<T>;
type TrackerNode<T> = ComputedNode<T> | ObserverNode<T>;

let ID = 0;

function getID(): number {
  return ID++;
}

export interface AtomOptions<T> {
  name?: string;
  isEqual?: IsEqual<T>;
}

export interface Atom<T> {
  type: NodeType.Atom;
  name: string;
  initialValue: T;
  isEqual: IsEqual<T>;
}

export function atom<T>(
  initialValue: T,
  options: AtomOptions<T> = {},
): Atom<T> {
  return {
    type: NodeType.Atom,
    name: options.name || `atom-${getID()}`,
    initialValue,
    isEqual: IS_EQUAL,
  };
}

export interface ComputedOptions<T> {
  name?: string;
  isEqual?: IsEqual<T>;
}

export interface Computed<T> {
  type: NodeType.Computed;
  name: string;
  compute: Computation<T>;
  isEqual: IsEqual<T>;
}

export function computed<T>(
  compute: Computation<T>,
  options: ComputedOptions<T> = {},
): Computed<T> {
  return {
    type: NodeType.Computed,
    name: options.name || `computed-${getID()}`,
    compute,
    isEqual: IS_EQUAL,
  };
}

export interface ReactiveDomainOptions {
  onError?: (reason: unknown) => void;
}

export class ReactiveDomain {
  private alive = true;

  private atoms = new Map<Atom<any>, AtomNode<any>>();

  private computeds = new Map<Computed<any>, ComputedNode<any>>();

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
        destroyObserverNode(observer);
      }
    }
    // Destroy all computeds
    for (const [, node] of this.computeds) {
      destroyComputedNode(node);
    }
    // Destroy all atoms
    for (const [, node] of this.atoms) {
      destroyAtomNode(node);
    }
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
    const current = this.atoms.get(source);
    if (current) {
      return current;
    }
    const instance = new AtomNode(source);
    this.atoms.set(source, instance);
    return instance;
  }

  getComputed<T>(source: Computed<T>): ComputedNode<T> {
    this.assertAlive();
    const current = this.computeds.get(source);
    if (current) {
      return current;
    }
    const instance = new ComputedNode(source);
    this.computeds.set(source, instance);
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

  private destroyObserver<T>(index: number, instance: ObserverNode<T>): void {
    // TODO does order matter?
    this.observers[index] = this.observers[--this.observersCount];
    this.observers[this.observersCount] = undefined;
    destroyObserverNode(instance);
  }

  observe<T>(
    source: Atom<T> | Computed<T>,
    callback: (value: T) => void,
  ): Cleanup {
    this.assertAlive();
    const instance = new ObserverNode(source, callback);
    revalidateObserver(this, instance);
    if (source.type === NodeType.Atom) {
      trackNode(instance.tracker, this.getAtom(source));
    } else if (source.type === NodeType.Computed) {
      trackNode(instance.tracker, this.getComputed(source));
    }
    this.observers.push(instance);
    return (this.destroyObserver<T>).bind(
      this,
      this.observersCount++,
      instance,
    );
  }
}

export class TrackerContext {
  constructor(private parent: TrackerContextInternal) {}

  get<T>(source: Atom<T> | Computed<T>): T {
    return this.parent.get(source);
  }

  set<T>(source: Atom<T>, value: T): void {
    this.parent.set(source, value);
  }

  onCleanup(cleanup: Cleanup): void {
    this.parent.onCleanup(cleanup);
  }
}

class TrackerContextInternal {
  alive = true;

  child = new TrackerContext(this);

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

export type Computation<T> = ($: TrackerContext, prev: Ref<T> | undefined) => T;

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

function cleanTrackables(node: Tracker): void {
  if (!(node.trackables && node.trackables.size)) {
    return;
  }
  for (const trackable of [...node.trackables]) {
    if (trackable.trackers) {
      trackable.trackers.delete(node);
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

function destroyTracker(instance: Tracker): void {
  if (instance.alive) {
    instance.alive = false;
    if (instance.context) {
      instance.context.destroy();
    }
    cleanTrackables(instance);
  }
}

function destroyAtomNode<T>(node: AtomNode<T>): void {
  destroyTrackable(node.trackable);
}
function destroyComputedNode<T>(node: ComputedNode<T>): void {
  destroyTracker(node.tracker);
  destroyTrackable(node.trackable);
}
function destroyObserverNode<T>(node: ObserverNode<T>): void {
  destroyTracker(node.tracker);
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

function updateTrackerContext(
  domain: ReactiveDomain,
  node: Tracker,
): TrackerContext {
  if (node.context) {
    node.context.destroy();
  }
  node.context = new TrackerContextInternal(domain, node);
  return node.context.child;
}

function updateComputed<T>(
  domain: ReactiveDomain,
  node: ComputedNode<T>,
): void {
  cleanTrackables(node.tracker);
  node.tracker.state = State.Clean;
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
