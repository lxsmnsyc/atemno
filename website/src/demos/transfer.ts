import { ReactiveDomain, action, atom } from 'atemno';
import { query } from './dom';

const checking = atom('checking', 100);
const savings = atom('savings', 50);

// Reads and writes as one step, and says whether it went through.
const transfer = action(($, amount: number) => {
  const available = $.get(checking);
  if (amount > available) {
    return false;
  }
  $.set(checking, available - amount);
  $.set(savings, $.get(savings) + amount);
  return true;
});

export function mount(root: HTMLElement): () => void {
  root.innerHTML = `
    <div class="demo-stack">
      <div class="demo-grid">
        <div class="demo-card">
          <p class="demo-label">Checking</p>
          <p class="demo-figure" data-checking></p>
        </div>
        <div class="demo-card">
          <p class="demo-label">Savings</p>
          <p class="demo-figure" data-savings></p>
        </div>
      </div>
      <div class="demo-row">
        <button type="button" data-amount="25">Move $25</button>
        <button type="button" data-amount="500">Move $500</button>
        <button type="button" data-reset>Reset</button>
      </div>
      <p class="demo-note" aria-live="polite"></p>
    </div>
  `;
  const checkingFigure = query(root, '[data-checking]');
  const savingsFigure = query(root, '[data-savings]');
  const note = query(root, '.demo-note');

  const domain = new ReactiveDomain({});
  const move = domain.getAction(transfer);

  checkingFigure.textContent = `$${domain.get(checking)}`;
  savingsFigure.textContent = `$${domain.get(savings)}`;
  const stops = [
    domain.observe(checking, value => {
      checkingFigure.textContent = `$${value}`;
    }),
    domain.observe(savings, value => {
      savingsFigure.textContent = `$${value}`;
    }),
  ];

  for (const button of root.querySelectorAll<HTMLButtonElement>(
    '[data-amount]',
  )) {
    button.addEventListener('click', () => {
      const amount = Number(button.dataset.amount);
      note.textContent = move(amount)
        ? `Moved $${amount}.`
        : `Not enough in checking for $${amount}.`;
    });
  }
  query(root, '[data-reset]').addEventListener('click', () => {
    domain.reset(checking);
    domain.reset(savings);
    note.textContent = '';
  });

  return () => {
    for (const stop of stops) {
      stop();
    }
    domain.destroy();
  };
}
