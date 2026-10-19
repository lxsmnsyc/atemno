import type { JSX } from '@solidjs/web';
import { For, createSignal } from 'solid-js';
import { Tab, TabGroup, TabList, TabPanel } from 'terracotta/tabs';
import showcase from 'virtual:showcase';
import {
  ArrowRightIcon,
  BoxesIcon,
  BranchIcon,
  EyeIcon,
  GraphIcon,
  HourglassIcon,
  PlayIcon,
  PlugIcon,
  RecycleIcon,
  ScissorsIcon,
} from '../components/Icons';
import PageMeta from '../components/PageMeta';
import { graphScenario } from '../components/islands';
import { scenario as cart } from '../demos/graph/cart';
import { FIRST_PAGE } from '../lib/docs';

const Cart = graphScenario(cart);

const PACKAGE_MANAGERS = [
  { id: 'npm', command: 'npm install atemno' },
  { id: 'pnpm', command: 'pnpm add atemno' },
  { id: 'yarn', command: 'yarn add atemno' },
  { id: 'bun', command: 'bun add atemno' },
];

const FEATURES = [
  {
    icon: BoxesIcon,
    title: 'Descriptions, not state',
    body: 'An atom holds nothing. A ReactiveDomain holds the values, so the same atom carries different state in every domain.',
    href: '/docs/mental-model',
  },
  {
    icon: HourglassIcon,
    title: 'Lazy by default',
    body: 'Writing marks what depends on it stale. A computed reruns when something reads it, and not before.',
    href: '/docs/propagation',
  },
  {
    icon: ScissorsIcon,
    title: 'Equal values stop early',
    body: 'A computed that returns an equal result ends the update there. Nothing downstream of it runs.',
    href: '/docs/propagation#equal-results-stop-the-update',
  },
  {
    icon: BranchIcon,
    title: 'Dependencies per run',
    body: 'A computed depends on what it read last time, so a branch it did not take is not a dependency.',
    href: '/docs/dynamic-dependencies',
  },
  {
    icon: RecycleIcon,
    title: 'Released when unused',
    body: 'A node goes away once nothing tracks it, so keyed state does not pile up behind you.',
    href: '/docs/node-lifetime',
  },
  {
    icon: PlugIcon,
    title: 'Framework agnostic',
    body: 'The core has no framework in it. React ships as a binding, and anything else is one subscription.',
    href: '/docs/other-frameworks',
  },
];

function InstallCommand(): JSX.Element {
  const [copied, setCopied] = createSignal<string>();

  function copy(id: string, command: string): void {
    void navigator.clipboard.writeText(command).then(() => {
      setCopied(id);
      setTimeout(() => {
        setCopied(undefined);
      }, 1500);
    });
  }

  return (
    <TabGroup<string> class="install" horizontal={true} defaultValue="npm">
      <TabList class="install-tabs" aria-label="Package manager">
        <For each={PACKAGE_MANAGERS}>
          {manager => (
            <Tab class="install-tab" value={manager.id}>
              {manager.id}
            </Tab>
          )}
        </For>
      </TabList>
      <For each={PACKAGE_MANAGERS}>
        {manager => (
          <TabPanel class="install-panel" value={manager.id}>
            <code>
              <span class="prompt">$</span> {manager.command}
            </code>
            <button
              type="button"
              class="copy-button"
              onClick={() => {
                copy(manager.id, manager.command);
              }}
            >
              {copied() === manager.id ? 'Copied' : 'Copy'}
            </button>
          </TabPanel>
        )}
      </For>
    </TabGroup>
  );
}

function Showcase(): JSX.Element {
  return (
    <TabGroup<string>
      class="showcase"
      horizontal={true}
      defaultValue={showcase[0].id}
    >
      <TabList class="showcase-tabs" aria-label="Example">
        <For each={showcase}>
          {example => (
            <Tab class="showcase-tab" value={example.id}>
              {example.label}
            </Tab>
          )}
        </For>
      </TabList>
      <For each={showcase}>
        {example => (
          <TabPanel class="showcase-panel" value={example.id}>
            <p class="showcase-description">{example.description}</p>
            <div class="showcase-grid">
              <div innerHTML={example.input} />
              <div class="showcase-output" innerHTML={example.output} />
            </div>
          </TabPanel>
        )}
      </For>
    </TabGroup>
  );
}

export default function Home(): JSX.Element {
  return (
    <div class="home">
      <PageMeta description="Fine-grained reactive state with lazy computeds. Atoms describe values, a ReactiveDomain holds them, and only what something reads ever reruns." />

      <section class="hero">
        <div class="hero-glow" aria-hidden="true" />
        <p class="hero-badge">
          A framework agnostic core, with <strong>React</strong> bindings
        </p>
        <h1 class="hero-title">
          State that only does{' '}
          <span class="gradient-text">the work you read.</span>
        </h1>
        <p class="hero-lead">
          Atoms and computeds describe values. A domain holds them, tracks
          exactly what each computed read, and reruns only what something is
          reading. Write a hundred times and nobody pays until somebody looks.
        </p>
        <div class="hero-actions">
          <a class="button button-primary" href={FIRST_PAGE.href}>
            Get started <ArrowRightIcon />
          </a>
          <a class="button button-secondary" href="/explorer">
            <PlayIcon /> Open the explorer
          </a>
        </div>
        <InstallCommand />
      </section>

      <section class="section live">
        <div class="section-heading">
          <p class="section-kicker">
            <GraphIcon /> Live, not a diagram
          </p>
          <h2>Write an atom. Watch what reruns.</h2>
          <p>
            This is a real domain. Change the price and everything{' '}
            <code>label</code> depends on runs at once, because it is observed.
            Switch that off, read <code>label</code> once, and change the price
            again: now nodes go stale and wait for someone to ask.
          </p>
        </div>
        <Cart />
      </section>

      <section class="section">
        <div class="section-heading">
          <h2>Run at build time, shown as it ran</h2>
          <p>
            The output below came from running each example against atemno when
            this page was built.
          </p>
        </div>
        <Showcase />
      </section>

      <section class="section">
        <div class="feature-grid">
          <For each={FEATURES}>
            {feature => (
              <a class="feature-card" href={feature.href}>
                <span class="feature-icon">
                  <feature.icon />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </a>
            )}
          </For>
        </div>
      </section>

      <section class="section compare-teaser">
        <div class="compare-teaser-body">
          <span class="feature-icon">
            <EyeIcon />
          </span>
          <div>
            <h2>Coming from Jotai or Recoil?</h2>
            <p>
              The atoms will look familiar. Where the state lives, how atoms are
              named, and when it is let go will not. Here is what changes, and
              when the others are the better pick.
            </p>
          </div>
          <a class="button button-secondary" href="/docs/comparison">
            Read the comparison <ArrowRightIcon />
          </a>
        </div>
      </section>

      <section class="section cta">
        <h2>Describe your state. Let a domain hold it.</h2>
        <p>
          Start with the quick start, or poke at the graphs in the explorer.
        </p>
        <div class="hero-actions">
          <a class="button button-primary" href="/docs/quick-start">
            Quick start <ArrowRightIcon />
          </a>
          <a class="button button-secondary" href="/explorer">
            Explorer
          </a>
        </div>
      </section>
    </div>
  );
}
