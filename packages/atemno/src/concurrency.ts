import { computed, getContextDomain, ResourceNotReadyError } from './graph';
import { LRUMap } from './lru';
import type {
  Computed,
  IsEqual,
  ReadableSource,
  TrackerContext,
} from './types';
import { NodeType } from './types';

export type Result<T> =
  | { type: 'pending'; request: Promise<unknown> }
  | { type: 'success'; value: T }
  | { type: 'failure'; value: unknown };

type ValueOf<S> = S extends ReadableSource<infer T> ? T : never;

export type Results<S extends readonly ReadableSource<any>[]> = {
  -readonly [K in keyof S]: Result<ValueOf<S[K]>>;
};

export type Values<S extends readonly ReadableSource<any>[]> = {
  -readonly [K in keyof S]: ValueOf<S[K]>;
};

/**
 * Runs a read and describes what happened, without throwing.
 * @internal
 */
export function readResult<T>(read: () => T): Result<T> {
  try {
    return { type: 'success', value: read() };
  } catch (error) {
    if (error instanceof ResourceNotReadyError) {
      return { type: 'pending', request: error.request };
    }
    return { type: 'failure', value: error };
  }
}

/** @internal */
export function isSameResult<T>(previous: Result<T>, next: Result<T>): boolean {
  switch (next.type) {
    case 'pending':
      return previous.type === 'pending' && previous.request === next.request;
    case 'success':
    case 'failure':
      return (
        previous.type === next.type && Object.is(previous.value, next.value)
      );
  }
}

function isSameResults(
  previous: Result<unknown>[],
  next: Result<unknown>[],
): boolean {
  return (
    previous.length === next.length &&
    previous.every((result, index) => isSameResult(result, next[index]))
  );
}

function isSameValues(previous: unknown[], next: unknown[]): boolean {
  return (
    previous.length === next.length &&
    previous.every((value, index) => Object.is(value, next[index]))
  );
}

const KIND_NAMES: Record<ReadableSource<any>['type'], string> = {
  [NodeType.Atom]: 'atom',
  [NodeType.LazyAtom]: 'lazyAtom',
  [NodeType.Computed]: 'computed',
  [NodeType.Proxy]: 'proxy',
  [NodeType.Resource]: 'resource',
  [NodeType.Producer]: 'producer',
};

// The helpers build a computed per combination of sources. Its name is made
// from theirs, so the domain finds the same node for the same combination,
// and the description is cached so repeated calls, such as on every React
// render, hand back the same object. A cached description is only reused for
// the very same source objects, since it reads through them.
interface Description {
  sources: readonly ReadableSource<any>[];
  computed: Computed<any>;
}

const descriptions = new LRUMap<string, Description>(100);

function isSameSources(
  previous: readonly ReadableSource<any>[],
  next: readonly ReadableSource<any>[],
): boolean {
  return (
    previous.length === next.length &&
    previous.every((source, index) => source === next[index])
  );
}

function describe<T>(
  helper: string,
  sources: readonly ReadableSource<any>[],
  compute: ($: TrackerContext<T>) => T,
  isEqual: IsEqual<T>,
): Computed<T> {
  const names = sources.map(
    source => `${KIND_NAMES[source.type]}:${source.name}`,
  );
  const name = `${helper}(${names.join(', ')})`;
  const cached = descriptions.get(name);
  if (cached && isSameSources(cached.sources, sources)) {
    return cached.computed as Computed<T>;
  }
  const description = computed(name, compute, isEqual);
  descriptions.set(name, { sources: [...sources], computed: description });
  return description;
}

/**
 * Combines pending requests into one to wait on. A rejection is left to the
 * sources' own requests, so the combined one never goes unhandled.
 */
function settleAll(
  combine: (requests: Promise<unknown>[]) => Promise<unknown>,
  requests: Promise<unknown>[],
): ResourceNotReadyError {
  const request = combine(requests);
  request.catch(() => {});
  return new ResourceNotReadyError(request);
}

function readResults(
  $: TrackerContext<unknown>,
  sources: readonly ReadableSource<any>[],
): Result<unknown>[] {
  return sources.map(source => readResult(() => $.get(source)));
}

/**
 * A computed holding what reading `source` gives: a pending request, a value,
 * or an error. Reading it never throws.
 *
 * ```ts
 * domain.get(toResult(user)); // { type: 'pending', request }
 * ```
 */
export function toResult<T>(source: ReadableSource<T>): Computed<Result<T>> {
  return describe<Result<T>>(
    'toResult',
    [source],
    $ => readResult(() => $.get(source)),
    isSameResult,
  );
}

/**
 * A computed that is true while `source` is pending. A source that failed is
 * not pending, so use `toResult` to tell a failure apart.
 */
export function isPending(source: ReadableSource<any>): Computed<boolean> {
  return describe<boolean>(
    'isPending',
    [source],
    $ => readResult(() => $.get(source)).type === 'pending',
    Object.is,
  );
}

/**
 * A computed that is true while a resource created with `keepPrevious` reruns.
 * Reads of the resource return its previous value meanwhile, so `isPending`
 * stays false.
 */
export function isRefreshing(source: ReadableSource<any>): Computed<boolean> {
  return describe<boolean>(
    'isRefreshing',
    [source],
    $ => {
      // Reading tracks the source, so this reruns when its state changes.
      readResult(() => $.get(source));
      return getContextDomain($).isRefreshing(source);
    },
    Object.is,
  );
}

/**
 * A computed holding one result per source. Reading it never throws.
 */
export function waitForNone<const S extends readonly ReadableSource<any>[]>(
  sources: S,
): Computed<Results<S>> {
  return describe<Results<S>>(
    'waitForNone',
    sources,
    $ => readResults($, sources) as Results<S>,
    isSameResults as IsEqual<Results<S>>,
  );
}

/**
 * A computed holding every value once all sources resolved. It is pending
 * while any of them is, and throws an `AggregateError` once all have settled
 * and any of them failed.
 */
export function waitForAll<const S extends readonly ReadableSource<any>[]>(
  sources: S,
): Computed<Values<S>> {
  return describe<Values<S>>(
    'waitForAll',
    sources,
    $ => {
      const values: unknown[] = [];
      const errors: unknown[] = [];
      const pending: Promise<unknown>[] = [];
      for (const result of readResults($, sources)) {
        if (result.type === 'pending') {
          pending.push(result.request);
        } else if (result.type === 'success') {
          values.push(result.value);
        } else {
          errors.push(result.value);
        }
      }
      if (pending.length > 0) {
        throw settleAll(requests => Promise.all(requests), pending);
      }
      if (errors.length > 0) {
        throw new AggregateError(errors);
      }
      return values as Values<S>;
    },
    isSameValues as IsEqual<Values<S>>,
  );
}

/**
 * A computed holding the value of the first source that resolved. It is
 * pending while none has and any still is, and throws an `AggregateError`
 * once all of them failed.
 */
export function waitForAny<T>(
  sources: readonly ReadableSource<T>[],
): Computed<T> {
  return describe<T>(
    'waitForAny',
    sources,
    $ => {
      const errors: unknown[] = [];
      const pending: Promise<unknown>[] = [];
      for (const result of readResults($, sources) as Result<T>[]) {
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
        throw settleAll(requests => Promise.race(requests), pending);
      }
      throw new AggregateError(errors);
    },
    Object.is,
  );
}

/**
 * A computed holding the outcome of the first source that settled: its
 * value, or its error rethrown. It is pending while all of them are.
 */
export function waitForRace<T>(
  sources: readonly ReadableSource<T>[],
): Computed<T> {
  return describe<T>(
    'waitForRace',
    sources,
    $ => {
      const pending: Promise<unknown>[] = [];
      for (const result of readResults($, sources) as Result<T>[]) {
        if (result.type === 'success') {
          return result.value;
        }
        if (result.type === 'failure') {
          throw result.value;
        }
        pending.push(result.request);
      }
      throw settleAll(requests => Promise.race(requests), pending);
    },
    Object.is,
  );
}
