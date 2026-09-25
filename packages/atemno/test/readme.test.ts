import { describe, expect, it } from 'vitest';
import { action, atom, computed, ReactiveDomain } from '../src/graph';
import { atomFactory, computedFactory } from '../src/utils';

describe('README examples', () => {
  it('quick start', () => {
    const greeting = atom('greeting', 'Hello');
    const receiver = atom('receiver', 'World');
    const message = computed<string>(
      'message',
      $ => `${$.get(greeting)}, ${$.get(receiver)}!`,
    );
    const domain = new ReactiveDomain({});

    expect(domain.get(message)).toBe('Hello, World!');

    const logged: string[] = [];
    domain.observe(message, value => logged.push(value));
    domain.set(greeting, 'Bonjour');

    expect(logged).toEqual(['Bonjour, World!']);

    const value = domain.get(message);
    expect(value).toBe('Bonjour, World!');
  });

  it('domains never share state', () => {
    const message = atom('message', 'Hello, World!');
    const a = new ReactiveDomain({});
    const b = new ReactiveDomain({});

    a.set(message, 'Only in a');

    expect(a.get(message)).toBe('Only in a');
    expect(b.get(message)).toBe('Hello, World!');
  });

  it('write and reset', () => {
    const domain = new ReactiveDomain({});
    const message = atom('message', 'Hello, World!');

    domain.set(message, 'foo, bar!');
    expect(domain.get(message)).toBe('foo, bar!');

    domain.reset(message);
    expect(domain.get(message)).toBe('Hello, World!');
  });

  it('custom equality', () => {
    const domain = new ReactiveDomain({});
    const point = atom('point', { x: 0 }, (prev, next) => prev.x === next.x);
    const seen: { x: number }[] = [];

    domain.observe(point, value => seen.push(value));
    domain.set(point, { x: 0 });

    expect(seen).toEqual([]);
  });

  it('observe returns a cleanup', () => {
    const domain = new ReactiveDomain({});
    const message = atom('message', 'Hello, World!');
    const logged: string[] = [];

    const stop = domain.observe(message, value => logged.push(value));
    domain.set(message, 'whut?');
    stop();

    expect(logged).toEqual(['whut?']);
  });

  it('subscribing never fires the callback', () => {
    const domain = new ReactiveDomain({});
    const count = atom('count', 1);
    const double = computed<number>('double', $ => $.get(count) * 2);
    const fromRead: number[] = [];
    const fromCold: number[] = [];

    // Already evaluated.
    domain.get(double);
    domain.observe(double, value => fromRead.push(value));

    // Never evaluated.
    const cold = new ReactiveDomain({});
    cold.observe(double, value => fromCold.push(value));

    expect(fromRead).toEqual([]);
    expect(fromCold).toEqual([]);
  });

  it('lazy computeds', () => {
    const domain = new ReactiveDomain({});
    const count = atom('count', 1);
    const double = computed<number>('double', $ => $.get(count) * 2);

    expect(domain.get(double)).toBe(2);

    domain.set(count, 5);
    expect(domain.get(double)).toBe(10);
  });

  it('dynamic dependencies', () => {
    const domain = new ReactiveDomain({});
    const toggle = atom('toggle', true);
    const left = atom('left', 'left');
    const right = atom('right', 'right');
    const branch = computed<string>('branch', $ =>
      $.get(toggle) ? $.get(left) : $.get(right),
    );

    expect(domain.get(branch)).toBe('left');

    domain.set(right, 'changed');
    expect(domain.get(branch)).toBe('left');

    domain.set(toggle, false);
    expect(domain.get(branch)).toBe('changed');
  });

  it('previous value', () => {
    const domain = new ReactiveDomain({});
    const count = atom('count', 1);
    const total = computed<number>('total', $ => {
      const next = $.get(count);
      return $.previous ? $.previous.value + next : next;
    });

    expect(domain.get(total)).toBe(1);
    domain.set(count, 5);
    expect(domain.get(total)).toBe(6);
  });

  it('cleanups', () => {
    const domain = new ReactiveDomain({});
    const interval = atom('interval', 1000);
    const cleared: number[] = [];
    const timer = computed<number>('timer', $ => {
      const id = $.get(interval);
      $.onCleanup(() => cleared.push(id));
      return id;
    });

    domain.get(timer);
    domain.set(interval, 2000);
    domain.get(timer);

    expect(cleared).toEqual([1000]);
  });

  it('computed errors', () => {
    const domain = new ReactiveDomain({});
    const shouldFail = atom('shouldFail', true);
    const guarded = computed<string>('guarded', $ => {
      if ($.get(shouldFail)) {
        throw new Error('boom');
      }
      return 'ok';
    });

    expect(() => domain.get(guarded)).toThrow('boom');

    domain.set(shouldFail, false);
    expect(domain.get(guarded)).toBe('ok');
  });

  it('actions', () => {
    const domain = new ReactiveDomain({});
    const count = atom('count', 0);
    const increment = action(($, amount: number) => {
      $.set(count, $.get(count) + amount);
      return $.get(count);
    });

    const boundIncrement = domain.getAction(increment);

    expect(boundIncrement(5)).toBe(5);
    expect(boundIncrement(3)).toBe(8);
  });

  it('factories', () => {
    const domain = new ReactiveDomain({});
    const todo = atomFactory<number, { id: number; done: boolean }>('todo', {
      key: id => `${id}`,
      value: id => ({ id, done: false }),
      limit: 50,
    });

    expect(todo(1)).toBe(todo(1));
    expect(todo(1).name).toBe('todo/1');

    const todoLabel = computedFactory<number, string>('todoLabel', {
      key: id => `${id}`,
      computed: id => $ => ($.get(todo(id)).done ? 'done' : 'pending'),
    });

    expect(domain.get(todoLabel(1))).toBe('pending');
    domain.set(todo(1), { id: 1, done: true });
    expect(domain.get(todoLabel(1))).toBe('done');
  });

  it('node lifecycle', () => {
    const domain = new ReactiveDomain({});
    const hits = atom('hits', 0);

    const stop = domain.observe(hits, () => {});
    domain.set(hits, 9);
    stop();

    expect(domain.get(hits)).toBe(0);
  });

  it('untracked nodes are never released', () => {
    const domain = new ReactiveDomain({});
    const hits = atom('hits', 0);

    domain.set(hits, 7);

    expect(domain.get(hits)).toBe(7);
  });

  it('destroy stops the domain', () => {
    const domain = new ReactiveDomain({});
    const count = atom('count', 0);

    domain.destroy();

    expect(() => domain.get(count)).toThrow();
    expect(() => domain.set(count, 1)).not.toThrow();
  });
});
