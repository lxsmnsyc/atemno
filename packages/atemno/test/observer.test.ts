import { describe, expect, it, vi } from 'vitest';
import { atom, computed, ReactiveDomain } from '../src/graph';

function createDomain(): ReactiveDomain {
  return new ReactiveDomain({});
}

describe('observe', () => {
  it('does not fire on subscription to an atom', () => {
    const domain = createDomain();
    const count = atom('count', 0);
    const observer = vi.fn();

    domain.observe(count, observer);

    expect(observer).not.toHaveBeenCalled();
  });

  it('fires on every atom change', () => {
    const domain = createDomain();
    const count = atom('count', 0);
    const seen: number[] = [];

    domain.observe(count, value => seen.push(value));
    domain.set(count, 1);
    domain.set(count, 2);

    expect(seen).toEqual([1, 2]);
  });

  it('skips writes that produce an equal value', () => {
    const domain = createDomain();
    const count = atom('count', 0);
    const seen: number[] = [];

    domain.observe(count, value => seen.push(value));
    domain.set(count, 1);
    domain.set(count, 1);

    expect(seen).toEqual([1]);
  });

  it('fires on subscription to an uninitialized computed', () => {
    const domain = createDomain();
    const count = atom('count', 2);
    const double = computed<number>('double', $ => $.get(count) * 2);
    const seen: number[] = [];

    domain.observe(double, value => seen.push(value));

    expect(seen).toEqual([4]);
  });

  it('fires when a computed dependency changes', () => {
    const domain = createDomain();
    const count = atom('count', 0);
    const double = computed<number>('double', $ => $.get(count) * 2);
    const seen: number[] = [];

    domain.observe(double, value => seen.push(value));
    domain.set(count, 1);
    domain.set(count, 2);

    expect(seen).toEqual([0, 2, 4]);
  });

  it('does not fire when a computed produces an equal value', () => {
    const domain = createDomain();
    const count = atom('count', 0);
    const isEven = computed<boolean>('isEven', $ => $.get(count) % 2 === 0);
    const seen: boolean[] = [];

    domain.observe(isEven, value => seen.push(value));
    domain.set(count, 2);
    domain.set(count, 4);

    expect(seen).toEqual([true]);
  });

  it('propagates through a chain of computeds', () => {
    const domain = createDomain();
    const count = atom('count', 1);
    const double = computed<number>('double', $ => $.get(count) * 2);
    const quadruple = computed<number>('quadruple', $ => $.get(double) * 2);
    const seen: number[] = [];

    domain.observe(quadruple, value => seen.push(value));
    domain.set(count, 3);

    expect(seen).toEqual([4, 12]);
  });

  it('notifies every observer of the same atom', () => {
    const domain = createDomain();
    const count = atom('count', 0);
    const first: number[] = [];
    const second: number[] = [];

    domain.observe(count, value => first.push(value));
    domain.observe(count, value => second.push(value));
    domain.set(count, 1);

    expect(first).toEqual([1]);
    expect(second).toEqual([1]);
  });

  it('stops notifying after cleanup', () => {
    const domain = createDomain();
    const count = atom('count', 0);
    const seen: number[] = [];

    const stop = domain.observe(count, value => seen.push(value));
    domain.set(count, 1);
    stop();
    domain.set(count, 2);

    expect(seen).toEqual([1]);
  });

  it('releases the atom once its last observer goes away', () => {
    const destroyed: string[] = [];
    const domain = new ReactiveDomain({
      onDestroy: source => destroyed.push(source.name),
    });
    const count = atom('count', 0);

    const stop = domain.observe(count, () => {});
    domain.set(count, 9);
    stop();

    expect(destroyed).toEqual(['count']);
    // The node is gone, so the next read starts from the initial value again.
    expect(domain.get(count)).toBe(0);
  });

  it('routes observer errors to onError', () => {
    const errors: unknown[] = [];
    const domain = new ReactiveDomain({
      onError: reason => errors.push(reason),
    });
    const count = atom('count', 0);

    domain.observe(count, () => {
      throw new Error('boom');
    });
    domain.set(count, 1);

    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe('boom');
  });

  it('rethrows observer errors when no onError is given', () => {
    const domain = createDomain();
    const count = atom('count', 0);

    domain.observe(count, () => {
      throw new Error('boom');
    });

    expect(() => domain.set(count, 1)).toThrow('boom');
  });
});
