import { describe, expect, it } from 'vitest';
import { ReactiveDomain } from '../src/graph';
import { atomFactory, computedFactory } from '../src/utils';

describe('atomFactory', () => {
  it('returns the same atom for the same key', () => {
    const todo = atomFactory<number, string>('todo', {
      key: id => `${id}`,
      value: id => `todo-${id}`,
    });

    expect(todo(1)).toBe(todo(1));
  });

  it('returns different atoms for different keys', () => {
    const todo = atomFactory<number, string>('todo', {
      key: id => `${id}`,
      value: id => `todo-${id}`,
    });

    expect(todo(1)).not.toBe(todo(2));
  });

  it('namespaces the atom name with the factory name', () => {
    const todo = atomFactory<number, string>('todo', {
      key: id => `${id}`,
      value: id => `todo-${id}`,
    });

    expect(todo(7).name).toBe('todo/7');
  });

  it('derives the initial value from the key', () => {
    const domain = new ReactiveDomain({});
    const todo = atomFactory<number, string>('todo', {
      key: id => `${id}`,
      value: id => `todo-${id}`,
    });

    expect(domain.get(todo(1))).toBe('todo-1');
    expect(domain.get(todo(2))).toBe('todo-2');
  });

  it('keeps per-key state separate', () => {
    const domain = new ReactiveDomain({});
    const todo = atomFactory<number, string>('todo', {
      key: id => `${id}`,
      value: id => `todo-${id}`,
    });

    domain.set(todo(1), 'changed');

    expect(domain.get(todo(1))).toBe('changed');
    expect(domain.get(todo(2))).toBe('todo-2');
  });

  it('forwards a custom equality check', () => {
    const point = atomFactory<number, { x: number }>('point', {
      key: id => `${id}`,
      value: () => ({ x: 0 }),
      isEqual: (prev, next) => prev.x === next.x,
    });

    expect(point(1).isEqual({ x: 0 }, { x: 0 })).toBe(true);
    expect(point(1).isEqual({ x: 0 }, { x: 1 })).toBe(false);
  });

  it('evicts old keys once the cache limit is reached', () => {
    const todo = atomFactory<number, string>('todo', {
      key: id => `${id}`,
      value: id => `todo-${id}`,
      limit: 2,
    });

    const first = todo(1);
    todo(2);
    todo(3);

    expect(todo(1)).not.toBe(first);
  });
});

describe('computedFactory', () => {
  it('returns the same computed for the same key', () => {
    const doubled = computedFactory<number, number>('doubled', {
      key: id => `${id}`,
      computed: id => () => id * 2,
    });

    expect(doubled(1)).toBe(doubled(1));
  });

  it('returns different computeds for different keys', () => {
    const doubled = computedFactory<number, number>('doubled', {
      key: id => `${id}`,
      computed: id => () => id * 2,
    });

    expect(doubled(1)).not.toBe(doubled(2));
  });

  it('namespaces the computed name with the factory name', () => {
    const doubled = computedFactory<number, number>('doubled', {
      key: id => `${id}`,
      computed: id => () => id * 2,
    });

    expect(doubled(7).name).toBe('doubled/7');
  });

  it('evaluates per key inside a domain', () => {
    const domain = new ReactiveDomain({});
    const doubled = computedFactory<number, number>('doubled', {
      key: id => `${id}`,
      computed: id => () => id * 2,
    });

    expect(domain.get(doubled(2))).toBe(4);
    expect(domain.get(doubled(3))).toBe(6);
  });

  it('tracks dependencies per key', () => {
    const domain = new ReactiveDomain({});
    const base = atomFactory<number, number>('base', {
      key: id => `${id}`,
      value: id => id,
    });
    const doubled = computedFactory<number, number>('doubled', {
      key: id => `${id}`,
      computed: id => $ => $.get(base(id)) * 2,
    });

    expect(domain.get(doubled(1))).toBe(2);

    domain.set(base(1), 10);

    expect(domain.get(doubled(1))).toBe(20);
    expect(domain.get(doubled(2))).toBe(4);
  });

  it('evicts old keys once the cache limit is reached', () => {
    const doubled = computedFactory<number, number>('doubled', {
      key: id => `${id}`,
      computed: id => () => id * 2,
      limit: 2,
    });

    const first = doubled(1);
    doubled(2);
    doubled(3);

    expect(doubled(1)).not.toBe(first);
  });
});
