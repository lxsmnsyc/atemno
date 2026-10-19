---
title: Dynamic dependencies
description: A computed depends on what it read on its last run. A branch it did not take is not a dependency.
---

## Collected every run

Dependencies are not declared. A computed depends on exactly the sources it read through `$.get` the last time it ran, and the list is rebuilt on every run.

```ts
const reading = computed<string>('reading', $ =>
  $.get(metric) ? `${$.get(celsius)}°C` : `${$.get(fahrenheit)}°F`,
);
```

While `metric` is true, `reading` depends on `metric` and `celsius`. Writing to `fahrenheit`'s inputs cannot touch it.

:::demo graph/branches
Turn **metric** off and the edges move to `fahrenheit`, which runs for the first time. Turn it back on and `fahrenheit`, now read by nothing, is released.
:::

## Dropped dependencies are released

When a rerun stops reading a source, the domain stops tracking it. If nothing else tracks that source, it is released, along with its state. That is usually what you want for derived values. For atoms it can be a surprise; see [node lifetime](./node-lifetime.md).
