import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspect } from 'node:util';
import { codeFrame, highlight } from './highlight.ts';

export interface ShowcaseExample {
  id: string;
  label: string;
  description: string;
  input: string;
  output: string;
}

interface Example {
  id: string;
  label: string;
  description: string;
  imports: string[];
  /** Runs as written, with the imports in scope and `console` captured. */
  source: string;
}

const EXAMPLES: Example[] = [
  {
    id: 'lazy',
    label: 'Lazy',
    description:
      'A computed nobody reads does no work. Three writes, one rerun.',
    imports: ['atom', 'computed', 'ReactiveDomain'],
    source: `const count = atom('count', 0);

let runs = 0;
const double = computed('double', $ => {
  runs++;
  return $.get(count) * 2;
});

const domain = new ReactiveDomain({});
console.log('double is', domain.get(double));

domain.set(count, 1);
domain.set(count, 2);
domain.set(count, 3);

console.log('double is', domain.get(double));
console.log('it ran', runs, 'times');`,
  },
  {
    id: 'cutoff',
    label: 'Cutoff',
    description:
      'A computed that returns an equal value stops the update there.',
    imports: ['atom', 'computed', 'ReactiveDomain'],
    source: `const n = atom('n', 0);

let parityRuns = 0;
const parity = computed('parity', $ => {
  parityRuns++;
  return $.get(n) % 2 === 0 ? 'even' : 'odd';
});

let messageRuns = 0;
const message = computed('message', $ => {
  messageRuns++;
  return \`n is \${$.get(parity)}\`;
});

const domain = new ReactiveDomain({});
domain.observe(message, value => console.log(value));

domain.set(n, 2); // still even
domain.set(n, 4); // still even
domain.set(n, 5); // odd at last

console.log('parity ran', parityRuns, 'times');
console.log('message ran', messageRuns, 'times');`,
  },
  {
    id: 'domains',
    label: 'Domains',
    description:
      'An atom is a description. Each domain holds its own value for it.',
    imports: ['atom', 'ReactiveDomain'],
    source: `const theme = atom('theme', 'light');

const alice = new ReactiveDomain({});
const bob = new ReactiveDomain({});

alice.set(theme, 'dark');

console.log('alice sees', alice.get(theme));
console.log('bob sees', bob.get(theme));`,
  },
];

function format(value: unknown): string {
  return typeof value === 'string' ? value : inspect(value, { colors: false });
}

/**
 * Runs the home page examples against the workspace build of atemno, so the
 * output on the page is always what the library produces. The source shown is
 * the source that ran.
 */
export async function renderShowcase(root: string): Promise<ShowcaseExample[]> {
  const entry = path.join(root, 'packages/atemno/dist/index.js');
  const atemno: Record<string, unknown> = await import(
    pathToFileURL(entry).href
  );

  return EXAMPLES.map(example => {
    const lines: string[] = [];
    const capture = {
      log: (...values: unknown[]) => {
        lines.push(values.map(format).join(' '));
      },
    };

    // oxlint-disable-next-line typescript/no-implied-eval, no-new-func -- Runs the example exactly as shown on the page.
    const run = new Function(
      'atemno',
      'console',
      `const { ${example.imports.join(', ')} } = atemno;\n${example.source}`,
    ) as (library: Record<string, unknown>, console: typeof capture) => void;
    run(atemno, capture);

    const input = `import { ${example.imports.join(', ')} } from 'atemno';\n\n${example.source}`;
    return {
      id: example.id,
      label: example.label,
      description: example.description,
      input: codeFrame(highlight(input, 'ts'), 'Input'),
      output: codeFrame(
        `<pre class="twinkleplop console-output"><code>${lines
          .map(
            line =>
              `<span class="l">${line.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</span>`,
          )
          .join('\n')}</code></pre>`,
        'Console',
      ),
    };
  });
}
