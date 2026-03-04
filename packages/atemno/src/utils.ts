import { atom, computed } from './graph';
import { LRUMap } from './lru';
import type { Atom, Computation, Computed, IsEqual } from './types';

const INSTANCE_LIMIT = 100;

export interface AtomFactoryOptions<Key, T> {
  key: (key: Key) => string;
  value: (key: Key) => T;
  isEqual?: IsEqual<T>;

  // Maximum amount of cached atoms in the LRU
  limit?: number;
}

export function atomFactory<Key, T>(
  name: string,
  options: AtomFactoryOptions<Key, T>,
): (key: Key) => Atom<T> {
  const map = new LRUMap<string, Atom<T>>(options.limit ?? INSTANCE_LIMIT);
  return (key: Key) => {
    const hash = `${name}/${options.key(key)}`;

    if (map.has(hash)) {
      return map.get(hash)!;
    }
    const instance = atom(hash, options.value(key), options.isEqual);
    map.set(hash, instance);
    return instance;
  };
}

export interface ComputedFactoryOptions<Key, T> {
  key: (key: Key) => string;
  computed: (key: Key) => Computation<T>;
  isEqual?: IsEqual<T>;

  // Maximum amount of cached computeds in the LRU
  limit?: number;
}

export function computedFactory<Key, T>(
  name: string,
  options: ComputedFactoryOptions<Key, T>,
): (key: Key) => Computed<T> {
  const map = new LRUMap<string, Computed<T>>(options.limit ?? INSTANCE_LIMIT);
  return (key: Key) => {
    const hash = `${name}/${options.key(key)}`;

    if (map.has(hash)) {
      return map.get(hash)!;
    }
    const instance = computed(
      `${name}/${options.key(key)}`,
      options.computed(key),
      options.isEqual,
    );
    map.set(hash, instance);
    return instance;
  };
}
