import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import { type JSX, Loading } from '@solidjs/web';
import { onSettled } from 'solid-js';
import Drawer from './components/Drawer';
import Footer from './components/Footer';
import Header from './components/Header';
import Search from './components/Search';
import onCodeTabClick from './lib/code-tabs';
import onCopyClick from './lib/copy';
import Router from './router';
import './styles.css';

export default function App(props: {
  /** The page to render on the server. The browser reads its own location. */
  url?: string;
}): JSX.Element {
  onSettled(() => {
    document.addEventListener('click', onCopyClick);
    document.addEventListener('click', onCodeTabClick);
    return () => {
      document.removeEventListener('click', onCopyClick);
      document.removeEventListener('click', onCodeTabClick);
    };
  });

  return (
    <Router url={props.url}>
      {route => (
        <>
          <Header />
          {/* Pages load on demand. The boundary keeps the header and footer in
              place while only the page area waits. */}
          <main class="site-main">
            <Loading fallback={<div class="page-loading" />}>
              {route.children}
            </Loading>
          </main>
          <Footer />
          <Search />
          <Drawer />
        </>
      )}
    </Router>
  );
}
