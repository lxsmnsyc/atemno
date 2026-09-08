import { atom, computed, ReactiveDomain } from 'atemno/core';

console.log(new Date().toString());

const sleep = async (value, ms) =>
  new Promise(res => setTimeout(res, ms, value));

const domain = new ReactiveDomain({
  onError(error) {
    console.log(error);
  },
});

const greeting = atom('greeting', 'Hello');

const receiver = atom('receiver', 'World');

const message = computed('message', async $ => {
  await sleep(true, 500);
  const value = `${$.get(greeting)}, ${$.get(receiver)}!`;
  return value;
});

domain.observe(message, value => {
  void value.then(resolved => {
    console.log('received', resolved);
  });
});

domain.set(greeting, 'Bonjour');
