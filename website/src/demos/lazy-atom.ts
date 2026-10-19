import { ReactiveDomain, lazyAtom } from 'atemno';
import { query } from './dom';

export function mount(root: HTMLElement): () => void {
  let calls = 0;
  // The function runs on first read, not when the atom is created.
  const openedAt = lazyAtom('openedAt', () => {
    calls += 1;
    return new Date().toLocaleTimeString();
  });

  root.innerHTML = `
    <div class="demo-stack">
      <div class="demo-row">
        <button type="button" data-read>Read openedAt</button>
        <button type="button" data-reset>Reset</button>
      </div>
      <p class="demo-note"></p>
    </div>
  `;
  const note = query(root, '.demo-note');
  const domain = new ReactiveDomain({});

  function render(value: string): void {
    note.textContent = `Value: ${value}. The function has run ${calls} times.`;
  }

  render('not read yet');

  query(root, '[data-read]').addEventListener('click', () => {
    render(domain.get(openedAt));
  });
  query(root, '[data-reset]').addEventListener('click', () => {
    // Resetting a lazy atom runs its function again.
    domain.reset(openedAt);
    render(domain.get(openedAt));
  });

  return () => {
    domain.destroy();
  };
}
