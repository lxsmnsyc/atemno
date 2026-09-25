import { AtemnoDomain } from 'atemno/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const host = document.getElementById('root');

if (!host) {
  throw new Error('Missing #root element.');
}

createRoot(host).render(
  <StrictMode>
    <AtemnoDomain
      devtools={import.meta.env.DEV}
      onError={error => {
        console.error(error);
      }}
    >
      <App />
    </AtemnoDomain>
  </StrictMode>,
);
