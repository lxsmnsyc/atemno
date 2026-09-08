import { describe, expect, it, vi } from 'vitest';
import { atom, lazyAtom, ReactiveDomain } from '../src/graph';

function createDomain(): ReactiveDomain {
  return new ReactiveDomain({});
}

describe('atom', () => {
  it('describes a state without evaluating it', () => {
    const source = atom('count', 0);

    expect(source.name).toBe('count');
    expect(source.initialValue).toBe(0);
  });

  it('reads its initial value from a domain', () => {
    const domain = createDomain();
    const count = atom('count', 10);

    expect(domain.get(count)).toBe(10);
  });

  it('writes a new value', () => {
    const domain = createDomain();
    const count = atom('count', 0);

    domain.set(count, 1);

    expect(domain.get(count)).toBe(1);
  });

  it('keeps state per domain', () => {
    const a = createDomain();
    const b = createDomain();
    const count = atom('count', 0);

    a.set(count, 100);

    expect(a.get(count)).toBe(100);
    expect(b.get(count)).toBe(0);
  });

  it('resets back to the initial value', () => {
    const domain = createDomain();
    const count = atom('count', 0);

    domain.set(count, 42);
    domain.reset(count);

    expect(domain.get(count)).toBe(0);
  });

  it('treats NaN as equal to itself', () => {
    const domain = createDomain();
    const value = atom('value', Number.NaN);
    const observer = vi.fn();
    domain.observe(value, observer);

    domain.set(value, Number.NaN);

    expect(observer).not.toHaveBeenCalled();
  });

  it('uses a custom equality check', () => {
    const domain = createDomain();
    const point = atom('point', { x: 0 }, (prev, next) => prev.x === next.x);
    const observer = vi.fn();
    domain.observe(point, observer);

    domain.set(point, { x: 0 });
    expect(observer).not.toHaveBeenCalled();

    domain.set(point, { x: 1 });
    expect(observer).toHaveBeenCalledTimes(1);
  });
});

describe('lazyAtom', () => {
  it('defers the initial value until first read', () => {
    const domain = createDomain();
    const factory = vi.fn(() => 'value');
    const source = lazyAtom('lazy', factory);

    expect(factory).not.toHaveBeenCalled();

    expect(domain.get(source)).toBe('value');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('only evaluates the initial value once per domain', () => {
    const domain = createDomain();
    const factory = vi.fn(() => 'value');
    const source = lazyAtom('lazy', factory);

    domain.get(source);
    domain.get(source);

    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('is writable', () => {
    const domain = createDomain();
    const source = lazyAtom('lazy', () => 'value');

    domain.set(source, 'other');

    expect(domain.get(source)).toBe('other');
  });

  it('re-evaluates the factory on reset', () => {
    const domain = createDomain();
    let calls = 0;
    const source = lazyAtom('lazy', () => ++calls);

    expect(domain.get(source)).toBe(1);

    domain.set(source, 100);
    domain.reset(source);

    expect(domain.get(source)).toBe(2);
  });
});
