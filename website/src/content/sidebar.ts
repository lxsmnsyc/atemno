export interface SidebarSection {
  title: string;
  /** Doc slugs, which are file names in `src/content/docs` without `.md`. */
  pages: string[];
}

/** The docs in sidebar order. Every doc must be listed here. */
export const SIDEBAR: SidebarSection[] = [
  {
    title: 'Getting started',
    pages: ['introduction', 'quick-start', 'mental-model'],
  },
  {
    title: 'Core',
    pages: [
      'atoms',
      'lazy-atoms',
      'domains',
      'observing',
      'computeds',
      'proxy-atoms',
      'resources',
      'producers',
      'propagation',
      'dynamic-dependencies',
      'errors',
      'actions',
      'keyed-state',
      'node-lifetime',
    ],
  },
  {
    title: 'React',
    pages: ['react', 'react-hooks', 'react-devtools'],
  },
  {
    title: 'Guides',
    pages: ['server-rendering', 'testing', 'other-frameworks', 'typescript'],
  },
  {
    title: 'Reference',
    pages: ['api', 'comparison'],
  },
];
