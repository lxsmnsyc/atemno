import { describe, expect, it } from 'vitest';
import { isPending, isRefreshing } from '../src/concurrency';
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

function createUser(keepPrevious: boolean) {
  const id = atom('id', 1);
  const requests: ReturnType<typeof deferred<string>>[] = [];
  const user = resource<string>(
    'user',
    $ => {
      $.get(id);
      const request = deferred<string>();
      requests.push(request);
      return request.promise;
    },
    { keepPrevious },
  );
  return { id, user, requests };
}

describe('keepPrevious', () => {
  it('is still pending on the first run', () => {
    const domain = new ReactiveDomain({});
    const { user } = createUser(true);

    expect(() => domain.get(user)).toThrow(ResourceNotReadyError);
    expect(domain.get(isRefreshing(user))).toBe(false);
  });

  it('returns the previous value while a rerun is pending', async () => {
    const domain = new ReactiveDomain({});
    const { id, user, requests } = createUser(true);
    domain.observe(user, () => {});
    requests[0].resolve('one');
    await settle();

    domain.set(id, 2);

    expect(domain.get(user)).toBe('one');
    expect(domain.get(isPending(user))).toBe(false);
    expect(domain.get(isRefreshing(user))).toBe(true);

    requests[1].resolve('two');
    await settle();

    expect(domain.get(user)).toBe('two');
    expect(domain.get(isRefreshing(user))).toBe(false);
  });

  it('ends the refresh even when the new value is equal', async () => {
    const domain = new ReactiveDomain({});
    const { id, user, requests } = createUser(true);
    const refreshing: boolean[] = [];
    domain.observe(isRefreshing(user), value => refreshing.push(value));
    requests[0].resolve('same');
    await settle();

    domain.set(id, 2);
    requests[1].resolve('same');
    await settle();

    expect(refreshing).toEqual([true, false]);
  });

  it('replaces the previous value with a rejection', async () => {
    const domain = new ReactiveDomain({});
    const { id, user, requests } = createUser(true);
    domain.observe(user, () => {});
    requests[0].resolve('one');
    await settle();

    domain.set(id, 2);
    requests[1].reject(new Error('offline'));
    await settle();

    expect(() => domain.get(user)).toThrow('offline');
    expect(domain.get(isRefreshing(user))).toBe(false);
  });

  it('keeps computeds reading it on the previous value', async () => {
    const domain = new ReactiveDomain({});
    const { id, user, requests } = createUser(true);
    const greeting = computed<string>('greeting', $ => `Hello, ${$.get(user)}`);
    const seen: string[] = [];
    domain.observe(greeting, value => seen.push(value));
    requests[0].resolve('Ada');
    await settle();

    domain.set(id, 2);
    expect(domain.get(greeting)).toBe('Hello, Ada');

    requests[1].resolve('Grace');
    await settle();

    expect(seen).toEqual(['Hello, Ada', 'Hello, Grace']);
  });

  it('goes back to pending without the option', async () => {
    const domain = new ReactiveDomain({});
    const { id, user, requests } = createUser(false);
    domain.observe(user, () => {});
    requests[0].resolve('one');
    await settle();

    domain.set(id, 2);

    expect(() => domain.get(user)).toThrow(ResourceNotReadyError);
    expect(domain.get(isRefreshing(user))).toBe(false);
  });

  it('still accepts an equality check as the third argument', async () => {
    const domain = new ReactiveDomain({});
    const items = resource<number[]>(
      'items',
      async () => [1, 2],
      (a, b) => a.join() === b.join(),
    );

    expect(items.keepPrevious).toBe(false);
    domain.observe(items, () => {});
    await settle();
    expect(domain.get(items)).toEqual([1, 2]);
  });

  it('is false for sources that are not resources', () => {
    const domain = new ReactiveDomain({});
    const count = atom('count', 0);

    expect(domain.get(isRefreshing(count))).toBe(false);
  });
});
