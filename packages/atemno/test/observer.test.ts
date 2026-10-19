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

  it('does not fire on subscription to an uninitialized computed', () => {
    const domain = createDomain();
    const count = atom('count', 2);
    const double = computed<number>('double', $ => $.get(count) * 2);
    const seen: number[] = [];

    domain.observe(double, value => seen.push(value));

    expect(seen).toEqual([]);
  });

  it('does not fire on subscription to an already-read computed', () => {
    const domain = createDomain();
    const count = atom('count', 2);
    const double = computed<number>('double', $ => $.get(count) * 2);
    const seen: number[] = [];

    domain.get(double);
    domain.observe(double, value => seen.push(value));

    expect(seen).toEqual([]);
  });

  it('evaluates the computed on subscription so later changes are detected', () => {
    const domain = createDomain();
    const count = atom('count', 2);
    let runs = 0;
    const double = computed<number>('double', $ => {
      runs++;
      return $.get(count) * 2;
    });

    domain.observe(double, () => {});

    expect(runs).toBe(1);
  });

  it('fires when a computed dependency changes', () => {
    const domain = createDomain();
    const count = atom('count', 0);
    const double = computed<number>('double', $ => $.get(count) * 2);
    const seen: number[] = [];

    domain.observe(double, value => seen.push(value));
    domain.set(count, 1);
    domain.set(count, 2);

    expect(seen).toEqual([2, 4]);
  });

  it('does not fire when a computed produces an equal value', () => {
    const domain = createDomain();
    const count = atom('count', 0);
    const isEven = computed<boolean>('isEven', $ => $.get(count) % 2 === 0);
    const seen: boolean[] = [];

    domain.observe(isEven, value => seen.push(value));
    domain.set(count, 2);
    domain.set(count, 4);

    expect(seen).toEqual([]);

    domain.set(count, 3);
    expect(seen).toEqual([false]);
  });

  it('propagates through a chain of computeds', () => {
    const domain = createDomain();
    const count = atom('count', 1);
    const double = computed<number>('double', $ => $.get(count) * 2);
    const quadruple = computed<number>('quadruple', $ => $.get(double) * 2);
    const seen: number[] = [];

    domain.observe(quadruple, value => seen.push(value));
    domain.set(count, 3);

    expect(seen).toEqual([12]);
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
  it('runs each computed in an observed diamond once per write', () => {
    const domain = createDomain();
    const runs = { b: 0, c: 0, d: 0 };
    const a = atom('a', 1);
    const b = computed<number>('b', $ => {
      runs.b++;
      return $.get(a) + 1;
    });
    const c = computed<number>('c', $ => {
      runs.c++;
      return $.get(a) * 2;
    });
    const d = computed<number>('d', $ => {
      runs.d++;
      return $.get(b) + $.get(c);
    });
    const seen: number[] = [];
    domain.observe(d, value => seen.push(value));
    runs.b = runs.c = runs.d = 0;

    domain.set(a, 2);
    domain.set(a, 3);

    expect(runs).toEqual({ b: 2, c: 2, d: 2 });
    expect(seen).toEqual([7, 10]);
  });

  it('runs a deep diamond once per write', () => {
    const domain = createDomain();
    let tailRuns = 0;
    const a = atom('a', 0);
    const left = computed<number>('left', $ => $.get(a) + 1);
    const right = computed<number>('right', $ => $.get(a) - 1);
    const leftDeep = computed<number>('left-deep', $ => $.get(left) * 10);
    const join = computed<number>(
      'join',
      $ => $.get(leftDeep) + $.get(right) + $.get(a),
    );
    const tail = computed<number>('tail', $ => {
      tailRuns++;
      return $.get(join);
    });
    const seen: number[] = [];
    domain.observe(tail, value => seen.push(value));
    domain.observe(join, () => {});
    tailRuns = 0;

    domain.set(a, 1);

    expect(tailRuns).toBe(1);
    expect(seen).toEqual([21]);
  });

  it('only shows observers settled values', () => {
    const domain = createDomain();
    const first = atom('first', 'Ada');
    const last = atom('last', 'Lovelace');
    const upper = computed<string>('upper', $ => $.get(first).toUpperCase());
    const full = computed<string>(
      'full',
      $ => `${$.get(first)} ${$.get(last)} (${$.get(upper)})`,
    );
    const seen: string[] = [];
    domain.observe(full, value => seen.push(value));

    domain.set(first, 'Grace');

    expect(seen).toEqual(['Grace Lovelace (GRACE)']);
  });

  it('fires observers of a computed that is reset', () => {
    const domain = createDomain();
    let tick = 0;
    const clock = computed<number>('clock', () => ++tick);
    const seen: number[] = [];
    domain.observe(clock, value => seen.push(value));

    domain.reset(clock);

    expect(seen).toEqual([2]);
  });

  it('keeps propagating after an observer throws', () => {
    const domain = createDomain();
    const count = atom('count', 0);
    const seen: number[] = [];
    domain.observe(count, value => {
      if (value === 1) {
        throw new Error('boom');
      }
      seen.push(value);
    });

    expect(() => domain.set(count, 1)).toThrow('boom');
    domain.set(count, 2);

    expect(seen).toEqual([2]);
  });
});
