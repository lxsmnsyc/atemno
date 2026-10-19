import { ReactiveDomain, atomFactory, computed } from 'atemno';
import { query } from './dom';

interface Todo {
  title: string;
  done: boolean;
}

const TITLES = ['Read the docs', 'Write an atom', 'Ship it'];
const IDS = [0, 1, 2];

// One atom per id, named `todo/0`, `todo/1` and so on.
const todo = atomFactory<number, Todo>('todo', {
  key: id => `${id}`,
  value: id => ({ title: TITLES[id], done: false }),
});

const remaining = computed<number>(
  'remaining',
  $ => IDS.filter(id => !$.get(todo(id)).done).length,
);

export function mount(root: HTMLElement): () => void {
  root.innerHTML = `
    <div class="demo-stack">
      <ul class="demo-list">
        ${IDS.map(
          id => `
          <li>
            <label class="demo-check">
              <input type="checkbox" data-id="${id}" />
              <span>${TITLES[id]}</span>
              <code class="demo-muted">${todo(id).name}</code>
            </label>
          </li>`,
        ).join('')}
      </ul>
      <p class="demo-note"></p>
    </div>
  `;
  const note = query(root, '.demo-note');
  const domain = new ReactiveDomain({});

  function renderRemaining(count: number): void {
    note.textContent = `${count} left to do.`;
  }

  renderRemaining(domain.get(remaining));
  const stop = domain.observe(remaining, renderRemaining);

  for (const box of root.querySelectorAll<HTMLInputElement>('[data-id]')) {
    const source = todo(Number(box.dataset.id));
    // Each checkbox writes only its own atom.
    box.addEventListener('change', () => {
      domain.set(source, { ...domain.get(source), done: box.checked });
    });
  }

  return () => {
    stop();
    domain.destroy();
  };
}
