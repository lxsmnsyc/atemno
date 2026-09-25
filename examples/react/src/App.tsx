import {
  useAction,
  useAtemnoGraph,
  useAtomState,
  useAtomValue,
  useComputedValue,
  useResetSource,
  useSetAtom,
} from 'atemno/react';
import { useEffect, useState } from 'react';
import type { Theme } from './state';
import {
  bump,
  count,
  doneCount,
  doubled,
  step,
  summary,
  TASK_IDS,
  task,
  theme,
} from './state';

/**
 * Reads and writes an atom, in the shape of `useState`.
 */
function Counter() {
  const [value, setValue] = useAtomState(count);
  const size = useAtomValue(step);

  return (
    <div className="row">
      <button type="button" onClick={() => setValue(current => current - size)}>
        -{size}
      </button>
      <output>{value}</output>
      <button type="button" onClick={() => setValue(current => current + size)}>
        +{size}
      </button>
    </div>
  );
}

/**
 * A second reader of the same atom. It stays in step with the counter without
 * either component knowing about the other.
 */
function Doubled() {
  return <output>{useComputedValue(doubled)}</output>;
}

function Summary() {
  return <p className="summary">{useComputedValue(summary)}</p>;
}

function StepPicker() {
  const [value, setValue] = useAtomState(step);

  return (
    <div className="row">
      {[1, 5, 10].map(size => (
        <button
          key={size}
          type="button"
          aria-pressed={value === size}
          onClick={() => setValue(size)}
        >
          {size}
        </button>
      ))}
    </div>
  );
}

/**
 * Writes without reading. This component never rerenders when the count
 * changes, because it does not subscribe to it.
 */
function Controls() {
  const runBump = useAction(bump);
  const setCount = useSetAtom(count);
  const resetCount = useResetSource(count);

  return (
    <div className="row">
      <button type="button" onClick={() => runBump(25)}>
        action +25
      </button>
      <button type="button" onClick={() => setCount(100)}>
        set 100
      </button>
      <button type="button" onClick={resetCount}>
        reset
      </button>
    </div>
  );
}

/**
 * A lazy atom, whose initial value comes from the browser on first read.
 */
function ThemeToggle() {
  const [value, setValue] = useAtomState(theme);

  useEffect(() => {
    document.body.dataset.theme = value;
    localStorage.setItem('theme', value);
  }, [value]);

  return (
    <button
      type="button"
      onClick={() =>
        setValue(current => (current === 'dark' ? 'light' : 'dark'))
      }
    >
      theme: {value satisfies Theme}
    </button>
  );
}

/**
 * Each row reads its own atom from the factory, so checking one task rerenders
 * that row alone. The total is a computed over all of them.
 */
function TaskRow({ id }: { id: number }) {
  const [value, setValue] = useAtomState(task(id));

  return (
    <li>
      <label>
        <input
          type="checkbox"
          checked={value.done}
          onChange={event =>
            setValue({ ...value, done: event.currentTarget.checked })
          }
        />
        {value.title}
      </label>
    </li>
  );
}

function Tasks() {
  const done = useComputedValue(doneCount);

  return (
    <>
      <ul className="tasks">
        {TASK_IDS.map(id => (
          <TaskRow key={id} id={id} />
        ))}
      </ul>
      <p className="summary">
        {done} of {TASK_IDS.length} done
      </p>
    </>
  );
}

/**
 * A domain releases a node once nothing tracks it, and a reading component is
 * the only tracker it has. Hide the counter, bring it back, and the count is
 * gone, because nothing observed it in between.
 */
function NodeLifetime() {
  const [shown, setShown] = useState(true);

  return (
    <>
      <button type="button" onClick={() => setShown(current => !current)}>
        {shown ? 'unmount the reader' : 'mount the reader'}
      </button>
      {shown ? (
        <Counter />
      ) : (
        <p className="summary">nothing is reading count</p>
      )}
    </>
  );
}

/**
 * The same snapshot that `devtools` renders into the React developer tools,
 * shown on the page instead.
 */
function Graph() {
  const nodes = useAtemnoGraph();

  return (
    <table className="graph">
      <thead>
        <tr>
          <th>kind</th>
          <th>name</th>
          <th>value</th>
        </tr>
      </thead>
      <tbody>
        {nodes.map(node => (
          <tr key={node.name}>
            <td>{node.kind}</td>
            <td>{node.name}</td>
            <td>
              {node.failed
                ? `threw ${String(node.error)}`
                : JSON.stringify(node.value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2>{title}</h2>
      {note ? <p className="note">{note}</p> : null}
      {children}
    </section>
  );
}

export function App() {
  return (
    <main>
      <header>
        <h1>atemno + React</h1>
        <ThemeToggle />
      </header>

      <Panel title="Counter" note="useAtomState and useComputedValue">
        <Counter />
        <div className="row">
          doubled: <Doubled />
        </div>
        <Summary />
      </Panel>

      <Panel title="Step" note="one atom read by two components">
        <StepPicker />
      </Panel>

      <Panel title="Actions" note="this panel writes but never subscribes">
        <Controls />
      </Panel>

      <Panel title="Keyed state" note="one atom per id, from atomFactory">
        <Tasks />
      </Panel>

      <Panel
        title="Node lifetime"
        note="state lasts only while something reads it"
      >
        <NodeLifetime />
      </Panel>

      <Panel title="Graph" note="useAtemnoGraph, the same data devtools shows">
        <Graph />
      </Panel>
    </main>
  );
}
