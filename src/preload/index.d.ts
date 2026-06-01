import type { MdViewApi } from '../shared/types'

declare global {
  interface Window {
    api: MdViewApi
  }
}

export {}
