import { ReactiveDomain, atom, computed } from './dist/esm/development/index.mjs';

const domain = new ReactiveDomain({
  onError(error) {
    console.log(error);
  },
});

const greeting = atom('Hello');

const receiver = atom('World');

const message = computed(($) => `${$.get(greeting)}, ${$.get(receiver)}!`);

// domain.observe(message, (value) => {
//   console.log('received', value);
// });

domain.effect(($) => {
  console.log('received', $.get(message));
})

domain.set(greeting, 'Bonjour');
