/**
 * Switches the tabs of a code group when one is clicked. Code groups come
 * from Markdown as plain HTML, so one listener on the document handles all of
 * them. Picking a tab picks it in every group on the page that has one with
 * the same label, so a reader following one library stays on it.
 */
export default function onCodeTabClick(event: MouseEvent): void {
  const tab =
    event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('[data-code-tab]')
      : null;
  const label = tab?.dataset.codeTab;
  if (!label) {
    return;
  }
  for (const group of document.querySelectorAll('.code-group')) {
    if (!group.querySelector(`[data-code-panel="${CSS.escape(label)}"]`)) {
      continue;
    }
    for (const button of group.querySelectorAll<HTMLElement>(
      '[data-code-tab]',
    )) {
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.codeTab === label),
      );
    }
    for (const panel of group.querySelectorAll<HTMLElement>(
      '[data-code-panel]',
    )) {
      panel.hidden = panel.dataset.codePanel !== label;
    }
  }
}
