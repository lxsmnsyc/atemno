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
    // Bubbles 'a' away from the tail, so 'b' becomes the eviction candidate.
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
});
