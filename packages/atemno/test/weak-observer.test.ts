import { describe, expect, it } from 'vitest';
import { atom, computed, ReactiveDomain } from '../src/graph';

function createDomain() {
  const destroyed: string[] = [];
  const domain = new ReactiveDomain({
    onDestroy: source => destroyed.push(source.name),
  });
  return { domain, destroyed };
}

describe('observeWeak', () => {
  it('fires on changes like observe', () => {
    const { domain } = createDomain();
    const count = atom('count', 0);
    const seen: number[] = [];

    domain.observeWeak(count, value => seen.push(value));
    domain.set(count, 1);
    domain.set(count, 2);

    expect(seen).toEqual([1, 2]);
  });

  it('does not keep the source alive', () => {
    const { domain, destroyed } = createDomain();
    const count = atom('count', 0);
    const seen: number[] = [];

    domain.observeWeak(count, value => seen.push(value));
    const stop = domain.observe(count, () => {});
    domain.set(count, 1);
    stop();

    // The strong observer was the last thing keeping it, so it is released
    // even though the weak observer is still subscribed.
    expect(destroyed).toEqual(['count']);
    expect(domain.get(count)).toBe(0);

    // The weak observer ended with the node it watched.
    domain.set(count, 5);
    expect(seen).toEqual([1]);
  });

  it('never releases anything when it is removed', () => {
    const { domain, destroyed } = createDomain();
    const count = atom('count', 0);

    domain.set(count, 3);
    const stop = domain.observeWeak(count, () => {});
    stop();

    expect(destroyed).toEqual([]);
    expect(domain.get(count)).toBe(3);
  });

  it('leaves the lifetime of a computed to its strong trackers', () => {
    const { domain, destroyed } = createDomain();
    const count = atom('count', 1);
    const double = computed<number>('double', $ => $.get(count) * 2);
    const seen: number[] = [];

    const stop = domain.observe(double, () => {});
    domain.observeWeak(double, value => seen.push(value));
    domain.set(count, 2);
    stop();

    expect(seen).toEqual([4]);
    expect(destroyed).toEqual(['count', 'double']);
  });

  it('can be removed after its source was released', () => {
    const { domain } = createDomain();
    const count = atom('count', 0);

    const weak = domain.observeWeak(count, () => {});
    domain.observe(count, () => {})();

    expect(() => weak()).not.toThrow();
  });

  it('is cleaned up when the domain is destroyed', () => {
    const { domain } = createDomain();
    const count = atom('count', 0);
    domain.observeWeak(count, () => {});

    expect(() => domain.destroy()).not.toThrow();
  });
});
