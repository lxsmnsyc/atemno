import { ResourceNotReadyError } from './graph';

export type Result<T> =
  | { type: 'pending'; request: Promise<unknown> }
  | { type: 'success'; value: T }
  | { type: 'failure'; value: unknown };

/**
 * Reads a value and describes what happened, without throwing: a pending
 * resource, a value, or an error.
 *
 * ```ts
 * const result = toResult(() => $.get(user));
 * ```
 */
export function toResult<T>(read: () => T): Result<T> {
  try {
    return { type: 'success', value: read() };
  } catch (error) {
    if (error instanceof ResourceNotReadyError) {
      return { type: 'pending', request: error.request };
    }
    return { type: 'failure', value: error };
  }
}

/**
 * Tells whether a read stopped at a pending resource. A read that throws any
 * other error is not pending, so use `toResult` to tell a failure apart.
 */
export function isPending(read: () => unknown): boolean {
  return toResult(read).type === 'pending';
}

type Unwrap<T> = T extends () => infer R ? R : never;

export type Results<T extends readonly (() => unknown)[]> = {
  -readonly [K in keyof T]: Result<Unwrap<T[K]>>;
};

export type Values<T extends readonly (() => unknown)[]> = {
  -readonly [K in keyof T]: Unwrap<T[K]>;
};

/**
 * Reads every value and returns one result for each. It never throws.
 */
export function waitForNone<const T extends readonly (() => unknown)[]>(
  reads: T,
): Results<T> {
  const results: Result<unknown>[] = [];
  for (let i = 0, len = reads.length; i < len; i++) {
    results.push(toResult(reads[i]));
  }
  return results as Results<T>;
}

/**
 * Returns every value once all of them have settled. It halts with a
 * `ResourceNotReadyError` while any is pending, and throws an
 * `AggregateError` once all have settled and any of them failed.
 */
export function waitForAll<const T extends readonly (() => unknown)[]>(
  reads: T,
): Values<T> {
  const results = waitForNone(reads) as Result<unknown>[];
  const values: unknown[] = [];
  const errors: unknown[] = [];
  const pending: Promise<unknown>[] = [];
  for (const result of results) {
    if (result.type === 'pending') {
      pending.push(result.request);
    } else if (result.type === 'success') {
      values.push(result.value);
    } else {
      errors.push(result.value);
    }
  }
  if (pending.length > 0) {
    throw new ResourceNotReadyError(Promise.all(pending));
  }
  if (errors.length > 0) {
    throw new AggregateError(errors);
  }
  return values as Values<T>;
}

/**
 * Returns the first value that resolved successfully. It halts while none
 * has and any is still pending, and throws an `AggregateError` once all of
 * them failed.
 */
export function waitForAny<T>(reads: readonly (() => T)[]): T {
  const errors: unknown[] = [];
  const pending: Promise<unknown>[] = [];
  for (const read of reads) {
    const result = toResult(read);
    if (result.type === 'success') {
      return result.value;
    }
    if (result.type === 'failure') {
      errors.push(result.value);
    } else {
      pending.push(result.request);
    }
  }
  if (pending.length > 0) {
    throw new ResourceNotReadyError(Promise.race(pending));
  }
  throw new AggregateError(errors);
}

/**
 * Returns the first value that settled, rethrowing it if it failed. It halts
 * while every one of them is pending.
 */
export function waitForRace<T>(reads: readonly (() => T)[]): T {
  const pending: Promise<unknown>[] = [];
  for (const read of reads) {
    const result = toResult(read);
    if (result.type === 'success') {
      return result.value;
    }
    if (result.type === 'failure') {
      throw result.value;
    }
    pending.push(result.request);
  }
  throw new ResourceNotReadyError(Promise.race(pending));
}
