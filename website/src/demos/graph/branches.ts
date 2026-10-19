import { atom, computed } from 'atemno';
import type { Scenario } from '../../lib/scenario';

function sources() {
  const metric = atom('metric', true);
  const celsius = atom('celsius', 20);

  const fahrenheit = computed<number>('fahrenheit', $ =>
    Math.round(($.get(celsius) * 9) / 5 + 32),
  );
  // Which sources this reads depends on the branch it takes.
  const reading = computed<string>('reading', $ =>
    $.get(metric) ? `${$.get(celsius)}°C` : `${$.get(fahrenheit)}°F`,
  );

  return [metric, celsius, fahrenheit, reading];
}

// How the explorer draws it.
export const scenario: Scenario = {
  label: 'reading reads metric, then either celsius or fahrenheit.',
  sources,
  hold: ['metric', 'celsius'],
  observe: ['reading'],
  layout: {
    metric: [0, 0],
    celsius: [0, 1],
    fahrenheit: [1, 1],
    reading: [2, 0],
  },
  controls: [
    { kind: 'switch', source: 'metric' },
    { kind: 'stepper', source: 'celsius', step: 5 },
  ],
};
