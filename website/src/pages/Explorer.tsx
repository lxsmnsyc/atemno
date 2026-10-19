import type { JSX } from '@solidjs/web';
import { For } from 'solid-js';
import { Tab, TabGroup, TabList, TabPanel } from 'terracotta/tabs';
import branchesCode from 'virtual:demo-source/graph/branches';
import cartCode from 'virtual:demo-source/graph/cart';
import cutoffCode from 'virtual:demo-source/graph/cutoff';
import lifetimeCode from 'virtual:demo-source/graph/lifetime';
import Demo from '../components/Demo';
import { GraphLegend } from '../components/GraphView';
import PageMeta from '../components/PageMeta';
import { graphScenario } from '../components/islands';
import { scenario as branches } from '../demos/graph/branches';
import { scenario as cart } from '../demos/graph/cart';
import { scenario as cutoff } from '../demos/graph/cutoff';
import { scenario as lifetime } from '../demos/graph/lifetime';

const SCENARIOS = [
  {
    id: 'cart',
    label: 'Laziness',
    title: 'Cart',
    component: graphScenario(cart),
    code: cartCode,
    summary:
      'label is observed, so a write reruns everything it depends on at once. Switch observation off and the derived nodes are released. Read label to bring them back, then change price: now nodes only go dirty and wait to be read.',
  },
  {
    id: 'cutoff',
    label: 'Cutoff',
    title: 'Cutoff',
    component: graphScenario(cutoff),
    code: cutoffCode,
    summary:
      'Add 2 and parity reruns, but returns the same answer. An equal value stops the update there, so message does not run at all.',
  },
  {
    id: 'branches',
    label: 'Dynamic dependencies',
    title: 'Branches',
    component: graphScenario(branches),
    code: branchesCode,
    summary:
      'reading only depends on what it read last time. Turn metric off and its edges move to fahrenheit. Turn it back on and fahrenheit, now read by nothing, is released.',
  },
  {
    id: 'lifetime',
    label: 'Lifetime',
    title: 'Lifetime',
    component: graphScenario(lifetime),
    code: lifetimeCode,
    summary:
      'Nothing holds draft. Write to it, stop observing shout, and both are released. Observe again and draft comes back at its initial value.',
  },
];

export default function Explorer(): JSX.Element {
  return (
    <div class="explorer">
      <PageMeta
        title="Explorer"
        description="Live reactive graphs running on atemno. Write atoms and watch what recomputes, what waits, and what gets released."
      />
      <header class="explorer-header">
        <p class="docs-eyebrow">Explorer</p>
        <h1>Watch the graph work</h1>
        <p class="docs-lead">
          Each graph below is a real <code>ReactiveDomain</code>. Every computed
          records what it read and whether its result changed, and the colors
          come straight from those records. Nothing here reads a computed to
          draw it, so laziness looks exactly like it behaves.
        </p>
        <GraphLegend />
      </header>

      <TabGroup<string>
        class="explorer-tabs"
        horizontal={true}
        defaultValue="cart"
      >
        <TabList class="showcase-tabs" aria-label="Scenario">
          <For each={SCENARIOS}>
            {scenario => (
              <Tab class="showcase-tab" value={scenario.id}>
                {scenario.label}
              </Tab>
            )}
          </For>
        </TabList>
        <For each={SCENARIOS}>
          {scenario => (
            <TabPanel class="explorer-panel" value={scenario.id}>
              <p class="explorer-summary">{scenario.summary}</p>
              <Demo
                title={scenario.title}
                code={scenario.code}
                component={scenario.component}
              />
            </TabPanel>
          )}
        </For>
      </TabGroup>
    </div>
  );
}
