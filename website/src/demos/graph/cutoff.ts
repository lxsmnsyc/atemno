import { atom, computed } from 'atemno';
import type { Scenario } from '../../lib/scenario';

function sources() {
  const n = atom('n', 0);
  const parity = computed<string>('parity', $ =>
    $.get(n) % 2 === 0 ? 'even' : 'odd',
  );
  const message = computed<string>('message', $ => `n is ${$.get(parity)}`);
  return [n, parity, message];
}

// How the explorer draws it.
export const scenario: Scenario = {
  label: 'n feeds parity, which feeds message.',
  sources,
  hold: ['n'],
  observe: ['message'],
  layout: { n: [0, 0], parity: [1, 0], message: [2, 0] },
  controls: [
    { kind: 'stepper', source: 'n' },
    { kind: 'add', source: 'n', amount: 2, label: 'Add 2' },
  ],
};
