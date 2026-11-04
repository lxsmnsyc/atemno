import fc from 'fast-check';
import { describe, it } from 'vitest';
import {
  checkReads,
  commitWrites,
  createModel,
  createReal,
  readNode,
  resetComputed,
  subscribeObserver,
  unsubscribeObserver,
  type Model,
  type Real,
  type Write,
} from './harness';
import { createGraphArbitrary, VALUE_LIMIT, type GraphSpec } from './spec';

type GraphCommand = fc.Command<Model, Real>;

function createCommands(graph: GraphSpec): fc.Arbitrary<GraphCommand>[] {
  const atomCount = graph.atoms.length;
  const nodeCount = atomCount + graph.computeds.length;
  const atomIndex = fc.integer({ min: 0, max: atomCount - 1 });
  const nodeIndex = fc.integer({ min: 0, max: nodeCount - 1 });
  const computedIndex = fc.integer({ min: atomCount, max: nodeCount - 1 });
  const observerIndex = fc.integer({ min: 0, max: graph.observers.length - 1 });
  const value = fc.integer({ min: 0, max: VALUE_LIMIT - 1 });
  const write = fc.record({ atom: atomIndex, value });

  return [
    write.map((item): GraphCommand => ({
      check: () => true,
      run: (model, real) => commitWrites(model, real, [item], false, undefined),
      toString: () => `set(atom ${item.atom}, ${item.value})`,
    })),
    fc
      .record({
        writes: fc.array(write, { minLength: 1, maxLength: 5 }),
        probe: fc.option(nodeIndex, { nil: undefined }),
      })
      .map(({ writes, probe }): GraphCommand => ({
        check: () => true,
        run: (model, real) => commitWrites(model, real, writes, true, probe),
        toString: () => `batch(${describeWrites(writes)}, probe ${probe})`,
      })),
    nodeIndex.map((node): GraphCommand => ({
      check: () => true,
      run: (model, real) => readNode(model, real, node),
      toString: () => `read(node ${node})`,
    })),
    atomIndex.map((index): GraphCommand => ({
      check: () => true,
      // Resetting an atom writes its initial value back.
      run: (model, real) =>
        commitWrites(
          model,
          real,
          [{ atom: index, value: model.graph.atoms[index]!.initial }],
          false,
          undefined,
        ),
      toString: () => `reset(atom ${index})`,
    })),
    computedIndex.map((node): GraphCommand => ({
      check: () => true,
      run: (model, real) => resetComputed(model, real, node),
      toString: () => `resetDerived(node ${node})`,
    })),
    observerIndex.map((index): GraphCommand => ({
      check: () => true,
      // Toggles, so each observer alternates between on and off.
      run: (model, real) => {
        if (model.subscriptions[index]) {
          unsubscribeObserver(model, real, index);
        } else {
          subscribeObserver(model, real, index);
        }
      },
      toString: () => `toggleObserver(${index})`,
    })),
  ];
}

function describeWrites(writes: Write[]): string {
  const parts: string[] = [];
  for (const item of writes) {
    parts.push(`atom ${item.atom}=${item.value}`);
  }
  return parts.join(', ');
}

describe('model-based graph', () => {
  it('matches the oracle under random command sequences', () => {
    const scenario = createGraphArbitrary().chain(graph =>
      fc.record({
        graph: fc.constant(graph),
        commands: fc.commands(createCommands(graph), { maxCommands: 30 }),
      }),
    );

    fc.assert(
      fc.property(scenario, ({ graph, commands }) => {
        const setup = () => {
          const model = createModel(graph);
          const real = createReal(graph);
          // The initial state must already agree.
          checkReads(model, real);
          return { model, real };
        };
        fc.modelRun(setup, commands);
      }),
      { numRuns: 200 },
    );
  });
});
