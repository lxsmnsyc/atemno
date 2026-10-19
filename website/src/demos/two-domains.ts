import { ReactiveDomain, atom } from 'atemno';
import { query } from './dom';

// One description, shared by both panels below.
const clicks = atom('clicks', 0);

function panel(root: HTMLElement, owner: string): () => void {
  root.innerHTML = `
    <p class="demo-label">${owner}'s domain</p>
    <button type="button"></button>
  `;
  const button = query(root, 'button');

  // Each panel builds its own domain, so each holds its own value.
  const domain = new ReactiveDomain({});

  function render(value: number): void {
    button.textContent = `Clicked ${value} times`;
  }

  render(domain.get(clicks));
  const stop = domain.observe(clicks, render);
  button.addEventListener('click', () => {
    domain.set(clicks, domain.get(clicks) + 1);
  });

  return () => {
    stop();
    domain.destroy();
  };
}

export function mount(root: HTMLElement): () => void {
  root.innerHTML = `
    <div class="demo-grid">
      <div class="demo-card" data-owner="Alice"></div>
      <div class="demo-card" data-owner="Bob"></div>
    </div>
  `;
  const cleanups = [...root.querySelectorAll<HTMLElement>('[data-owner]')].map(
    card => panel(card, card.dataset.owner ?? ''),
  );
  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
