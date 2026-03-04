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

export type ReadableSource<T> = Atom<T> | Computed<T> | LazyAtom<T>;
export type WritableSource<T> = Atom<T> | LazyAtom<T>;

export interface ActionContext {
  get<T>(source: ReadableSource<T>): T;
  set<T>(source: WritableSource<T>, value: T): void;
  reset<T>(source: ReadableSource<T>): void;
}

export interface TrackerContext<T> extends ActionContext {
  onCleanup(cleanup: Cleanup): void;
  previous: Ref<T> | undefined;
}
