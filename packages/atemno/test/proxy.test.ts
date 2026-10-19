import { describe, expect, it, vi } from 'vitest';
import { atom, computed, proxy, ReactiveDomain } from '../src/graph';

function createName() {
  const first = atom('first', 'Ada');
  const last = atom('last', 'Lovelace');
  const full = proxy<string>('full', {
    get: $ => `${$.get(first)} ${$.get(last)}`,
    set($, value) {
      const [nextFirst = '', nextLast = ''] = value.split(' ');
      $.set(first, nextFirst);
      $.set(last, nextLast);
    },
  });
  return { first, last, full };
}

describe('proxy', () => {
  it('reads like a computed', () => {
    const domain = new ReactiveDomain({});
    const { first, full } = createName();

    expect(domain.get(full)).toBe('Ada Lovelace');
    domain.set(first, 'Grace');
    expect(domain.get(full)).toBe('Grace Lovelace');
  });

  it('passes writes on to the sources it is derived from', () => {
    const domain = new ReactiveDomain({});
    const { first, last, full } = createName();

    domain.set(full, 'Grace Hopper');

    expect(domain.get(first)).toBe('Grace');
    expect(domain.get(last)).toBe('Hopper');
    expect(domain.get(full)).toBe('Grace Hopper');
  });

  it('is lazy and cached like a computed', () => {
    const domain = new ReactiveDomain({});
    const count = atom('count', 1);
    const read = vi.fn(($: { get: typeof domain.get }) => $.get(count) * 2);
    const double = proxy<number>('double', {
      get: read,
      set($, value) {
        $.set(count, value / 2);
      },
    });

    expect(read).not.toHaveBeenCalled();
    expect(domain.get(double)).toBe(2);
    expect(domain.get(double)).toBe(2);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('notifies observers of the proxy when a write goes through it', () => {
    const domain = new ReactiveDomain({});
    const { full } = createName();
    const seen: string[] = [];
    domain.observe(full, value => seen.push(value));

    domain.set(full, 'Grace Hopper');

    // The write sets two atoms, and observers see each step.
    expect(seen).toEqual(['Grace Lovelace', 'Grace Hopper']);
  });

  it('can be written from a computation or an action', () => {
    const domain = new ReactiveDomain({});
    const { full, last } = createName();
    const rename = domain.getAction(($, value: string) => {
      $.set(full, value);
    });

    rename('Alan Turing');

    expect(domain.get(last)).toBe('Turing');
  });

  it('can be read by computeds and reset', () => {
    const domain = new ReactiveDomain({});
    const { full, first } = createName();
    const initials = computed<string>('initials', $ =>
      $.get(full)
        .split(' ')
        .map(part => part[0])
        .join(''),
    );

    expect(domain.get(initials)).toBe('AL');
    domain.set(first, 'Grace');
    expect(domain.get(initials)).toBe('GL');

    domain.reset(full);
    expect(domain.get(full)).toBe('Grace Lovelace');
  });

  it('keeps its own node, separate from a computed with the same name', () => {
    const domain = new ReactiveDomain({});
    const asComputed = computed('shared', () => 'computed');
    const asProxy = proxy('shared', { get: () => 'proxy', set() {} });

    expect(domain.get(asComputed)).toBe('computed');
    expect(domain.get(asProxy)).toBe('proxy');
  });

  it('is released once nothing tracks it', () => {
    const destroyed: string[] = [];
    const domain = new ReactiveDomain({
      onDestroy: source => destroyed.push(source.name),
    });
    const { full } = createName();

    const stop = domain.observe(full, () => {});
    stop();

    expect(destroyed).toEqual(['first', 'last', 'full']);
  });
});
