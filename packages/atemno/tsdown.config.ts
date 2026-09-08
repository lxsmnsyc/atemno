import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    core: 'src/index.ts',
    react: 'src/bindings/react.ts',
  },
  platform: 'neutral',
  dts: true,
  exports: true,
});
