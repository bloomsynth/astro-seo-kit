declare module 'virtual:astro-seo-kit/config' {
  import type { SeoKitOptions } from './index';
  const config: Required<SeoKitOptions> & { site: string };
  export default config;
}
