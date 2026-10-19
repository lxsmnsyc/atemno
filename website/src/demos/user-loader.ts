import { ReactiveDomain, atom, computed, resource, toResult } from 'atemno';
import type { Result } from 'atemno';
import { query } from './dom';

const NAMES = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing'];

// Stands in for a request. Larger ids answer sooner, so a slow old request can
// finish after a newer one, and user 4 does not exist.
async function fetchUser(id: number): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 1600 - id * 300));
  const name = NAMES[id - 1];
  if (!name) {
    throw new Error(`No user ${id}`);
  }
  return name;
}

const userId = atom('userId', 1);

// Tracks userId, read before the first await. Each change starts a new
// request, and only the latest one's result is kept.
const user = resource<string>('user', $ => fetchUser($.get(userId)));

// toResult turns the pending state and the error into values, so this
// computed changes on every step: loading, loaded, failed.
const status = computed<Result<string>>('status', $ =>
  toResult(() => $.get(user)),
);

export function mount(root: HTMLElement): () => void {
  root.innerHTML = `
    <div class="demo-row">
      <button type="button" aria-label="Previous user" data-previous>−</button>
      <output>user <span data-id></span></output>
      <button type="button" aria-label="Next user" data-next>+</button>
      <span class="demo-muted" data-status></span>
    </div>
  `;
  const id = query(root, '[data-id]');
  const text = query(root, '[data-status]');

  const domain = new ReactiveDomain({});

  function showId(value: number): void {
    id.textContent = String(value);
  }

  function showStatus(result: Result<string>): void {
    if (result.type === 'pending') {
      text.textContent = 'Loading…';
    } else if (result.type === 'success') {
      text.textContent = result.value;
    } else {
      text.textContent = (result.value as Error).message;
    }
  }

  showId(domain.get(userId));
  showStatus(domain.get(status));
  const stops = [
    domain.observe(userId, showId),
    domain.observe(status, showStatus),
  ];

  query(root, '[data-previous]').addEventListener('click', () => {
    domain.set(userId, Math.max(1, domain.get(userId) - 1));
  });
  query(root, '[data-next]').addEventListener('click', () => {
    domain.set(userId, Math.min(4, domain.get(userId) + 1));
  });

  return () => {
    for (const stop of stops) {
      stop();
    }
    domain.destroy();
  };
}
