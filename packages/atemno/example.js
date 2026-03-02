import { atom, computed, ReactiveDomain } from './dist/esm/development/index.mjs';

const sleep = async (value, ms) => new Promise((res) => setTimeout(res, ms, value));

const domain = new ReactiveDomain({
  onError(error) {
    console.log(error);
  },
});

const greeting = atom('greeting', 'Hello');

const receiver = atom('receiver', 'World');

const message = computed('message', async ($) => {
  await sleep(true, 500)
  const value = `${$.get(greeting)}, ${$.get(receiver)}!`;
  return value;
});

domain.observe(message, async (value) => {
  console.log('received', await value);
});

domain.set(greeting, 'Bonjour');

setTimeout(() => {
  domain.set(receiver, 'France');
}, 1000);
