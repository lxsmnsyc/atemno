import { ReactiveDomain, atom } from 'atemno';
import { query } from './dom';

// A description of state. It holds nothing until a domain reads it.
const count = atom('count', 0);

export function mount(root: HTMLElement): () => void {
  root.innerHTML = `
    <div class="demo-row">
      <button type="button" data-step="-1">−1</button>
      <output></output>
      <button type="button" data-step="1">+1</button>
      <button type="button" data-reset>Reset</button>
    </div>
  `;
  const output = query(root, 'output');

  const domain = new ReactiveDomain({});

  function render(value: number): void {
    output.textContent = `Count: ${value}`;
  }

  // Subscribing never calls back, so the first value is read directly.
  render(domain.get(count));
  const stop = domain.observe(count, render);

  for (const button of root.querySelectorAll<HTMLButtonElement>(
    '[data-step]',
  )) {
    button.addEventListener('click', () => {
      domain.set(count, domain.get(count) + Number(button.dataset.step));
    });
  }
  query(root, '[data-reset]').addEventListener('click', () => {
    domain.reset(count);
  });

  return () => {
    stop();
    domain.destroy();
  };
}
