import { describe, expect, it } from 'vitest';
import { action, atom, computed, ReactiveDomain } from '../src/graph';

function createName() {
  const first = atom('first', 'Ada');
  const last = atom('last', 'Lovelace');
  const full = computed<string>('full', $ => `${$.get(first)} ${$.get(last)}`);
  return { first, last, full };
}

describe('batch', () => {
  it('calls observers once, after every write in it', () => {
    const domain = new ReactiveDomain({});
    const { first, last, full } = createName();
    const seen: string[] = [];
    domain.observe(full, value => seen.push(value));

    domain.batch(() => {
      domain.set(first, 'Grace');
      domain.set(last, 'Hopper');
    });

    expect(seen).toEqual(['Grace Hopper']);
  });

  it('lets reads inside see each write', () => {
    const domain = new ReactiveDomain({});
    const { first, full } = createName();
    domain.observe(full, () => {});

    const inside = domain.batch(() => {
      domain.set(first, 'Grace');
      return domain.get(full);
    });

    expect(inside).toBe('Grace Lovelace');
  });

  it('returns what the callback returns', () => {
    const domain = new ReactiveDomain({});

    expect(domain.batch(() => 42)).toBe(42);
  });

  it('nests, and runs observers when the outermost batch ends', () => {
    const domain = new ReactiveDomain({});
    const { first, last, full } = createName();
    const seen: string[] = [];
    domain.observe(full, value => seen.push(value));

    domain.batch(() => {
      domain.batch(() => {
        domain.set(first, 'Grace');
      });
      expect(seen).toEqual([]);
      domain.set(last, 'Hopper');
    });

    expect(seen).toEqual(['Grace Hopper']);
  });

  it('runs observers even when the callback throws', () => {
    const domain = new ReactiveDomain({});
    const { first, full } = createName();
    const seen: string[] = [];
    domain.observe(full, value => seen.push(value));

    expect(() =>
      domain.batch(() => {
        domain.set(first, 'Grace');
        throw new Error('stop');
      }),
    ).toThrow('stop');

    expect(seen).toEqual(['Grace Lovelace']);
  });

  it('skips observers whose value ends where it started', () => {
    const domain = new ReactiveDomain({});
    const count = atom('count', 0);
    const seen: number[] = [];
    domain.observe(count, value => seen.push(value));

    domain.batch(() => {
      domain.set(count, 1);
      domain.set(count, 0);
    });

    expect(seen).toEqual([]);
  });
});

describe('actions', () => {
  it('run in a batch', () => {
    const domain = new ReactiveDomain({});
    const { first, last, full } = createName();
    const seen: string[] = [];
    domain.observe(full, value => seen.push(value));
    const rename = action(($, name: string) => {
      const [nextFirst = '', nextLast = ''] = name.split(' ');
      $.set(first, nextFirst);
      $.set(last, nextLast);
    });

    domain.getAction(rename)('Alan Turing');

    expect(seen).toEqual(['Alan Turing']);
  });
});
