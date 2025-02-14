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
  Effect = 2,
  Resource = 3,
  Observer = 4,
}

export const enum ComputedState {
  Pending = 1,
  Success = 2,
  Failure = 3,
}

export interface Ref<T> {
  value: T;
}

export const enum ScheduleType {
  Sync = 0,
  Idle = 1,
}
