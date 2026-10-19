import type { JSX } from '@solidjs/web';

/** A labelled number with buttons either side of it. */
export function Stepper(props: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  onChange: (value: number) => void;
}): JSX.Element {
  const step = (): number => props.step ?? 1;
  const atMin = (): boolean =>
    props.min !== undefined && props.value - step() < props.min;

  return (
    <div class="control-row">
      <span class="control-label">{props.label}</span>
      <div class="stepper">
        <button
          type="button"
          aria-label={`Decrease ${props.label}`}
          disabled={atMin()}
          onClick={() => {
            props.onChange(props.value - step());
          }}
        >
          −
        </button>
        <output>{props.value}</output>
        <button
          type="button"
          aria-label={`Increase ${props.label}`}
          onClick={() => {
            props.onChange(props.value + step());
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

/** A labelled switch. */
export function Switch(props: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <div class="control-row">
      <span class="control-label">{props.label}</span>
      <button
        type="button"
        role="switch"
        class="switch"
        aria-checked={props.checked ? 'true' : 'false'}
        aria-label={props.label}
        onClick={() => {
          props.onChange(!props.checked);
        }}
      >
        <span class="switch-thumb" />
      </button>
    </div>
  );
}

/** A row of plain buttons. */
export function Actions(props: { children: JSX.Element }): JSX.Element {
  return <div class="control-actions">{props.children}</div>;
}
