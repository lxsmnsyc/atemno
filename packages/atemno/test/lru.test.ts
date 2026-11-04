import { describe, expect, it } from 'vitest';
import { LRUMap } from '../src/lru';

describe('LRUMap', () => {
  it('stores and retrieves values', () => {
    const map = new LRUMap<string, number>(3);
    map.set('a', 1);

    expect(map.has('a')).toBe(true);
    expect(map.get('a')).toBe(1);
  });

  it('reports missing keys', () => {
    const map = new LRUMap<string, number>(3);

    expect(map.has('a')).toBe(false);
    expect(map.get('a')).toBeUndefined();
  });

  it('deletes keys', () => {
    const map = new LRUMap<string, number>(3);
    map.set('a', 1);
    map.delete('a');

    expect(map.has('a')).toBe(false);
    expect(map.get('a')).toBeUndefined();
  });

  it('ignores deletes of missing keys', () => {
    const map = new LRUMap<string, number>(3);
    map.set('a', 1);
    map.delete('b');

    expect(map.has('a')).toBe(true);
  });

  it('evicts the least recently used entry once the limit is reached', () => {
    const map = new LRUMap<string, number>(2);
    map.set('a', 1);
    map.set('b', 2);
    map.set('c', 3);

    expect(map.has('a')).toBe(false);
    expect(map.has('b')).toBe(true);
    expect(map.has('c')).toBe(true);
  });

  it('keeps recently read entries alive', () => {
    const map = new LRUMap<string, number>(2);
    map.set('a', 1);
    map.set('b', 2);
    // Reading 'a' makes it the most recent, so 'b' is evicted next.
    map.get('a');
    map.set('c', 3);

    expect(map.has('a')).toBe(true);
    expect(map.has('b')).toBe(false);
    expect(map.has('c')).toBe(true);
  });

  it('never exceeds its limit', () => {
    const map = new LRUMap<string, number>(4);
    for (let i = 0; i < 100; i++) {
      map.set(`key-${i}`, i);
    }

    let alive = 0;
    for (let i = 0; i < 100; i++) {
      if (map.has(`key-${i}`)) {
        alive++;
      }
    }

    expect(alive).toBeLessThanOrEqual(4);
  });

  it('keeps the newest entry after a long sequence of writes', () => {
    const map = new LRUMap<string, number>(4);
    for (let i = 0; i < 100; i++) {
      map.set(`key-${i}`, i);
    }

    expect(map.get('key-99')).toBe(99);
  });

  it('overwrites the value when a present key is set again', () => {
    const map = new LRUMap<number, number>(2);
    map.set(1, 10);
    map.set(1, 20);

    expect(map.get(1)).toBe(20);
  });

  it('moves a read key to the front, not one place up', () => {
    const map = new LRUMap<number, number>(3);
    map.set(5, 0);
    map.set(0, 0);
    map.set(1, 0);

    // Order is 1, 0, 5. Reading 5 makes it the most recent: 5, 1, 0.
    map.get(5);
    map.set(2, 0);
    map.set(3, 0);

    expect(map.has(5)).toBe(true);
    expect(map.has(0)).toBe(false);
    expect(map.has(1)).toBe(false);
  });

  it('keeps its limit after the newest key is deleted', () => {
    const map = new LRUMap<number, number>(1);
    map.set(1, 0);
    map.delete(1);
    map.set(0, 0);
    map.set(1, 0);

    expect(map.has(0)).toBe(false);
    expect(map.has(1)).toBe(true);
  });

  it('keeps its limit after keys in the middle are deleted', () => {
    const map = new LRUMap<number, number>(2);
    map.set(1, 0);
    map.set(2, 0);
    map.set(3, 0);
    map.delete(2);
    map.set(4, 0);
    map.set(5, 0);

    expect(map.has(3)).toBe(false);
    expect(map.has(4)).toBe(true);
    expect(map.has(5)).toBe(true);
  });
});
