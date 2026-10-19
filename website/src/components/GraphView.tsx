import type { JSX } from '@solidjs/web';
import { For, Show, createMemo, createUniqueId } from 'solid-js';
import type {
  GraphNode,
  GraphSnapshot,
  LogEntry,
  NodeStatus,
} from '../lib/graph';

/** Column and row of each node, left to right in the order data flows. */
export type GraphLayout = Record<
  string,
  readonly [column: number, row: number]
>;

const NODE_WIDTH = 156;
/** The smallest scale the graph is drawn at before it scrolls instead. */
const MIN_SCALE = 0.62;
const NODE_HEIGHT = 58;
const COLUMN_STEP = NODE_WIDTH + 64;
const ROW_STEP = NODE_HEIGHT + 30;
const PADDING_X = 8;
// Room above the first row for the badges.
const PADDING_TOP = 22;
const PADDING_BOTTOM = 8;
const VALUE_LIMIT = 17;

interface Placed extends GraphNode {
  x: number;
  y: number;
}

interface Edge {
  key: string;
  path: string;
  status: NodeStatus;
}

function truncate(value: string): string {
  return value.length > VALUE_LIMIT
    ? `${value.slice(0, VALUE_LIMIT - 1)}…`
    : value;
}

const STATUS_LABELS: Record<NodeStatus, string> = {
  fresh: 'fresh',
  dirty: 'dirty',
  check: 'maybe stale',
  idle: 'never read',
  released: 'released',
};

/** The reactive graph as a picture. Nodes sit where the layout puts them. */
export function GraphView(props: {
  snapshot: () => GraphSnapshot;
  layout: GraphLayout;
  label: string;
}): JSX.Element {
  const marker = createUniqueId();

  const placed = createMemo(() =>
    props.snapshot().nodes.flatMap((node): Placed[] => {
      const cell = props.layout[node.name];
      if (!cell) {
        return [];
      }
      return [
        {
          ...node,
          x: PADDING_X + cell[0] * COLUMN_STEP,
          y: PADDING_TOP + cell[1] * ROW_STEP,
        },
      ];
    }),
  );

  const edges = createMemo(() => {
    const byName = new Map(placed().map(node => [node.name, node]));
    return placed().flatMap((node): Edge[] =>
      node.deps.flatMap(name => {
        const from = byName.get(name);
        if (!from) {
          return [];
        }
        const x1 = from.x + NODE_WIDTH;
        const y1 = from.y + NODE_HEIGHT / 2;
        const x2 = node.x - 6;
        const y2 = node.y + NODE_HEIGHT / 2;
        const bend = Math.max(24, (x2 - x1) / 2);
        return [
          {
            key: `${name}->${node.name}`,
            path: `M${x1} ${y1} C${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`,
            status: node.status,
          },
        ];
      }),
    );
  });

  const size = createMemo(() => {
    let columns = 0;
    let rows = 0;
    for (const cell of Object.values(props.layout)) {
      columns = Math.max(columns, cell[0]);
      rows = Math.max(rows, cell[1]);
    }
    return {
      width: PADDING_X * 2 + columns * COLUMN_STEP + NODE_WIDTH,
      height: PADDING_TOP + rows * ROW_STEP + NODE_HEIGHT + PADDING_BOTTOM,
    };
  });

  return (
    <div class="graph-scroll">
      <svg
        class="graph-view"
        viewBox={`0 0 ${size().width} ${size().height}`}
        // Narrow screens scroll the graph sideways rather than shrink its labels
        // past reading.
        style={{ 'min-width': `${Math.round(size().width * MIN_SCALE)}px` }}
        role="img"
        aria-label={props.label}
      >
        <defs>
          <marker
            id={marker}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 1 L9 5 L0 9 z" class="graph-arrow" />
          </marker>
        </defs>

        <For each={edges()} keyed={edge => edge.key}>
          {edge => (
            <path
              class={`graph-edge edge-${edge().status}`}
              d={edge().path}
              marker-end={`url(#${marker})`}
            />
          )}
        </For>

        <For each={placed()} keyed={node => node.name}>
          {node => {
            // Alternating between two identical animations restarts the pulse
            // every time the count moves.
            const pulse = (): string => {
              const count =
                node().kind === 'atom' ? node().writes : node().runs;
              if (count === 0) {
                return 'none';
              }
              return count % 2 === 0 ? 'graph-pulse-a' : 'graph-pulse-b';
            };
            return (
              <g
                class={`graph-node node-${node().kind} status-${node().status}`}
                transform={`translate(${node().x} ${node().y})`}
              >
                <title>{`${node().name}: ${STATUS_LABELS[node().status]}`}</title>
                <rect
                  class="graph-node-pulse"
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={node().kind === 'atom' ? NODE_HEIGHT / 2 : 12}
                  style={{ 'animation-name': pulse() }}
                />
                <rect
                  class="graph-node-box"
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={node().kind === 'atom' ? NODE_HEIGHT / 2 : 12}
                />
                <text
                  class="graph-node-name"
                  x={node().kind === 'atom' ? 22 : 14}
                  y="24"
                >
                  {node().name}
                </text>
                <text
                  class="graph-node-value"
                  x={node().kind === 'atom' ? 22 : 14}
                  y="44"
                >
                  {truncate(node().value) || '—'}
                </text>
                <Show when={node().kind === 'computed'}>
                  <text
                    class="graph-node-runs"
                    x={NODE_WIDTH - 12}
                    y="24"
                    text-anchor="end"
                  >
                    {`×${node().runs}`}
                  </text>
                </Show>
                <Show when={node().held}>
                  <text class="graph-node-badge" x="14" y="-7">
                    held
                  </text>
                </Show>
                <Show when={node().observed}>
                  <text
                    class="graph-node-badge badge-observed"
                    x={NODE_WIDTH - 12}
                    y="-7"
                    text-anchor="end"
                  >
                    observed
                  </text>
                </Show>
              </g>
            );
          }}
        </For>
      </svg>
    </div>
  );
}

/** What happened, newest first. */
export function GraphLog(props: { entries: LogEntry[] }): JSX.Element {
  return (
    <div class="graph-log">
      <p class="graph-log-title">Events</p>
      <Show
        when={props.entries.length > 0}
        fallback={
          <p class="graph-log-empty">Change something to see what runs.</p>
        }
      >
        <ol>
          <For each={props.entries} keyed={entry => entry.id}>
            {entry => <li class={`log-${entry().kind}`}>{entry().text}</li>}
          </For>
        </ol>
      </Show>
    </div>
  );
}

const LEGEND: NodeStatus[] = ['fresh', 'dirty', 'check', 'idle', 'released'];

export function GraphLegend(): JSX.Element {
  return (
    <ul class="graph-legend" aria-label="Node states">
      <For each={LEGEND}>
        {status => (
          <li>
            <span class={`graph-swatch status-${status}`} aria-hidden="true" />
            {STATUS_LABELS[status]}
          </li>
        )}
      </For>
    </ul>
  );
}
