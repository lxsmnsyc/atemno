export type Cleanup = () => void;

export type IsEqual<T> = (prev: T, next: T) => boolean;

export const enum State {
  /**
   * The trackable is clean, no revalidations needed and values can
   * be safely reused
   */
  Clean = 0,
  /**
   * The trackable may or may not be dirty, check first.
   */
  Check = 1,
  /**
   * The trackable is dirty, revalidate immediately.
   */
  Dirty = 2,
  /**
   * The trackable/tracker is uninitialized, revalidate regardless.
   */
  Uninitialized = 3,
}

export const enum NodeType {
  Atom = 0,
  Computed = 1,
  Resource = 2,
  Observer = 3,
  LazyAtom = 4,
  Proxy = 5,
  Producer = 6,
  WeakObserver = 7,
}

export const enum ComputedState {
  Pending = 1,
  Success = 2,
  Failure = 3,
}

export interface Ref<T> {
  value: T;
}

export interface Atom<T> {
  type: NodeType.Atom;
  name: string;
  initialValue: T;
  isEqual: IsEqual<T>;
}

export interface LazyAtom<T> {
  type: NodeType.LazyAtom;
  name: string;
  initialValue: () => T;
  isEqual: IsEqual<T>;
}

export type Computation<T> = ($: TrackerContext<T>) => T;

export interface Computed<T> {
  type: NodeType.Computed;
  name: string;
  compute: Computation<T>;
  isEqual: IsEqual<T>;
}

/**
 * Writes a proxy atom's value through to the sources it is derived from.
 */
export type ProxyWrite<T> = ($: ActionContext, value: T) => void;

export interface ProxyAtom<T> {
  type: NodeType.Proxy;
  name: string;
  compute: Computation<T>;
  write: ProxyWrite<T>;
  isEqual: IsEqual<T>;
}

/**
 * A computation that may return a promise. Only the reads made before the
 * first `await` are tracked.
 */
export type ResourceComputation<T> = ($: TrackerContext<T>) => T | Promise<T>;

export interface ResourceOptions<T> {
  isEqual?: IsEqual<T>;
  /**
   * While a rerun is pending, reads return the last resolved value instead of
   * throwing a `ResourceNotReadyError`. The first run is still pending.
   */
  keepPrevious?: boolean;
}

export interface Resource<T> {
  type: NodeType.Resource;
  name: string;
  compute: ResourceComputation<T>;
  isEqual: IsEqual<T>;
  keepPrevious: boolean;
}

/**
 * Starts feeding a producer from an outside source. Call `set` with each new
 * value, and return a function that stops the feed.
 */
export type ProducerSetup<T> = (
  set: (value: T) => void,
  get: () => T,
) => Cleanup | void;

export interface Producer<T> {
  type: NodeType.Producer;
  name: string;
  initialValue: T;
  setup: ProducerSetup<T>;
  isEqual: IsEqual<T>;
}

/** The sources a domain evaluates from other sources. */
export type DerivedSource<T> = Computed<T> | ProxyAtom<T> | Resource<T>;

export type ReadableSource<T> =
  | Atom<T>
  | Computed<T>
  | LazyAtom<T>
  | ProxyAtom<T>
  | Resource<T>
  | Producer<T>;
export type WritableSource<T> = Atom<T> | LazyAtom<T> | ProxyAtom<T>;

export interface ActionContext {
  get<T>(source: ReadableSource<T>): T;
  set<T>(source: WritableSource<T>, value: T): void;
  reset<T>(source: ReadableSource<T>): void;
}

export interface TrackerContext<T> extends ActionContext {
  /** Reads a source without making it a dependency. */
  peek<V>(source: ReadableSource<V>): V;
  onCleanup(cleanup: Cleanup): void;
  previous: Ref<T> | undefined;
}
