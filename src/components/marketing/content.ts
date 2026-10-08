import raw from 'virtual:squash-content'
import type { ContentManifest } from './content-types'

/** Doc titles, headings and the release list, rendered at build time (vite-plugin-content.ts). */
export const content = raw as ContentManifest
