import type { JSX } from '@solidjs/web';
import { type Graph, type GraphOptions, createGraph } from '../lib/graph';
import {
  GraphLegend,
  GraphLog,
  type GraphLayout,
  GraphView,
} from './GraphView';

/**
 * A live graph: a real domain over the sources `setup` builds, drawn as it
 * runs, with controls to poke it and a log of what happened. They stack in
 * that order, so the graph always gets the full width.
 */
export default function GraphDemo(props: {
  /** Called once. It must build fresh sources, since the graph instruments them. */
  setup: () => GraphOptions;
  layout: GraphLayout;
  label: string;
  controls: (graph: Graph) => JSX.Element;
}): JSX.Element {
  const graph = createGraph(props.setup());

  return (
    <div class="graph-demo">
      <div class="graph-stage">
        <GraphView
          snapshot={graph.snapshot}
          layout={props.layout}
          label={props.label}
        />
        <GraphLegend />
      </div>
      <div class="graph-controls">{props.controls(graph)}</div>
      <GraphLog entries={graph.snapshot().log} />
    </div>
  );
}
