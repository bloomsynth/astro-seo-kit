declare module 'virtual:astro-seo-kit/config' {
  import type { NormalizedOptions } from './index';
  const config: NormalizedOptions & { site: string };
  export default config;
}
