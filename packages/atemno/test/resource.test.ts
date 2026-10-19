import { describe, expect, it, vi } from 'vitest';
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

describe('resource', () => {
  it('throws ResourceNotReadyError while pending, then returns the value', async () => {
    const domain = new ReactiveDomain({});
    const request = deferred<string>();
    const user = resource('user', () => request.promise);

    let thrown: unknown;
    try {
      domain.get(user);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ResourceNotReadyError);
    expect((thrown as ResourceNotReadyError).request).toBeInstanceOf(Promise);

    request.resolve('Ada');
    await settle();

    expect(domain.get(user)).toBe('Ada');
  });

  it('rethrows the rejection once it settles', async () => {
    const domain = new ReactiveDomain({});
    const user = resource('user', async () => {
      throw new Error('offline');
    });

    expect(() => domain.get(user)).toThrow(ResourceNotReadyError);
    await settle();

    expect(() => domain.get(user)).toThrow('offline');
  });

  it('treats a plain return value as already resolved', () => {
    const domain = new ReactiveDomain({});
    const greeting = resource('greeting', () => 'hello');

    expect(domain.get(greeting)).toBe('hello');
  });

  it('is lazy and runs once until a dependency changes', async () => {
    const domain = new ReactiveDomain({});
    const id = atom('id', 1);
    const fetchUser = vi.fn(async (value: number) => `user ${value}`);
    const user = resource<string>('user', $ => fetchUser($.get(id)));

    expect(fetchUser).not.toHaveBeenCalled();
    expect(() => domain.get(user)).toThrow(ResourceNotReadyError);
    await settle();
    expect(domain.get(user)).toBe('user 1');
    expect(fetchUser).toHaveBeenCalledTimes(1);

    domain.set(id, 2);
    expect(() => domain.get(user)).toThrow(ResourceNotReadyError);
    await settle();
    expect(domain.get(user)).toBe('user 2');
    expect(fetchUser).toHaveBeenCalledTimes(2);
  });

  it('ignores the result of a run that a newer run replaced', async () => {
    const domain = new ReactiveDomain({});
    const id = atom('id', 1);
    const requests = new Map<number, ReturnType<typeof deferred<string>>>();
    const user = resource<string>('user', $ => {
      const request = deferred<string>();
      requests.set($.get(id), request);
      return request.promise;
    });
    const seen: string[] = [];
    domain.observe(user, value => seen.push(value));

    domain.set(id, 2);
    requests.get(2)?.resolve('two');
    await settle();
    requests.get(1)?.resolve('one');
    await settle();

    expect(seen).toEqual(['two']);
    expect(domain.get(user)).toBe('two');
  });

  it('calls observers once it resolves, not while it is pending', async () => {
    const errors: unknown[] = [];
    const domain = new ReactiveDomain({ onError: error => errors.push(error) });
    const id = atom('id', 1);
    const user = resource<string>('user', async $ => `user ${$.get(id)}`);
    const seen: string[] = [];

    domain.observe(user, value => seen.push(value));
    await settle();
    domain.set(id, 2);
    await settle();

    expect(seen).toEqual(['user 1', 'user 2']);
    expect(errors).toEqual([]);
  });

  it('suspends computeds that read it until it resolves', async () => {
    const domain = new ReactiveDomain({});
    const user = resource('user', async () => 'Ada');
    const greeting = computed<string>('greeting', $ => `Hello, ${$.get(user)}`);
    const seen: string[] = [];
    domain.observe(greeting, value => seen.push(value));

    expect(() => domain.get(greeting)).toThrow(ResourceNotReadyError);
    await settle();

    expect(domain.get(greeting)).toBe('Hello, Ada');
    expect(seen).toEqual(['Hello, Ada']);
  });

  it('tracks only the reads made before the first await', async () => {
    const domain = new ReactiveDomain({});
    const id = atom('id', 1);
    const suffix = atom('suffix', 'a');
    const runs = vi.fn();
    const user = resource<string>('user', async $ => {
      runs();
      const value = $.get(id);
      await Promise.resolve();
      return `${value}${$.get(suffix)}`;
    });
    domain.observe(user, () => {});
    await settle();

    domain.set(suffix, 'b');
    await settle();
    expect(runs).toHaveBeenCalledTimes(1);

    domain.set(id, 2);
    await settle();
    expect(domain.get(user)).toBe('2b');
  });

  it('drops a late result once the node is released', async () => {
    const onUpdate = vi.fn();
    const domain = new ReactiveDomain({ onUpdate });
    const request = deferred<string>();
    const user = resource('user', () => request.promise);

    domain.observe(user, () => {})();
    request.resolve('late');
    await settle();

    // The pending state was the only update. The late result went nowhere.
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('reruns its cleanups before each run', async () => {
    const domain = new ReactiveDomain({});
    const id = atom('id', 1);
    const aborted: number[] = [];
    const user = resource<number>('user', $ => {
      const value = $.get(id);
      $.onCleanup(() => aborted.push(value));
      return Promise.resolve(value);
    });
    domain.observe(user, () => {});
    domain.set(id, 2);
    domain.set(id, 3);
    await settle();

    expect(aborted).toEqual([1, 2]);
  });
});
