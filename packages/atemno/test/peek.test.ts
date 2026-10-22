import { describe, expect, it, vi } from 'vitest';
import { atom, computed, ReactiveDomain } from '../src/graph';

describe('peek', () => {
  it('reads a source without making it a dependency', () => {
    const domain = new ReactiveDomain({});
    const count = atom('count', 1);
    const unit = atom('unit', 'apples');
    const run = vi.fn();
    const label = computed<string>('label', $ => {
      run();
      return `${$.get(count)} ${$.peek(unit)}`;
    });
    domain.observe(label, () => {});

    domain.set(unit, 'pears');
    expect(run).toHaveBeenCalledTimes(1);
    expect(domain.get(label)).toBe('1 apples');

    domain.set(count, 2);
    expect(domain.get(label)).toBe('2 pears');
  });

  it('does not keep the peeked source alive', () => {
    const destroyed: string[] = [];
    const domain = new ReactiveDomain({
      onDestroy: source => destroyed.push(source.name),
    });
    const count = atom('count', 1);
    const unit = atom('unit', 'apples');
    const label = computed<string>(
      'label',
      $ => `${$.get(count)} ${$.peek(unit)}`,
    );

    domain.observe(label, () => {})();

    expect(destroyed).toEqual(['count', 'label']);
  });
});
