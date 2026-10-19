import { ReactiveDomain, atom, computed } from 'atemno';
import { query } from './dom';

const first = atom('first', 'Ada');
const last = atom('last', 'Lovelace');

// Derived from two atoms. Both become dependencies by being read.
const full = computed<string>('full', $ =>
  `${$.get(first)} ${$.get(last)}`.trim(),
);
const initials = computed<string>('initials', $ =>
  $.get(full)
    .split(' ')
    .map(part => part.charAt(0))
    .join(''),
);

export function mount(root: HTMLElement): () => void {
  root.innerHTML = `
    <div class="demo-stack">
      <div class="demo-row">
        <input class="demo-input" aria-label="First name" data-first />
        <input class="demo-input" aria-label="Last name" data-last />
      </div>
      <p class="demo-note">Hello, <strong></strong> (<span></span>).</p>
    </div>
  `;
  const firstInput = query<HTMLInputElement>(root, '[data-first]');
  const lastInput = query<HTMLInputElement>(root, '[data-last]');
  const name = query(root, 'strong');
  const short = query(root, '.demo-note span');

  const domain = new ReactiveDomain({});

  firstInput.value = domain.get(first);
  lastInput.value = domain.get(last);
  name.textContent = domain.get(full);
  short.textContent = domain.get(initials);

  // Each observer updates one piece of the page and nothing else.
  const stops = [
    domain.observe(full, value => {
      name.textContent = value;
    }),
    domain.observe(initials, value => {
      short.textContent = value;
    }),
  ];

  firstInput.addEventListener('input', () => {
    domain.set(first, firstInput.value);
  });
  lastInput.addEventListener('input', () => {
    domain.set(last, lastInput.value);
  });

  return () => {
    for (const stop of stops) {
      stop();
    }
    domain.destroy();
  };
}
