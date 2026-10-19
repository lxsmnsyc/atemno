import type { JSX } from '@solidjs/web';
import { type Component, Show, createSignal } from 'solid-js';
import { Tab, TabGroup, TabList, TabPanel } from 'terracotta/tabs';
import { ResetIcon } from './Icons';

export interface DemoProps {
  title: string;
  /** The demo's source, highlighted at build time. */
  code: string;
  /** Rendered markdown. */
  caption?: string;
  component: Component;
}

/**
 * A live example and its source. The example is a real component running
 * real atemno, so what it shows is what the library does.
 */
export default function Demo(props: DemoProps): JSX.Element {
  // Bumping the key remounts the example with a fresh domain.
  const [key, setKey] = createSignal(1);

  return (
    <figure class="demo">
      <TabGroup<string>
        class="demo-tabs"
        horizontal={true}
        defaultValue="preview"
      >
        <div class="demo-toolbar">
          <span class="demo-title">{props.title}</span>
          <TabList class="demo-tablist" aria-label={`${props.title} demo`}>
            <Tab class="demo-tab" value="preview">
              Preview
            </Tab>
            <Tab class="demo-tab" value="code">
              Code
            </Tab>
          </TabList>
          <div class="demo-tools">
            <button
              type="button"
              class="demo-tool"
              title="Start the example over with a fresh domain"
              onClick={() => {
                setKey(value => value + 1);
              }}
            >
              <ResetIcon />
              Restart
            </button>
            <button type="button" class="demo-tool copy-button" data-copy>
              Copy
            </button>
          </div>
        </div>
        <TabPanel class="demo-panel demo-preview" value="preview">
          <Show when={key()} keyed>
            <props.component />
          </Show>
        </TabPanel>
        <TabPanel class="demo-panel demo-code" value="code">
          {/* Highlighted during the build, so no highlighter ships to the browser. */}
          <div innerHTML={props.code} />
        </TabPanel>
      </TabGroup>
      <Show when={props.caption}>
        {caption => <figcaption class="demo-caption" innerHTML={caption()} />}
      </Show>
    </figure>
  );
}
