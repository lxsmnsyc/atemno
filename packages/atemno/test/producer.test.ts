import { describe, expect, it, vi } from 'vitest';
import { computed, producer, ReactiveDomain } from '../src/graph';

function createClock() {
  let emit: ((value: number) => void) | undefined;
  const stop = vi.fn();
  const setup = vi.fn((set: (value: number) => void) => {
    emit = set;
    return stop;
  });
  const clock = producer('clock', 0, setup);
  return {
    clock,
    setup,
    stop,
    emit: (value: number) => emit?.(value),
  };
}

describe('producer', () => {
  it('starts when first tracked and feeds its observers', () => {
    const domain = new ReactiveDomain({});
    const { clock, setup, emit } = createClock();
    const seen: number[] = [];

    expect(domain.get(clock)).toBe(0);
    expect(setup).not.toHaveBeenCalled();

    domain.observe(clock, value => seen.push(value));
    expect(setup).toHaveBeenCalledTimes(1);

    emit(1);
    emit(2);
    expect(seen).toEqual([1, 2]);
  });

  it('feeds computeds that read it', () => {
    const domain = new ReactiveDomain({});
    const { clock, emit } = createClock();
    const label = computed<string>('label', $ => `tick ${$.get(clock)}`);
    const seen: string[] = [];
    domain.observe(label, value => seen.push(value));

    emit(3);

    expect(seen).toEqual(['tick 3']);
  });

  it('takes a value set during setup as its starting value', () => {
    const domain = new ReactiveDomain({});
    const width = producer('width', 0, set => {
      set(1024);
    });
    const seen: number[] = [];
    const label = computed<string>('label', $ => `${$.get(width)}px`);

    domain.observe(label, () => seen.push(1));

    expect(domain.get(label)).toBe('1024px');
    expect(seen).toEqual([]);
  });

  it('stops once released, and starts again from its initial value', () => {
    const domain = new ReactiveDomain({});
    const { clock, setup, stop, emit } = createClock();

    const unsubscribe = domain.observe(clock, () => {});
    emit(5);
    unsubscribe();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(domain.get(clock)).toBe(0);

    domain.observe(clock, () => {});
    expect(setup).toHaveBeenCalledTimes(2);
  });

  it('ignores values set after it stopped', () => {
    const onUpdate = vi.fn();
    const domain = new ReactiveDomain({ onUpdate });
    const { clock, emit } = createClock();

    domain.observe(clock, () => {})();
    onUpdate.mockClear();
    emit(9);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('is not started by a weak observer', () => {
    const domain = new ReactiveDomain({});
    const { clock, setup } = createClock();

    domain.observeWeak(clock, () => {});

    expect(setup).not.toHaveBeenCalled();
  });

  it('stops when the domain is destroyed', () => {
    const domain = new ReactiveDomain({});
    const { clock, stop } = createClock();
    domain.observe(clock, () => {});

    domain.destroy();

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('can read its latest value in setup', () => {
    const domain = new ReactiveDomain({});
    const counter = producer('counter', 10, (set, get) => {
      set(get() + 1);
    });

    domain.observe(counter, () => {});

    expect(domain.get(counter)).toBe(11);
  });

  it('sends setup errors to onError', () => {
    const errors: unknown[] = [];
    const domain = new ReactiveDomain({ onError: error => errors.push(error) });
    const broken = producer('broken', 0, () => {
      throw new Error('no socket');
    });

    domain.observe(broken, () => {});

    expect((errors[0] as Error).message).toBe('no socket');
  });

  it('restores its initial value on reset', () => {
    const domain = new ReactiveDomain({});
    const { clock, emit } = createClock();
    domain.observe(clock, () => {});
    emit(7);

    domain.reset(clock);

    expect(domain.get(clock)).toBe(0);
  });
});
