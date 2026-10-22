// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { act, Component, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AtemnoNodeSnapshot } from '../src/bindings/react';
import {
  AtemnoDomain,
  useAtemnoDomain,
  useAtemnoGraph,
  useAtomState,
  useComputedValue,
} from '../src/bindings/react';
import {
  atom,
  computed,
  isRefreshing,
  proxy,
  ReactiveDomain,
  resource,
} from '../src/index';

let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
});

afterEach(() => {
  host.remove();
});

// Suspense retries only run inside an async act, in an act environment.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

async function render(ui: ReactNode): Promise<void> {
  const root = createRoot(host);
  await act(async () => {
    root.render(ui);
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

async function tick(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve));
}

class Boundary extends Component<{ children: ReactNode }, { error?: Error }> {
  override state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override render(): ReactNode {
    return this.state.error
      ? `error: ${this.state.error.message}`
      : this.props.children;
  }
}

describe('useComputedValue with a resource', () => {
  it('suspends while pending and renders the value once it resolves', async () => {
    const request = deferred<string>();
    const user = resource('user', () => request.promise);

    function Show() {
      return <span>{useComputedValue(user)}</span>;
    }

    await render(
      <AtemnoDomain>
        <Suspense fallback="loading">
          <Show />
        </Suspense>
      </AtemnoDomain>,
    );
    expect(host.textContent).toBe('loading');

    await act(async () => {
      request.resolve('Ada');
      await tick();
    });

    expect(host.textContent).toBe('Ada');
  });

  it('suspends a computed that reads a pending resource', async () => {
    const request = deferred<string>();
    const user = resource('user', () => request.promise);
    const greeting = computed<string>('greeting', $ => `Hello, ${$.get(user)}`);

    function Show() {
      return <span>{useComputedValue(greeting)}</span>;
    }

    await render(
      <AtemnoDomain>
        <Suspense fallback="loading">
          <Show />
        </Suspense>
      </AtemnoDomain>,
    );
    expect(host.textContent).toBe('loading');

    await act(async () => {
      request.resolve('Ada');
      await tick();
    });

    expect(host.textContent).toBe('Hello, Ada');
  });

  it('sends a rejection to the error boundary', async () => {
    const request = deferred<string>();
    const user = resource('user', () => request.promise);

    function Show() {
      return <span>{useComputedValue(user)}</span>;
    }

    await render(
      <AtemnoDomain onError={() => {}}>
        <Boundary>
          <Suspense fallback="loading">
            <Show />
          </Suspense>
        </Boundary>
      </AtemnoDomain>,
    );

    await act(async () => {
      request.reject(new Error('offline'));
      await tick();
    });

    expect(host.textContent).toBe('error: offline');
  });

  it('suspends again when a dependency changes', async () => {
    const id = atom('id', 1);
    const requests: ReturnType<typeof deferred<string>>[] = [];
    const user = resource<string>('user', $ => {
      $.get(id);
      const request = deferred<string>();
      requests.push(request);
      return request.promise;
    });
    let domain: ReactiveDomain | undefined;

    function Show() {
      domain = useAtemnoDomain();
      return <span>{useComputedValue(user)}</span>;
    }

    await render(
      <AtemnoDomain>
        <Suspense fallback="loading">
          <Show />
        </Suspense>
      </AtemnoDomain>,
    );
    await act(async () => {
      requests[0].resolve('one');
      await tick();
    });
    expect(host.textContent).toBe('one');

    act(() => {
      domain?.set(id, 2);
    });
    await act(async () => {
      requests[1].resolve('two');
      await tick();
    });

    expect(host.textContent).toBe('two');
  });
});

describe('useAtomState with a proxy atom', () => {
  it('reads the derived value and writes through it', async () => {
    const celsius = atom('celsius', 100);
    const fahrenheit = proxy<number>('fahrenheit', {
      get: $ => ($.get(celsius) * 9) / 5 + 32,
      set($, value) {
        $.set(celsius, ((value - 32) * 5) / 9);
      },
    });
    let setFahrenheit: ((value: number) => void) | undefined;
    let domain: ReactiveDomain | undefined;

    function Show() {
      const [value, setValue] = useAtomState(fahrenheit);
      setFahrenheit = setValue;
      return <span>{value}</span>;
    }

    await render(
      <AtemnoDomain
        initialize={created => {
          domain = created;
        }}
      >
        <Show />
      </AtemnoDomain>,
    );
    expect(host.textContent).toBe('212');

    act(() => {
      setFahrenheit?.(32);
    });

    expect(host.textContent).toBe('32');
    expect(domain?.get(celsius)).toBe(0);
  });
});

describe('useAtemnoGraph', () => {
  it('lists proxies and resources under their own kinds', async () => {
    const shared = atom('shared', 1);
    const asProxy = proxy<number>('shared', {
      get: $ => $.get(shared),
      set($, value) {
        $.set(shared, value);
      },
    });
    const request = deferred<number>();
    const asResource = resource<number>('shared', () => request.promise);
    let nodes: AtemnoNodeSnapshot[] = [];

    function Read() {
      useAtomState(asProxy);
      useAtemnoDomain().observe(asResource, () => {});
      return null;
    }

    function Inspect() {
      nodes = useAtemnoGraph();
      return null;
    }

    await render(
      <AtemnoDomain>
        <Read />
        <Inspect />
      </AtemnoDomain>,
    );
    await act(async () => {});

    const byKind = Object.fromEntries(nodes.map(node => [node.kind, node]));
    expect(Object.keys(byKind).sort()).toEqual(['atom', 'proxy', 'resource']);
    expect(byKind.resource).toMatchObject({ pending: true, failed: false });
  });
});

describe('useComputedValue with keepPrevious', () => {
  it('keeps showing the previous value instead of suspending', async () => {
    const id = atom('id', 1);
    const requests: ReturnType<typeof deferred<string>>[] = [];
    const user = resource<string>(
      'user',
      $ => {
        $.get(id);
        const request = deferred<string>();
        requests.push(request);
        return request.promise;
      },
      { keepPrevious: true },
    );
    let domain: ReactiveDomain | undefined;

    function Show() {
      domain = useAtemnoDomain();
      const name = useComputedValue(user);
      const refreshing = useComputedValue(isRefreshing(user));
      return (
        <span>
          {name}
          {refreshing ? ' (refreshing)' : ''}
        </span>
      );
    }

    await render(
      <AtemnoDomain>
        <Suspense fallback="loading">
          <Show />
        </Suspense>
      </AtemnoDomain>,
    );
    expect(host.textContent).toBe('loading');
    await act(async () => {
      requests[0].resolve('one');
      await tick();
    });
    expect(host.textContent).toBe('one');

    act(() => {
      domain?.set(id, 2);
    });
    expect(host.textContent).toBe('one (refreshing)');

    await act(async () => {
      requests[1].resolve('two');
      await tick();
    });
    expect(host.textContent).toBe('two');
  });
});
