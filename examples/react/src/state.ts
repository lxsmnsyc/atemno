import { action, atom, atomFactory, computed, lazyAtom } from 'atemno';

export const count = atom('count', 0);

export const step = atom('step', 1);

export const doubled = computed<number>('doubled', $ => $.get(count) * 2);

export const summary = computed<string>(
  'summary',
  $ => `${$.get(count)} counted in steps of ${$.get(step)}`,
);

export type Theme = 'light' | 'dark';

/**
 * Reads the browser, so the initial value has to wait until something reads it.
 */
export const theme = lazyAtom<Theme>('theme', () =>
  localStorage.getItem('theme') === 'dark' ? 'dark' : 'light',
);

export const bump = action(($, by: number) => {
  $.set(count, $.get(count) + by);
});

export interface Task {
  title: string;
  done: boolean;
}

/**
 * One atom per task id, cached in an LRU. Asking twice for the same id gives
 * back the same atom.
 */
export const task = atomFactory<number, Task>('task', {
  key: id => `${id}`,
  value: id => ({ title: `Task ${id}`, done: false }),
  limit: 20,
});

export const TASK_IDS = [1, 2, 3];

export const doneCount = computed<number>('doneCount', $ => {
  let total = 0;
  for (const id of TASK_IDS) {
    if ($.get(task(id)).done) {
      total++;
    }
  }
  return total;
});
