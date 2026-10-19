// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { act, StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AtemnoNodeSnapshot } from '../src/bindings/react';
import {
  AtemnoDomain,
  AtemnoGraph,
  AtemnoProvider,
  useAction,
  useAtemnoDomain,
  useAtomState,
  useAtomValue,
  useComputedValue,
  useAtemnoGraph,
  useResetSource,
  useSetAtom,
} from '../src/bindings/react';
import { action, atom, computed, lazyAtom, ReactiveDomain } from '../src/index';

let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
});

afterEach(() => {
  host.remove();
});

function render(ui: ReactNode, strict = false): void {
  const root = createRoot(host);
  act(() => {
    root.render(strict ? <StrictMode>{ui}</StrictMode> : ui);
  });
}

describe('AtemnoProvider', () => {
  it('supplies an externally built domain', () => {
    const count = atom('count', 3);
    const domain = new ReactiveDomain({});

    function Show() {
      return <span>{useAtomValue(count)}</span>;
    }

    render(
      <AtemnoProvider domain={domain}>
        <Show />
      </AtemnoProvider>,
    );

    expect(host.textContent).toBe('3');
  });

  it('lets a nested provider use its own domain', () => {
    const count = atom('count', 0);
    const outer = new ReactiveDomain({});
    const inner = new ReactiveDomain({});
    outer.set(count, 1);
    inner.set(count, 2);

    function Show({ id }: { id: string }) {
      return <span id={id}>{useAtomValue(count)}</span>;
    }

    render(
      <AtemnoProvider domain={outer}>
        <Show id="outer" />
        <AtemnoProvider domain={inner}>
          <Show id="inner" />
        </AtemnoProvider>
      </AtemnoProvider>,
    );

    expect(host.querySelector('#outer')?.textContent).toBe('1');
    expect(host.querySelector('#inner')?.textContent).toBe('2');
  });
});

describe('AtemnoDomain', () => {
  it('creates a domain and supplies it', () => {
    const count = atom('count', 5);

    function Show() {
      return <span>{useAtomValue(count)}</span>;
    }

    render(
      <AtemnoDomain>
        <Show />
      </AtemnoDomain>,
    );

    expect(host.textContent).toBe('5');
  });

  it('keeps the same domain across rerenders with new inline handlers', () => {
    const count = atom('count', 0);
    const seen: ReactiveDomain[] = [];

    function Probe() {
      seen.push(useAtemnoDomain());
      return <span>{useAtomValue(count)}</span>;
    }

    function App() {
      const [, force] = useState(0);
      return (
        <AtemnoDomain onError={() => {}} onUpdate={() => {}}>
          <button type="button" onClick={() => force(n => n + 1)}>
            go
          </button>
          <Probe />
        </AtemnoDomain>
      );
    }

    render(<App />);
    act(() => {
      host.querySelector('button')?.click();
    });

    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });

  it('routes errors to the latest onError prop', () => {
    const count = atom('count', 0);
    const first = vi.fn();
    const second = vi.fn();

    function Boom() {
      const domain = useAtemnoDomain();
      useAtomValue(count);
      return (
        <button
          type="button"
          onClick={() => {
            domain.observe(count, () => {
              throw new Error('boom');
            });
            domain.set(count, 1);
          }}
        >
          go
        </button>
      );
    }

    function App() {
      const [swapped, setSwapped] = useState(false);
      return (
        <AtemnoDomain onError={swapped ? second : first}>
          <button type="button" id="swap" onClick={() => setSwapped(true)}>
            swap
          </button>
          <Boom />
        </AtemnoDomain>
      );
    }

    render(<App />);
    act(() => {
      (host.querySelector('#swap') as HTMLButtonElement).click();
    });
    act(() => {
      (host.querySelectorAll('button')[1] as HTMLButtonElement).click();
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('forwards lifecycle handlers', () => {
    const count = atom('count', 0);
    const onCreate = vi.fn();
    const onUpdate = vi.fn();

    function Show() {
      const domain = useAtemnoDomain();
      const value = useAtomValue(count);
      return (
        <button type="button" onClick={() => domain.set(count, 1)}>
          {value}
        </button>
      );
    }

    render(
      <AtemnoDomain onCreate={onCreate} onUpdate={onUpdate}>
        <Show />
      </AtemnoDomain>,
    );

    expect(onCreate).toHaveBeenCalled();

    act(() => {
      host.querySelector('button')?.click();
    });

    expect(onUpdate).toHaveBeenCalled();
  });

  it('survives StrictMode double mounting', () => {
    const count = atom('count', 0);

    function Show() {
      return <span>{useAtomValue(count)}</span>;
    }

    render(
      <AtemnoDomain>
        <Show />
      </AtemnoDomain>,
      true,
    );

    expect(host.textContent).toBe('0');
  });

  it('stays usable after a StrictMode remount', () => {
    const count = atom('count', 0);
    let domain: ReactiveDomain | undefined;

    function Show() {
      domain = useAtemnoDomain();
      const value = useAtomValue(count);
      return (
        <button type="button" onClick={() => domain?.set(count, 4)}>
          {value}
        </button>
      );
    }

    render(
      <AtemnoDomain>
        <Show />
      </AtemnoDomain>,
      true,
    );

    // A destroyed domain would throw here, because StrictMode reuses the
    // component state that holds it.
    act(() => {
      host.querySelector('button')?.click();
    });

    expect(host.textContent).toBe('4');
  });
});

describe('AtemnoGraph', () => {
  it('renders nothing visible', async () => {
    const count = atom('count', 1);

    function Show() {
      return <span>{useAtomValue(count)}</span>;
    }

    render(
      <AtemnoDomain devtools>
        <Show />
      </AtemnoDomain>,
    );
    await act(async () => {});

    expect(host.textContent).toBe('1');
  });

  it('is absent unless devtools is set', () => {
    const count = atom('count', 1);

    function Show() {
      return <span>{useAtomValue(count)}</span>;
    }

    render(
      <AtemnoDomain>
        <Show />
      </AtemnoDomain>,
    );

    expect(host.textContent).toBe('1');
  });

  it('throws without an AtemnoDomain above it', () => {
    const domain = new ReactiveDomain({});
    expect(() =>
      renderToStaticMarkup(
        <AtemnoProvider domain={domain}>
          <AtemnoGraph />
        </AtemnoProvider>,
      ),
    ).toThrow('useAtemnoGraph requires an AtemnoDomain above it.');
  });
});

describe('useAtemnoGraph', () => {
  function setup(ui: ReactNode) {
    let nodes: AtemnoNodeSnapshot[] = [];
    let domain: ReactiveDomain | undefined;

    function Probe() {
      nodes = useAtemnoGraph();
      domain = useAtemnoDomain();
      return null;
    }

    render(
      <AtemnoDomain>
        <Probe />
        {ui}
      </AtemnoDomain>,
    );

    return {
      get nodes() {
        return nodes;
      },
      get domain() {
        return domain as ReactiveDomain;
      },
    };
  }

  it('starts empty', () => {
    const view = setup(null);
    expect(view.nodes).toEqual([]);
  });

  it('reports an atom with its value and kind', async () => {
    const count = atom('count', 7);

    function Show() {
      return <span>{useAtomValue(count)}</span>;
    }

    const view = setup(<Show />);
    await act(async () => {});

    expect(view.nodes).toEqual([
      { name: 'count', kind: 'atom', value: 7, failed: false, pending: false },
    ]);
  });

  it('distinguishes lazy atoms and computeds', async () => {
    const count = atom('c', 2);
    const theme = lazyAtom('theme', () => 'light');
    const double = computed<number>('double', $ => $.get(count) * 2);

    function Show() {
      return (
        <span>
          {useAtomValue(theme)}
          {useComputedValue(double)}
        </span>
      );
    }

    const view = setup(<Show />);
    await act(async () => {});

    const byName = new Map(view.nodes.map(n => [n.name, n]));
    expect(byName.get('theme')?.kind).toBe('lazyAtom');
    expect(byName.get('theme')?.value).toBe('light');
    expect(byName.get('double')?.kind).toBe('computed');
    expect(byName.get('double')?.value).toBe(4);
    expect(byName.get('c')?.kind).toBe('atom');
  });

  it('follows a value as it changes', async () => {
    const count = atom('count', 0);

    function Show() {
      return <span>{useAtomValue(count)}</span>;
    }

    const view = setup(<Show />);
    await act(async () => {});
    expect(view.nodes[0].value).toBe(0);

    await act(async () => {
      view.domain.set(count, 12);
    });

    expect(view.nodes[0].value).toBe(12);
  });

  it('reports a failing computed instead of throwing', async () => {
    const boom = computed<number>('boom', () => {
      throw new Error('nope');
    });

    function Show() {
      try {
        useComputedValue(boom);
      } catch {
        // The component swallows it; the graph must still describe the node.
      }
      return null;
    }

    const view = setup(<Show />);
    await act(async () => {});

    const node = view.nodes.find(n => n.name === 'boom');
    expect(node?.failed).toBe(true);
    expect((node?.error as Error).message).toBe('nope');
    expect(node).not.toHaveProperty('value');
  });

  it('drops a node the domain releases', async () => {
    const count = atom('count', 0);

    function Show() {
      return <span>{useAtomValue(count)}</span>;
    }

    const view = setup(<Show />);
    await act(async () => {});
    expect(view.nodes.map(n => n.name)).toEqual(['count']);

    await act(async () => {
      view.domain.destroyAtom(count);
    });

    expect(view.nodes).toEqual([]);
  });
});

describe('useAtomValue', () => {
  it('rerenders when the atom changes outside React', () => {
    const count = atom('count', 0);
    let domain: ReactiveDomain | undefined;

    function Show() {
      domain = useAtemnoDomain();
      return <span>{useAtomValue(count)}</span>;
    }

    render(
      <AtemnoDomain>
        <Show />
      </AtemnoDomain>,
    );

    act(() => {
      domain?.set(count, 9);
    });

    expect(host.textContent).toBe('9');
  });

  it('reads a lazy atom', () => {
    const theme = lazyAtom('theme', () => 'light');

    function Show() {
      return <span>{useAtomValue(theme)}</span>;
    }

    render(
      <AtemnoDomain>
        <Show />
      </AtemnoDomain>,
    );

    expect(host.textContent).toBe('light');
  });

  it('does not rerender when a write produces an equal value', () => {
    const count = atom('count', 0);
    let renders = 0;
    let domain: ReactiveDomain | undefined;

    function Show() {
      renders++;
      domain = useAtemnoDomain();
      return <span>{useAtomValue(count)}</span>;
    }

    render(
      <AtemnoDomain>
        <Show />
      </AtemnoDomain>,
    );

    const before = renders;
    act(() => {
      domain?.set(count, 0);
    });

    expect(renders).toBe(before);
  });

  it('keeps sibling readers in sync', () => {
    const count = atom('count', 0);
    let domain: ReactiveDomain | undefined;

    function Show({ id }: { id: string }) {
      domain = useAtemnoDomain();
      return <span id={id}>{useAtomValue(count)}</span>;
    }

    render(
      <AtemnoDomain>
        <Show id="a" />
        <Show id="b" />
      </AtemnoDomain>,
    );

    act(() => {
      domain?.set(count, 3);
    });

    expect(host.querySelector('#a')?.textContent).toBe('3');
    expect(host.querySelector('#b')?.textContent).toBe('3');
  });
});

describe('useComputedValue', () => {
  it('tracks its dependency', () => {
    const count = atom('count', 2);
    const double = computed<number>('double', $ => $.get(count) * 2);
    let domain: ReactiveDomain | undefined;

    function Show() {
      domain = useAtemnoDomain();
      return <span>{useComputedValue(double)}</span>;
    }

    render(
      <AtemnoDomain>
        <Show />
      </AtemnoDomain>,
    );

    expect(host.textContent).toBe('4');

    act(() => {
      domain?.set(count, 5);
    });

    expect(host.textContent).toBe('10');
  });
});

describe('useSetAtom', () => {
  it('writes without subscribing', () => {
    const count = atom('count', 0);
    let renders = 0;
    let domain: ReactiveDomain | undefined;

    function Writer() {
      renders++;
      domain = useAtemnoDomain();
      const setCount = useSetAtom(count);
      return (
        <button type="button" onClick={() => setCount(1)}>
          go
        </button>
      );
    }

    render(
      <AtemnoDomain>
        <Writer />
      </AtemnoDomain>,
    );

    const before = renders;
    act(() => {
      host.querySelector('button')?.click();
    });

    expect(domain?.get(count)).toBe(1);
    expect(renders).toBe(before);
  });

  it('accepts an updater function', () => {
    const count = atom('count', 10);

    function Counter() {
      const [value, setValue] = useAtomState(count);
      return (
        <button type="button" onClick={() => setValue(c => c + 5)}>
          {value}
        </button>
      );
    }

    render(
      <AtemnoDomain>
        <Counter />
      </AtemnoDomain>,
    );

    act(() => {
      host.querySelector('button')?.click();
    });

    expect(host.textContent).toBe('15');
  });
});

describe('useAtomState', () => {
  it('reads and writes like useState', () => {
    const count = atom('count', 0);

    function Counter() {
      const [value, setValue] = useAtomState(count);
      return (
        <button type="button" onClick={() => setValue(v => v + 1)}>
          {value}
        </button>
      );
    }

    render(
      <AtemnoDomain>
        <Counter />
      </AtemnoDomain>,
    );

    expect(host.textContent).toBe('0');
    act(() => {
      host.querySelector('button')?.click();
    });
    expect(host.textContent).toBe('1');
  });
});

describe('useResetSource', () => {
  it('restores the initial value', () => {
    const count = atom('count', 4);
    let domain: ReactiveDomain | undefined;

    function Counter() {
      domain = useAtemnoDomain();
      const value = useAtomValue(count);
      const reset = useResetSource(count);
      return (
        <button type="button" onClick={reset}>
          {value}
        </button>
      );
    }

    render(
      <AtemnoDomain>
        <Counter />
      </AtemnoDomain>,
    );

    act(() => {
      domain?.set(count, 99);
    });
    expect(host.textContent).toBe('99');

    act(() => {
      host.querySelector('button')?.click();
    });
    expect(host.textContent).toBe('4');
  });
});

describe('useAction', () => {
  it('runs a bound action', () => {
    const count = atom('count', 0);
    const bump = action(($, by: number) => {
      $.set(count, $.get(count) + by);
    });

    function Counter() {
      const value = useAtomValue(count);
      const run = useAction(bump);
      return (
        <button type="button" onClick={() => run(3)}>
          {value}
        </button>
      );
    }

    render(
      <AtemnoDomain>
        <Counter />
      </AtemnoDomain>,
    );

    act(() => {
      host.querySelector('button')?.click();
    });

    expect(host.textContent).toBe('3');
  });
});

describe('server rendering', () => {
  it('renders an atom without a client', () => {
    const count = atom('count', 42);

    function Show() {
      return <span>{useAtomValue(count)}</span>;
    }

    expect(
      renderToStaticMarkup(
        <AtemnoDomain>
          <Show />
        </AtemnoDomain>,
      ),
    ).toBe('<span>42</span>');
  });
});

describe('hooks without a provider', () => {
  it('throw a clear error', () => {
    const count = atom('count', 0);

    function Show() {
      return <span>{useAtomValue(count)}</span>;
    }

    expect(() => renderToStaticMarkup(<Show />)).toThrow(
      'useAtemnoDomain requires an AtemnoDomain or AtemnoProvider above it.',
    );
  });
});

describe('node lifetime and unmounting', () => {
  // Characterization test, not an endorsement. A domain releases a node once
  // nothing tracks it, and each reader is the only tracker it has. Unmounting
  // the last reader therefore discards the state. Whether the binding should
  // hold nodes for the life of the tree is still open.
  it('discards atom state when the last reader unmounts', () => {
    const count = atom('count', 0);
    let domain: ReactiveDomain | undefined;

    function Show() {
      return <span>{useAtomValue(count)}</span>;
    }

    function Toggle() {
      domain = useAtemnoDomain();
      const [shown, setShown] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setShown(s => !s)}>
            toggle
          </button>
          {shown ? <Show /> : null}
        </>
      );
    }

    render(
      <AtemnoDomain>
        <Toggle />
      </AtemnoDomain>,
    );

    act(() => {
      domain?.set(count, 6);
    });
    expect(host.querySelector('span')?.textContent).toBe('6');

    act(() => {
      host.querySelector('button')?.click();
    });
    act(() => {
      host.querySelector('button')?.click();
    });

    expect(host.querySelector('span')?.textContent).toBe('0');
  });

  it('keeps state while another reader stays mounted', () => {
    const count = atom('count', 0);
    let domain: ReactiveDomain | undefined;

    function Show({ id }: { id: string }) {
      return <span id={id}>{useAtomValue(count)}</span>;
    }

    function Toggle() {
      domain = useAtemnoDomain();
      const [shown, setShown] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setShown(s => !s)}>
            toggle
          </button>
          <Show id="keeper" />
          {shown ? <Show id="transient" /> : null}
        </>
      );
    }

    render(
      <AtemnoDomain>
        <Toggle />
      </AtemnoDomain>,
    );

    act(() => {
      domain?.set(count, 6);
    });

    act(() => {
      host.querySelector('button')?.click();
    });
    act(() => {
      host.querySelector('button')?.click();
    });

    expect(host.querySelector('#keeper')?.textContent).toBe('6');
    expect(host.querySelector('#transient')?.textContent).toBe('6');
  });
});
