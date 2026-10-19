import type { ReadableSource } from 'atemno';
import type { GraphLayout } from '../components/GraphView';

/** One control under a graph, bound to a source by name. */
export type ScenarioControl =
  | { kind: 'stepper'; source: string; step?: number; min?: number }
  | { kind: 'switch'; source: string }
  | { kind: 'observe'; source: string }
  | { kind: 'read'; source: string }
  | { kind: 'write'; source: string; value: unknown; label: string }
  | { kind: 'add'; source: string; amount: number; label: string };

/**
 * A graph for the explorer. Plain atemno plus a description of how to draw it,
 * with no framework in it.
 */
export interface Scenario {
  label: string;
  /** Builds fresh sources. Called once per graph, which instruments them. */
  sources: () => ReadableSource<any>[];
  /** Atoms kept alive for good, standing in for whatever keeps reading them. */
  hold?: string[];
  observe?: string[];
  layout: GraphLayout;
  controls: ScenarioControl[];
}
