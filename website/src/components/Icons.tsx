import type { JSX } from '@solidjs/web';

interface IconProps {
  class?: string;
}

function Icon(props: IconProps & { children: JSX.Element }): JSX.Element {
  return (
    <svg
      class={props.class ? `icon ${props.class}` : 'icon'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  );
}

/** Two atoms feeding one computed: the whole library in a glyph. */
export function LogoMark(props: IconProps): JSX.Element {
  return (
    <svg
      class={props.class ? `logo-mark ${props.class}` : 'logo-mark'}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        class="logo-edge"
        d="M7.4 7.3c4 0 5.6 1.6 8.1 3.7M7.4 16.7c4 0 5.6-1.6 8.1-3.7"
        fill="none"
        stroke-width="1.8"
        stroke-linecap="round"
      />
      <circle class="logo-atom" cx="5" cy="7" r="2.7" />
      <circle class="logo-atom" cx="5" cy="17" r="2.7" />
      <rect
        class="logo-computed"
        x="15"
        y="8.6"
        width="7"
        height="6.8"
        rx="2.2"
      />
    </svg>
  );
}

export function MenuIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </Icon>
  );
}

export function GitHubIcon(props: IconProps): JSX.Element {
  return (
    <svg
      class={props.class ? `icon ${props.class}` : 'icon'}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.85-2.34 4.7-4.57 4.94.36.31.68.92.68 1.86v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
    </svg>
  );
}

export function SunIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </Icon>
  );
}

export function MoonIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}

export function ArrowLeftIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Icon>
  );
}

export function EditIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </Icon>
  );
}

export function FileIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </Icon>
  );
}

export function HashIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" />
    </Icon>
  );
}

export function ReturnIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M20 5v7a3 3 0 0 1-3 3H5M9 11l-4 4 4 4" />
    </Icon>
  );
}

export function PlayIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M7 4.5v15l12-7.5z" />
    </Icon>
  );
}

export function GraphIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <circle cx="5.5" cy="6" r="2.5" />
      <circle cx="5.5" cy="18" r="2.5" />
      <rect x="15" y="9.5" width="6" height="5" rx="1.6" />
      <path d="M8 6.5c3.5 0 4.5 2 7 4.2M8 17.5c3.5 0 4.5-2 7-4.2" />
    </Icon>
  );
}

export function HourglassIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9" />
    </Icon>
  );
}

export function BoxesIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <rect x="3" y="4" width="8" height="8" rx="1.5" />
      <rect x="13" y="12" width="8" height="8" rx="1.5" />
      <path d="M15 4h4a2 2 0 0 1 2 2v3M9 20H5a2 2 0 0 1-2-2v-3" />
    </Icon>
  );
}

export function BranchIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <circle cx="6" cy="5" r="2.2" />
      <circle cx="6" cy="19" r="2.2" />
      <circle cx="18" cy="9" r="2.2" />
      <path d="M6 7.2v9.6M18 11.2c0 4-6 3-11 5.8" />
    </Icon>
  );
}

export function ScissorsIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M8.5 7.7 20 18M8.5 16.3 20 6" />
    </Icon>
  );
}

export function RecycleIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 9" />
      <path d="M20 4v5h-5" />
      <path d="M20 12a8 8 0 0 1-13.7 5.6L4 15" />
      <path d="M4 20v-5h5" />
    </Icon>
  );
}

export function PlugIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5" />
    </Icon>
  );
}

export function EyeIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function ResetIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6" />
      <path d="M4 4v4.6h4.6" />
    </Icon>
  );
}
