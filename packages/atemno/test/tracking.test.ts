import { describe, expect, it } from 'vitest';
import { atom, computed, producer, ReactiveDomain } from '../src/graph';

describe('dependency tracking', () => {
  it('releases dropped dependencies in the order the last run read them', () => {
    const domain = new ReactiveDomain({});
    const stopped: string[] = [];
    function createSource(name: string) {
      return producer(name, 0, () => () => {
        stopped.push(name);
      });
    }
    const a = createSource('a');
    const b = createSource('b');
    const mode = atom<'ab' | 'ba' | 'none'>('mode', 'ab');
    const reader = computed('reader', $ => {
      const current = $.get(mode);
      if (current === 'ab') {
        return $.get(a) + $.get(b);
      }
      if (current === 'ba') {
        return $.get(b) + $.get(a);
      }
      return 0;
    });
    domain.observe(reader, () => {});

    domain.set(mode, 'ba');
    domain.set(mode, 'none');

    expect(stopped).toEqual(['b', 'a']);
  });

  it('checks dependencies in the order the last run read them', () => {
    const domain = new ReactiveDomain({});
    const source = atom('source', 0);
    const evaluated: string[] = [];
    const p = computed<number>('p', $ => {
      evaluated.push('p');
      return $.get(source);
    });
    const q = computed<number>('q', $ => {
      evaluated.push('q');
      return $.get(source);
    });
    const order = atom<'pq' | 'qp'>('order', 'pq');
    const reader = computed<number>('reader', $ =>
      $.get(order) === 'pq' ? $.get(p) + $.get(q) : $.get(q) + $.get(p),
    );
    domain.observe(reader, () => {});
    domain.set(order, 'qp');

    evaluated.length = 0;
    domain.set(source, 1);

    expect(evaluated).toEqual(['q', 'p']);
  });

  it('keeps context methods working when taken off the context', () => {
    const domain = new ReactiveDomain({});
    const source = atom('source', 1);
    const doubled = computed<number>('doubled', ({ get }) => get(source) * 2);
    const seen: number[] = [];
    domain.observe(doubled, value => seen.push(value));

    domain.set(source, 2);

    expect(seen).toEqual([4]);
  });

  it('shows only the public context keys', () => {
    const domain = new ReactiveDomain({});
    let keys: string[] = [];
    const reader = computed('reader', $ => {
      keys = Object.keys($);
      return 0;
    });
    domain.get(reader);

    expect(keys).toEqual([
      'get',
      'peek',
      'set',
      'reset',
      'onCleanup',
      'previous',
    ]);
  });

  it('releases dropped dependencies after a run that throws', () => {
    const domain = new ReactiveDomain({});
    const stopped: string[] = [];
    const source = producer('source', 0, () => () => {
      stopped.push('source');
    });
    const fail = atom('fail', false);
    const reader = computed('reader', $ => {
      if ($.get(fail)) {
        throw new Error('failed');
      }
      return $.get(source);
    });
    domain.observe(reader, () => {}, { onError() {} });

    domain.set(fail, true);

    expect(stopped).toEqual(['source']);
  });
});
