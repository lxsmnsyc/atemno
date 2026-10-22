import { describe, expect, it, vi } from 'vitest';
import * as atemno from '../src/index';

describe('public entry point', () => {
  it('exports the full value surface', () => {
    expect(Object.keys(atemno).sort()).toEqual([
      'ReactiveDomain',
      'ResourceNotReadyError',
      'action',
      'atom',
      'atomFactory',
      'computed',
      'computedFactory',
      'isPending',
      'isRefreshing',
      'lazyAtom',
      'producer',
      'proxy',
      'resource',
      'toResult',
      'waitForAll',
      'waitForAny',
      'waitForNone',
      'waitForRace',
    ]);
  });

  it('exposes lazyAtom', () => {
    const domain = new atemno.ReactiveDomain({});
    const factory = vi.fn(() => 'value');
    const theme = atemno.lazyAtom('theme', factory);

    expect(factory).not.toHaveBeenCalled();
    expect(domain.get(theme)).toBe('value');
    expect(factory).toHaveBeenCalledTimes(1);
  });
});

describe('lazy atom lifecycle', () => {
  it('can be observed', () => {
    const domain = new atemno.ReactiveDomain({});
    const theme = atemno.lazyAtom('theme', () => 'light');
    const seen: string[] = [];

    domain.observe(theme, value => seen.push(value));
    domain.set(theme, 'dark');

    expect(seen).toEqual(['dark']);
  });

  it('can drive a computed', () => {
    const domain = new atemno.ReactiveDomain({});
    const theme = atemno.lazyAtom('theme', () => 'light');
    const label = atemno.computed<string>(
      'label',
      $ => `theme:${$.get(theme)}`,
    );

    expect(domain.get(label)).toBe('theme:light');

    domain.set(theme, 'dark');

    expect(domain.get(label)).toBe('theme:dark');
  });

  it('reruns the factory after destroyLazyAtom', () => {
    const domain = new atemno.ReactiveDomain({});
    let calls = 0;
    const theme = atemno.lazyAtom('theme', () => ++calls);

    expect(domain.get(theme)).toBe(1);

    domain.set(theme, 100);
    domain.destroyLazyAtom(theme);

    expect(domain.get(theme)).toBe(2);
  });

  it('reports destruction through onDestroy', () => {
    const destroyed: string[] = [];
    const domain = new atemno.ReactiveDomain({
      onDestroy: source => destroyed.push(source.name),
    });
    const theme = atemno.lazyAtom('theme', () => 'light');

    domain.get(theme);
    domain.destroyLazyAtom(theme);

    expect(destroyed).toEqual(['theme']);
  });

  it('is released once its last observer goes away', () => {
    const domain = new atemno.ReactiveDomain({});
    const theme = atemno.lazyAtom('theme', () => 'light');

    const stop = domain.observe(theme, () => {});
    domain.set(theme, 'dark');
    stop();

    expect(domain.get(theme)).toBe('light');
  });

  it('is torn down with the domain', () => {
    const domain = new atemno.ReactiveDomain({});
    const theme = atemno.lazyAtom('theme', () => 'light');

    domain.get(theme);
    domain.destroy();

    expect(() => domain.get(theme)).toThrow(
      'Attempt to perform actions in a dead ReactiveDomain.',
    );
  });
});
