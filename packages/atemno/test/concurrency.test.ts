import { describe, expect, it } from 'vitest';
import {
  isPending,
  toResult,
  waitForAll,
  waitForAny,
  waitForNone,
  waitForRace,
} from '../src/concurrency';
import {
  atom,
  computed,
  ReactiveDomain,
  resource,
  ResourceNotReadyError,
} from '../src/graph';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve));
}

const ready = atom('ready', 'a');
const broken = computed<string>('broken', () => {
  throw new Error('no');
});

function pendingResource(name: string) {
  const request = deferred<string>();
  return { request, source: resource<string>(name, () => request.promise) };
}

describe('toResult', () => {
  it('describes a value, a failure and a pending source', () => {
    const domain = new ReactiveDomain({});
    const { source } = pendingResource('slow');

    expect(domain.get(toResult(ready))).toEqual({
      type: 'success',
      value: 'a',
    });
    expect(domain.get(toResult(broken))).toMatchObject({ type: 'failure' });
    expect(domain.get(toResult(source))).toMatchObject({ type: 'pending' });
  });

  it('follows the source as it settles', async () => {
    const domain = new ReactiveDomain({});
    const { request, source } = pendingResource('slow');
    const seen: string[] = [];
    domain.observe(toResult(source), result => seen.push(result.type));

    request.resolve('done');
    await settle();

    expect(seen).toEqual(['success']);
    expect(domain.get(toResult(source))).toEqual({
      type: 'success',
      value: 'done',
    });
  });

  it('returns the same description for the same source', () => {
    expect(toResult(ready)).toBe(toResult(ready));
    expect(toResult(ready).name).toBe('toResult(atom:ready)');
  });
});

describe('isPending', () => {
  it('is true only while the source is pending', async () => {
    const domain = new ReactiveDomain({});
    const { request, source } = pendingResource('slow');

    expect(domain.get(isPending(source))).toBe(true);
    expect(domain.get(isPending(broken))).toBe(false);
    expect(domain.get(isPending(ready))).toBe(false);

    request.resolve('done');
    await settle();
    expect(domain.get(isPending(source))).toBe(false);
  });
});

describe('waitForNone', () => {
  it('holds one result per source and never throws', () => {
    const domain = new ReactiveDomain({});
    const { source } = pendingResource('slow');

    const results = domain.get(waitForNone([ready, broken, source]));

    expect(results.map(result => result.type)).toEqual([
      'success',
      'failure',
      'pending',
    ]);
  });
});

describe('waitForAll', () => {
  it('holds every value once all resolved', async () => {
    const domain = new ReactiveDomain({});
    const first = pendingResource('first');
    const second = pendingResource('second');
    const both = waitForAll([first.source, second.source, ready]);

    expect(() => domain.get(both)).toThrow(ResourceNotReadyError);
    first.request.resolve('one');
    await settle();
    expect(() => domain.get(both)).toThrow(ResourceNotReadyError);
    second.request.resolve('two');
    await settle();

    expect(domain.get(both)).toEqual(['one', 'two', 'a']);
  });

  it('throws an AggregateError once all settled and one failed', () => {
    const domain = new ReactiveDomain({});

    expect(() => domain.get(waitForAll([ready, broken]))).toThrow(
      AggregateError,
    );
  });

  it('can be read inside a computed', async () => {
    const domain = new ReactiveDomain({});
    const first = resource<string>('first', async () => 'Ada');
    const last = resource<string>('last', async () => 'Lovelace');
    const full = computed<string>('full', $ =>
      $.get(waitForAll([first, last])).join(' '),
    );
    const seen: string[] = [];
    domain.observe(full, value => seen.push(value));

    expect(() => domain.get(full)).toThrow(ResourceNotReadyError);
    await settle();

    expect(domain.get(full)).toBe('Ada Lovelace');
    expect(seen).toEqual(['Ada Lovelace']);
  });

  it('does not leave an unhandled rejection behind', async () => {
    const domain = new ReactiveDomain({});
    const first = pendingResource('first');
    const second = pendingResource('second');
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);

    domain.observe(waitForAll([first.source, second.source]), () => {});
    first.request.reject(new Error('offline'));
    await settle();
    await settle();
    process.off('unhandledRejection', onUnhandled);

    expect(unhandled).toEqual([]);
  });
});

describe('waitForAny', () => {
  it('holds the first source in order that resolved', () => {
    const domain = new ReactiveDomain({});
    const { source } = pendingResource('slow');
    const other = atom('other', 'b');

    expect(domain.get(waitForAny([broken, source, other]))).toBe('b');
  });

  it('is pending while none resolved and one is pending', () => {
    const domain = new ReactiveDomain({});
    const { source } = pendingResource('slow');

    expect(() => domain.get(waitForAny([broken, source]))).toThrow(
      ResourceNotReadyError,
    );
  });

  it('throws an AggregateError once all failed', () => {
    const domain = new ReactiveDomain({});
    const other = computed<string>('other-broken', () => {
      throw new Error('also no');
    });

    expect(() => domain.get(waitForAny([broken, other]))).toThrow(
      AggregateError,
    );
  });
});

describe('waitForRace', () => {
  it('holds the first settled value, or rethrows its error', () => {
    const domain = new ReactiveDomain({});
    const { source } = pendingResource('slow');

    expect(domain.get(waitForRace([source, ready]))).toBe('a');
    expect(() => domain.get(waitForRace([source, broken]))).toThrow('no');
  });

  it('is pending while every source is', () => {
    const domain = new ReactiveDomain({});
    const first = pendingResource('first');
    const second = pendingResource('second');

    expect(() =>
      domain.get(waitForRace([first.source, second.source])),
    ).toThrow(ResourceNotReadyError);
  });
});
