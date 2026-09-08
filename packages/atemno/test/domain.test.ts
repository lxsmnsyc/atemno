import { describe, expect, it, vi } from 'vitest';
import { action, atom, computed, ReactiveDomain } from '../src/graph';

describe('ReactiveDomain lifecycle hooks', () => {
  it('reports atom creation once', () => {
    const created: string[] = [];
    const domain = new ReactiveDomain({
      onCreate: source => created.push(source.name),
    });
    const count = atom('count', 0);

    domain.get(count);
    domain.get(count);

    expect(created).toEqual(['count']);
  });

  it('reports the computed and its dependencies on first evaluation', () => {
    const created: string[] = [];
    const domain = new ReactiveDomain({
      onCreate: source => created.push(source.name),
    });
    const count = atom('count', 0);
    const double = computed('double', $ => $.get(count) * 2);

    domain.get(double);

    expect(created).toEqual(['double', 'count']);
  });

  it('reports atom updates', () => {
    const updated: string[] = [];
    const domain = new ReactiveDomain({
      onUpdate: source => updated.push(source.name),
    });
    const count = atom('count', 0);

    domain.set(count, 1);
    domain.set(count, 1);
    domain.set(count, 2);

    expect(updated).toEqual(['count', 'count']);
  });

  it('reports explicit destruction', () => {
    const destroyed: string[] = [];
    const domain = new ReactiveDomain({
      onDestroy: source => destroyed.push(source.name),
    });
    const count = atom('count', 0);

    domain.set(count, 1);
    domain.destroyAtom(count);

    expect(destroyed).toEqual(['count']);
    expect(domain.get(count)).toBe(0);
  });
});

describe('ReactiveDomain error handling', () => {
  it('routes unhandled errors to onError', () => {
    const onError = vi.fn();
    const domain = new ReactiveDomain({ onError });

    domain.handleError(new Error('boom'));

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('rethrows when no onError is given', () => {
    const domain = new ReactiveDomain({});

    expect(() => domain.handleError(new Error('boom'))).toThrow('boom');
  });
});

describe('ReactiveDomain destroy', () => {
  it('rejects reads afterwards', () => {
    const domain = new ReactiveDomain({});
    const count = atom('count', 0);

    domain.get(count);
    domain.destroy();

    expect(() => domain.get(count)).toThrow(
      'Attempt to perform actions in a dead ReactiveDomain.',
    );
  });

  it('ignores writes afterwards', () => {
    const domain = new ReactiveDomain({});
    const count = atom('count', 0);

    domain.destroy();

    expect(() => domain.set(count, 1)).not.toThrow();
  });

  it('rejects new observers afterwards', () => {
    const domain = new ReactiveDomain({});
    const count = atom('count', 0);

    domain.destroy();

    expect(() => domain.observe(count, () => {})).toThrow(
      'Attempt to perform actions in a dead ReactiveDomain.',
    );
  });

  it('is idempotent', () => {
    const domain = new ReactiveDomain({});

    domain.destroy();

    expect(() => domain.destroy()).not.toThrow();
  });
});

describe('action', () => {
  it('returns the callback unchanged', () => {
    const callback = (_$: unknown, value: number) => value;

    expect(action(callback)).toBe(callback);
  });

  it('reads and writes through the bound domain', () => {
    const domain = new ReactiveDomain({});
    const count = atom('count', 0);
    const increment = action(($, amount: number) => {
      $.set(count, $.get(count) + amount);
    });

    domain.getAction(increment)(5);

    expect(domain.get(count)).toBe(5);
  });

  it('passes the return value through', () => {
    const domain = new ReactiveDomain({});
    const count = atom('count', 1);
    const scale = action(($, factor: number) => $.get(count) * factor);

    expect(domain.getAction(scale)(3)).toBe(3);
  });

  it('can reset a source', () => {
    const domain = new ReactiveDomain({});
    const count = atom('count', 0);
    const clear = action($ => {
      $.reset(count);
    });

    domain.set(count, 10);
    domain.getAction(clear)(undefined);

    expect(domain.get(count)).toBe(0);
  });

  it('can read a computed', () => {
    const domain = new ReactiveDomain({});
    const count = atom('count', 4);
    const double = computed('double', $ => $.get(count) * 2);
    const read = action($ => $.get(double));

    expect(domain.getAction(read)(undefined)).toBe(8);
  });

  it('notifies observers of writes made inside an action', () => {
    const domain = new ReactiveDomain({});
    const count = atom('count', 0);
    const seen: number[] = [];
    const increment = action($ => {
      $.set(count, $.get(count) + 1);
    });

    domain.observe(count, value => seen.push(value));
    domain.getAction(increment)(undefined);
    domain.getAction(increment)(undefined);

    expect(seen).toEqual([1, 2]);
  });

  it('binds the same action to separate domains independently', () => {
    const a = new ReactiveDomain({});
    const b = new ReactiveDomain({});
    const count = atom('count', 0);
    const increment = action($ => {
      $.set(count, $.get(count) + 1);
    });

    a.getAction(increment)(undefined);

    expect(a.get(count)).toBe(1);
    expect(b.get(count)).toBe(0);
  });
});
