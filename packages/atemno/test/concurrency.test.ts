import { describe, expect, it } from 'vitest';
import {
  isPending,
  toResult,
  waitForAll,
  waitForAny,
  waitForNone,
  waitForRace,
} from '../src/concurrency';
import {
  computed,
  ReactiveDomain,
  resource,
  ResourceNotReadyError,
} from '../src/graph';

function settled(value: string) {
  return () => value;
}

function failed(message: string) {
  return (): string => {
    throw new Error(message);
  };
}

function pending(): () => string {
  const request = new Promise<string>(() => {});
  return () => {
    throw new ResourceNotReadyError(request);
  };
}

describe('toResult', () => {
  it('describes a value, a failure and a pending read', () => {
    expect(toResult(settled('a'))).toEqual({ type: 'success', value: 'a' });
    expect(toResult(failed('no'))).toMatchObject({ type: 'failure' });
    expect(toResult(pending())).toMatchObject({ type: 'pending' });
  });
});

describe('isPending', () => {
  it('is true only for a pending read', () => {
    expect(isPending(pending())).toBe(true);
    expect(isPending(failed('no'))).toBe(false);
    expect(isPending(settled('a'))).toBe(false);
  });
});

describe('waitForNone', () => {
  it('returns one result per read and never throws', () => {
    const results = waitForNone([settled('a'), failed('no'), pending()]);

    expect(results.map(result => result.type)).toEqual([
      'success',
      'failure',
      'pending',
    ]);
  });
});

describe('waitForAll', () => {
  it('returns every value once all have resolved', () => {
    expect(waitForAll([settled('a'), settled('b')])).toEqual(['a', 'b']);
  });

  it('halts while any is pending', () => {
    expect(() => waitForAll([settled('a'), pending()])).toThrow(
      ResourceNotReadyError,
    );
  });

  it('throws an AggregateError once all settled and one failed', () => {
    expect(() => waitForAll([settled('a'), failed('no')])).toThrow(
      AggregateError,
    );
  });
});

describe('waitForAny', () => {
  it('returns the first success', () => {
    expect(waitForAny([failed('no'), pending(), settled('b')])).toBe('b');
  });

  it('halts while none succeeded and one is pending', () => {
    expect(() => waitForAny([failed('no'), pending()])).toThrow(
      ResourceNotReadyError,
    );
  });

  it('throws an AggregateError once all failed', () => {
    expect(() => waitForAny([failed('a'), failed('b')])).toThrow(
      AggregateError,
    );
  });
});

describe('waitForRace', () => {
  it('returns the first settled value or rethrows its error', () => {
    expect(waitForRace([pending(), settled('b')])).toBe('b');
    expect(() => waitForRace([pending(), failed('no')])).toThrow('no');
  });

  it('halts while every read is pending', () => {
    expect(() => waitForRace([pending(), pending()])).toThrow(
      ResourceNotReadyError,
    );
  });
});

describe('inside a computed', () => {
  it('waits for every resource it combines', async () => {
    const domain = new ReactiveDomain({});
    const first = resource('first', async () => 'Ada');
    const last = resource('last', async () => 'Lovelace');
    const full = computed<string>('full', $ =>
      waitForAll([() => $.get(first), () => $.get(last)]).join(' '),
    );
    const seen: string[] = [];
    domain.observe(full, value => seen.push(value));

    expect(() => domain.get(full)).toThrow(ResourceNotReadyError);
    await new Promise(resolve => setTimeout(resolve));

    expect(domain.get(full)).toBe('Ada Lovelace');
    expect(seen).toEqual(['Ada Lovelace']);
  });
});
