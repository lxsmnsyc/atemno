import { describe, expect, it, vi } from 'vitest';
import { atom, computed, ReactiveDomain } from '../src/graph';

function createDomain(): ReactiveDomain {
  return new ReactiveDomain({});
}

describe('computed', () => {
  it('derives a value from an atom', () => {
    const domain = createDomain();
    const count = atom('count', 2);
    const double = computed('double', $ => $.get(count) * 2);

    expect(domain.get(double)).toBe(4);
  });

  it('recomputes when a dependency changes', () => {
    const domain = createDomain();
    const count = atom('count', 2);
    const double = computed('double', $ => $.get(count) * 2);

    expect(domain.get(double)).toBe(4);

    domain.set(count, 5);

    expect(domain.get(double)).toBe(10);
  });

  it('does not recompute when nothing changed', () => {
    const domain = createDomain();
    const count = atom('count', 2);
    let runs = 0;
    const mirror = computed('mirror', $ => {
      runs++;
      return $.get(count);
    });

    domain.get(mirror);
    domain.get(mirror);
    domain.get(mirror);

    expect(runs).toBe(1);
  });

  it('does not recompute when a write produces an equal value', () => {
    const domain = createDomain();
    const count = atom('count', 2);
    let runs = 0;
    const mirror = computed('mirror', $ => {
      runs++;
      return $.get(count);
    });

    domain.get(mirror);
    domain.set(count, 2);
    domain.get(mirror);

    expect(runs).toBe(1);
  });

  it('chains through multiple levels', () => {
    const domain = createDomain();
    const count = atom('count', 1);
    const double = computed<number>('double', $ => $.get(count) * 2);
    const quadruple = computed<number>('quadruple', $ => $.get(double) * 2);

    expect(domain.get(quadruple)).toBe(4);

    domain.set(count, 3);

    expect(domain.get(quadruple)).toBe(12);
  });

  it('combines several dependencies', () => {
    const domain = createDomain();
    const greeting = atom('greeting', 'Hello');
    const receiver = atom('receiver', 'World');
    const message = computed(
      'message',
      $ => `${$.get(greeting)}, ${$.get(receiver)}!`,
    );

    expect(domain.get(message)).toBe('Hello, World!');

    domain.set(greeting, 'Bonjour');

    expect(domain.get(message)).toBe('Bonjour, World!');
  });

  it('tracks dependencies dynamically', () => {
    const domain = createDomain();
    const toggle = atom('toggle', true);
    const left = atom('left', 'left');
    const right = atom('right', 'right');
    const branch = computed('branch', $ =>
      $.get(toggle) ? $.get(left) : $.get(right),
    );

    expect(domain.get(branch)).toBe('left');

    // `right` is untracked while the toggle is on.
    domain.set(right, 'changed');
    expect(domain.get(branch)).toBe('left');

    domain.set(toggle, false);
    expect(domain.get(branch)).toBe('changed');
  });

  it('exposes the previous value', () => {
    const domain = createDomain();
    const base = atom('base', 1);
    const sum = computed<number>('sum', $ => {
      const next = $.get(base);
      return $.previous ? $.previous.value + next : next;
    });

    expect(domain.get(sum)).toBe(1);

    domain.set(base, 2);

    expect(domain.get(sum)).toBe(3);
  });

  it('runs cleanups before recomputing', () => {
    const domain = createDomain();
    const count = atom('count', 0);
    const cleanup = vi.fn();
    const mirror = computed('mirror', $ => {
      $.onCleanup(cleanup);
      return $.get(count);
    });

    domain.get(mirror);
    expect(cleanup).not.toHaveBeenCalled();

    domain.set(count, 1);
    domain.get(mirror);

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('can write to atoms from within a computation', () => {
    const domain = createDomain();
    const source = atom('source', 1);
    const mirror = atom('mirror', 0);
    const sync = computed('sync', $ => {
      const value = $.get(source);
      $.set(mirror, value);
      return value;
    });

    domain.get(sync);

    expect(domain.get(mirror)).toBe(1);
  });

  it('rethrows the computation error on every read', () => {
    const domain = createDomain();
    const failing = computed('failing', () => {
      throw new Error('boom');
    });

    expect(() => domain.get(failing)).toThrow('boom');
    expect(() => domain.get(failing)).toThrow('boom');
  });

  it('recovers once the dependency changes', () => {
    const domain = createDomain();
    const shouldFail = atom('shouldFail', true);
    const guarded = computed('guarded', $ => {
      if ($.get(shouldFail)) {
        throw new Error('boom');
      }
      return 'ok';
    });

    expect(() => domain.get(guarded)).toThrow('boom');

    domain.set(shouldFail, false);

    expect(domain.get(guarded)).toBe('ok');
  });

  it('forces a recomputation on reset', () => {
    const domain = createDomain();
    const compute = vi.fn(() => 'value');
    const constant = computed('constant', compute);

    domain.get(constant);
    domain.reset(constant);

    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('uses a custom equality check', () => {
    const domain = createDomain();
    const count = atom('count', 0);
    const parity = computed<{ even: boolean }>(
      'parity',
      $ => ({ even: $.get(count) % 2 === 0 }),
      (prev, next) => prev.even === next.even,
    );
    const observer = vi.fn();
    domain.observe(parity, observer);
    observer.mockClear();

    domain.set(count, 2);
    expect(observer).not.toHaveBeenCalled();

    domain.set(count, 1);
    expect(observer).toHaveBeenCalledTimes(1);
  });
});
