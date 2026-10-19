import { ReactiveDomain, atom, computed } from 'atemno';
import { query } from './dom';

const text = atom('text', '{ "ok": true }');
// Throws whenever the text is not valid JSON.
const parsed = computed<unknown>('parsed', $ => JSON.parse($.get(text)));

export function mount(root: HTMLElement): () => void {
  root.innerHTML = `
    <div class="demo-stack">
      <div class="demo-row">
        <input class="demo-input demo-input-wide" aria-label="JSON text" />
        <button type="button">Read parsed</button>
      </div>
      <p class="demo-note">Not read yet.</p>
    </div>
  `;
  const input = query<HTMLInputElement>(root, 'input');
  const note = query(root, '.demo-note');

  const domain = new ReactiveDomain({});
  input.value = domain.get(text);

  input.addEventListener('input', () => {
    domain.set(text, input.value);
  });

  query(root, 'button').addEventListener('click', () => {
    try {
      note.textContent = `Read ${JSON.stringify(domain.get(parsed))}`;
    } catch (error) {
      // The stored error comes back on every read until the text changes.
      note.textContent = `Threw: ${error instanceof Error ? error.message : String(error)}`;
    }
  });

  return () => {
    domain.destroy();
  };
}
