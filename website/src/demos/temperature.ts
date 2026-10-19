import { ReactiveDomain, atom, proxy } from 'atemno';
import { query } from './dom';

// The only stored value. Fahrenheit is derived from it, both ways.
const celsius = atom('celsius', 20);

const fahrenheit = proxy<number>('fahrenheit', {
  get: $ => Math.round(($.get(celsius) * 9) / 5 + 32),
  set($, value) {
    $.set(celsius, Math.round(((value - 32) * 5) / 9));
  },
});

export function mount(root: HTMLElement): () => void {
  root.innerHTML = `
    <div class="demo-row">
      <label class="demo-field">°C <input class="demo-input" type="number" data-celsius /></label>
      <label class="demo-field">°F <input class="demo-input" type="number" data-fahrenheit /></label>
    </div>
  `;
  const celsiusInput = query<HTMLInputElement>(root, '[data-celsius]');
  const fahrenheitInput = query<HTMLInputElement>(root, '[data-fahrenheit]');

  const domain = new ReactiveDomain({});

  celsiusInput.value = String(domain.get(celsius));
  fahrenheitInput.value = String(domain.get(fahrenheit));

  // Each input shows its own source, and skips the update it caused itself.
  const stops = [
    domain.observe(celsius, value => {
      if (document.activeElement !== celsiusInput) {
        celsiusInput.value = String(value);
      }
    }),
    domain.observe(fahrenheit, value => {
      if (document.activeElement !== fahrenheitInput) {
        fahrenheitInput.value = String(value);
      }
    }),
  ];

  celsiusInput.addEventListener('input', () => {
    domain.set(celsius, Number(celsiusInput.value));
  });
  // Writing the proxy writes celsius, through `set`.
  fahrenheitInput.addEventListener('input', () => {
    domain.set(fahrenheit, Number(fahrenheitInput.value));
  });

  return () => {
    for (const stop of stops) {
      stop();
    }
    domain.destroy();
  };
}
