import fc from 'fast-check';

/** An atom, or a lazy atom, with a small integer initial value. */
export interface AtomSpec {
  initial: number;
  lazy: boolean;
}

/**
 * A computed that reads earlier nodes. When `gate` is set, the gate is read
 * first and its parity picks which list is read next, so the dependencies
 * change from run to run. Indexes are already resolved to earlier nodes.
 */
export interface ComputedSpec {
  gate: number | undefined;
  even: number[];
  odd: number[];
  mod: number;
}

export interface ObserverSpec {
  target: number;
}

/**
 * Nodes are numbered with atoms first, then computeds. A computed only reads
 * nodes with a lower number, so the graph has no cycles.
 */
export interface GraphSpec {
  atoms: AtomSpec[];
  computeds: ComputedSpec[];
  observers: ObserverSpec[];
}

export const VALUE_LIMIT = 5;

/**
 * Computes a computed's value from its reads. The real graph and the oracle
 * both call this, so they cannot disagree about the formula.
 */
export function evaluateComputed(
  spec: ComputedSpec,
  read: (node: number) => number,
): number {
  // The gate decides which list is read.
  let list = spec.even;
  if (spec.gate !== undefined) {
    list = read(spec.gate) % 2 === 0 ? spec.even : spec.odd;
  }

  // The sum is reduced, so different inputs often give the same value.
  let sum = 0;
  for (const node of list) {
    sum += read(node);
  }
  return sum % spec.mod;
}

interface RawComputed {
  gate: number | undefined;
  even: number[];
  odd: number[];
  mod: number;
}

function resolveComputeds(
  atomCount: number,
  raws: RawComputed[],
): ComputedSpec[] {
  const result: ComputedSpec[] = [];
  for (const [index, raw] of raws.entries()) {
    // Raw numbers wrap onto the nodes that come before this computed.
    const available = atomCount + index;
    const even: number[] = [];
    for (const value of raw.even) {
      even.push(value % available);
    }
    const odd: number[] = [];
    for (const value of raw.odd) {
      odd.push(value % available);
    }
    result.push({
      gate: raw.gate === undefined ? undefined : raw.gate % available,
      even,
      odd,
      mod: raw.mod,
    });
  }
  return result;
}

export function createGraphArbitrary(): fc.Arbitrary<GraphSpec> {
  const atomArb = fc.record({
    initial: fc.integer({ min: 0, max: VALUE_LIMIT - 1 }),
    lazy: fc.boolean(),
  });
  const rawComputedArb = fc.record({
    gate: fc.option(fc.nat(99), { nil: undefined }),
    even: fc.array(fc.nat(99), { maxLength: 3 }),
    odd: fc.array(fc.nat(99), { maxLength: 3 }),
    mod: fc.integer({ min: 2, max: VALUE_LIMIT }),
  });

  return fc
    .record({
      atoms: fc.array(atomArb, { minLength: 1, maxLength: 4 }),
      raws: fc.array(rawComputedArb, { minLength: 1, maxLength: 6 }),
      targets: fc.array(fc.nat(99), { minLength: 1, maxLength: 5 }),
    })
    .map(({ atoms, raws, targets }) => {
      const computeds = resolveComputeds(atoms.length, raws);
      const total = atoms.length + computeds.length;
      const observers: ObserverSpec[] = [];
      for (const target of targets) {
        observers.push({ target: target % total });
      }
      return { atoms, computeds, observers };
    });
}

/**
 * Evaluates every node from the current atom values, with no caching between
 * calls. Returns the value of each node, atoms first.
 */
export function evaluateOracle(
  graph: GraphSpec,
  atomValues: readonly number[],
): number[] {
  const values = [...atomValues];
  for (const spec of graph.computeds) {
    values.push(evaluateComputed(spec, node => values[node]!));
  }
  return values;
}

/** The nodes one computed reads when the nodes hold `values`. */
export function readNodes(spec: ComputedSpec, values: readonly number[]) {
  const reads: number[] = [];
  evaluateComputed(spec, node => {
    reads.push(node);
    return values[node]!;
  });
  return reads;
}
