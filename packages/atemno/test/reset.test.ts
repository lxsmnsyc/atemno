import { describe, expect, it, vi } from 'vitest';
import {
  action,
  atom,
  computed,
  ReactiveDomain,
  resource,
  ResourceNotReadyError,
} from '../src/graph';

async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve));
}

describe('reset on a computed', () => {
  it('reruns an unobserved computed on its next read, not before', () => {
    const domain = new ReactiveDomain({});
    let now = 1;
    const run = vi.fn(() => now);
    const time = computed<number>('time', run);

    expect(domain.get(time)).toBe(1);
    now = 2;
    domain.reset(time);
    expect(run).toHaveBeenCalledTimes(1);

    expect(domain.get(time)).toBe(2);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('reruns an observed computed straight away and notifies on change', () => {
    const domain = new ReactiveDomain({});
    let now = 1;
    const time = computed<number>('time', () => now);
    const seen: number[] = [];
    domain.observe(time, value => seen.push(value));

    now = 2;
    domain.reset(time);

    expect(seen).toEqual([2]);
  });

  it('does not notify when the rerun gives an equal value', () => {
    const domain = new ReactiveDomain({});
    const run = vi.fn(() => 'same');
    const value = computed<string>('value', run);
    const seen: string[] = [];
    domain.observe(value, next => seen.push(next));

    domain.reset(value);

    expect(run).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([]);
  });

  it('updates what reads the reset computed', () => {
    const domain = new ReactiveDomain({});
    let now = 1;
    const time = computed<number>('time', () => now);
    const label = computed<string>('label', $ => `at ${$.get(time)}`);
    const seen: string[] = [];
    domain.observe(label, value => seen.push(value));

    now = 2;
    domain.reset(time);

    expect(seen).toEqual(['at 2']);
  });

  it('does not rerun its dependencies', () => {
    const domain = new ReactiveDomain({});
    const count = atom('count', 1);
    const inner = vi.fn(($: { get: typeof domain.get }) => $.get(count) * 2);
    const double = computed<number>('double', inner);
    const outer = computed<number>('outer', $ => $.get(double) + 1);
    domain.observe(outer, () => {});

    domain.reset(outer);

    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('refetches a resource', async () => {
    const domain = new ReactiveDomain({});
    let version = 0;
    const data = resource<number>('data', async () => ++version);
    const seen: number[] = [];
    domain.observe(data, value => seen.push(value));
    await settle();

    domain.reset(data);
    expect(() => domain.get(data)).toThrow(ResourceNotReadyError);
    await settle();

    expect(seen).toEqual([1, 2]);
  });

  it('leaves a source the domain has not evaluated alone', () => {
    const domain = new ReactiveDomain({});
    const run = vi.fn(() => 1);
    const value = computed<number>('value', run);

    domain.reset(value);

    expect(run).not.toHaveBeenCalled();
  });

  it('is available in actions and computations', () => {
    const domain = new ReactiveDomain({});
    let now = 1;
    const time = computed<number>('time', () => now);
    const seen: number[] = [];
    domain.observe(time, value => seen.push(value));
    const tick = action($ => {
      now += 1;
      $.reset(time);
    });

    domain.getAction(tick)(undefined);

    expect(seen).toEqual([2]);
  });
});
