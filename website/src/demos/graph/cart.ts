import { atom, computed } from 'atemno';
import type { Scenario } from '../../lib/scenario';

function sources() {
  const price = atom('price', 12);
  const quantity = atom('quantity', 2);
  const coupon = atom('coupon', false);

  const subtotal = computed<number>(
    'subtotal',
    $ => $.get(price) * $.get(quantity),
  );
  // Reads the subtotal only while a coupon applies.
  const discount = computed<number>('discount', $ =>
    $.get(coupon) ? Math.round($.get(subtotal) * 0.2) : 0,
  );
  const total = computed<number>(
    'total',
    $ => $.get(subtotal) - $.get(discount),
  );
  const label = computed<string>('label', $ => `$${$.get(total)}`);

  return [price, quantity, coupon, subtotal, discount, total, label];
}

// How the explorer draws it.
export const scenario: Scenario = {
  label:
    'A cart. Price, quantity and coupon feed subtotal and discount, which feed total, which feeds label.',
  sources,
  // The controls stand in for whatever keeps reading the inputs.
  hold: ['price', 'quantity', 'coupon'],
  observe: ['label'],
  layout: {
    price: [0, 0],
    quantity: [0, 1],
    coupon: [0, 2],
    subtotal: [1, 0],
    discount: [1, 2],
    total: [2, 1],
    label: [3, 1],
  },
  controls: [
    { kind: 'stepper', source: 'price', min: 0 },
    { kind: 'stepper', source: 'quantity', min: 0 },
    { kind: 'switch', source: 'coupon' },
    { kind: 'observe', source: 'label' },
    { kind: 'read', source: 'total' },
    { kind: 'read', source: 'label' },
  ],
};
