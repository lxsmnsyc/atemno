import type { JSX } from '@solidjs/web';
import { type Component, For, onSettled } from 'solid-js';
import type { Scenario, ScenarioControl } from '../lib/scenario';
import { Actions, Stepper, Switch } from './GraphControls';
import GraphDemo from './GraphDemo';

/** A demo that renders itself with plain DOM calls, and cleans up after itself. */
export interface DomDemo {
  mount: (root: HTMLElement) => () => void;
}

/** A demo that the explorer draws as a live graph. */
export interface GraphDemoModule {
  scenario: Scenario;
}

export type DemoModule = DomDemo | GraphDemoModule;

/**
 * Hands a demo an element of its own. The demos are framework free on
 * purpose: they show atemno, not whatever the site happens to be built with.
 */
function domIsland(demo: DomDemo): Component {
  return function DomIsland(): JSX.Element {
    let host: HTMLDivElement | undefined;

    onSettled(() => (host ? demo.mount(host) : undefined));

    return <div class="dom-island" ref={element => (host = element)} />;
  };
}

function isButton(control: ScenarioControl): boolean {
  return (
    control.kind === 'read' ||
    control.kind === 'write' ||
    control.kind === 'add'
  );
}

/** Draws a scenario's graph with the controls it describes. */
export function graphScenario(scenario: Scenario): Component {
  return function GraphScenario(): JSX.Element {
    const rows = scenario.controls.filter(control => !isButton(control));
    const buttons = scenario.controls.filter(isButton);

    return (
      <GraphDemo
        label={scenario.label}
        setup={() => ({
          sources: scenario.sources(),
          hold: scenario.hold,
          observe: scenario.observe,
        })}
        layout={scenario.layout}
        controls={graph => (
          <>
            <For each={rows}>
              {control => {
                if (control.kind === 'stepper') {
                  return (
                    <Stepper
                      label={control.source}
                      step={control.step}
                      min={control.min}
                      value={graph.valueOf<number>(control.source)}
                      onChange={value => graph.write(control.source, value)}
                    />
                  );
                }
                if (control.kind === 'switch') {
                  return (
                    <Switch
                      label={control.source}
                      checked={graph.valueOf<boolean>(control.source)}
                      onChange={value => graph.write(control.source, value)}
                    />
                  );
                }
                return (
                  <Switch
                    label={`observe ${control.source}`}
                    checked={graph.isObserved(control.source)}
                    onChange={on =>
                      on
                        ? graph.observe(control.source)
                        : graph.unobserve(control.source)
                    }
                  />
                );
              }}
            </For>
            <Actions>
              <For each={buttons}>
                {control => (
                  <button
                    type="button"
                    onClick={() => {
                      if (control.kind === 'write') {
                        graph.write(control.source, control.value);
                      } else if (control.kind === 'add') {
                        graph.write<number>(
                          control.source,
                          value => value + control.amount,
                        );
                      } else {
                        graph.read(control.source);
                      }
                    }}
                  >
                    {control.kind === 'write' || control.kind === 'add'
                      ? control.label
                      : `Read ${control.source}`}
                  </button>
                )}
              </For>
            </Actions>
          </>
        )}
      />
    );
  };
}

/** The component a page renders for a demo module of either kind. */
export function demoComponent(module: DemoModule): Component {
  return 'scenario' in module
    ? graphScenario(module.scenario)
    : domIsland(module);
}
