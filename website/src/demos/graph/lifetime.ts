import { atom, computed } from 'atemno';
import type { Scenario } from '../../lib/scenario';

function sources() {
  const draft = atom('draft', 'hello');
  const shout = computed<string>(
    'shout',
    $ => `${$.get(draft).toUpperCase()}!`,
  );
  return [draft, shout];
}

// How the explorer draws it. Nothing is held, so letting go of shout lets go
// of draft too.
export const scenario: Scenario = {
  label:
    'draft feeds shout. Nothing holds draft, so its state lives only while shout is tracked.',
  sources,
  observe: ['shout'],
  layout: { draft: [0, 0], shout: [1, 0] },
  controls: [
    { kind: 'observe', source: 'shout' },
    {
      kind: 'write',
      source: 'draft',
      value: 'hey there',
      label: 'Write "hey there"',
    },
    { kind: 'read', source: 'shout' },
  ],
};
