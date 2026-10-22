import { ReactiveDomain, computed, producer } from 'atemno';
import { query } from './dom';

// Counts seconds while something tracks it. The interval only exists while
// the producer is running.
const seconds = producer('seconds', 0, set => {
  let count = 0;
  const timer = setInterval(() => {
    count += 1;
    set(count);
  }, 1000);
  return () => clearInterval(timer);
});

const label = computed<string>('label', $ => `${$.get(seconds)}s`);

export function mount(root: HTMLElement): () => void {
  root.innerHTML = `
    <div class="demo-row">
      <output data-clock></output>
      <button type="button" data-toggle></button>
      <span class="demo-muted" data-state></span>
    </div>
  `;
  const clock = query(root, '[data-clock]');
  const toggle = query(root, '[data-toggle]');
  const state = query(root, '[data-state]');

  const domain = new ReactiveDomain({});
  let stop: (() => void) | undefined;

  function start(): void {
    clock.textContent = domain.get(label);
    stop = domain.observe(label, value => {
      clock.textContent = value;
    });
  }

  function show(): void {
    toggle.textContent = stop ? 'Stop observing' : 'Observe';
    state.textContent = stop ? 'Interval running' : 'Interval cleared';
  }

  toggle.addEventListener('click', () => {
    if (stop) {
      // The last tracker goes away, so the producer is released and stops.
      stop();
      stop = undefined;
    } else {
      start();
    }
    show();
  });

  start();
  show();

  return () => {
    stop?.();
    domain.destroy();
  };
}
