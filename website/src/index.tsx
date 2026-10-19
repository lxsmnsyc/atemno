import { hydrate, render } from '@solidjs/web';
import App from './App';

const root = document.getElementById('root');
if (!root) {
  throw new Error('index.html has no #root element.');
}

// Built pages arrive prerendered, so the app takes over their markup. The
// development server sends an empty root, so the app renders from scratch.
if (root.firstElementChild) {
  hydrate(() => <App />, root);
} else {
  render(() => <App />, root);
}
