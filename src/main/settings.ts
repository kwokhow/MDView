import Store from 'electron-store'
import type { ThemeName } from '../shared/types'

/** Persisted app settings: window geometry + theme. */
interface SettingsSchema {
  windowBounds: { width: number; height: number; x?: number; y?: number }
  maximized: boolean
  theme: ThemeName
}

const store = new Store<SettingsSchema>({
  defaults: {
    windowBounds: { width: 1100, height: 760 },
    maximized: false,
    theme: 'light'
  }
})

export function getWindowBounds(): SettingsSchema['windowBounds'] {
  return store.get('windowBounds')
}

export function setWindowBounds(bounds: SettingsSchema['windowBounds']): void {
  store.set('windowBounds', bounds)
}

export function getMaximized(): boolean {
  return store.get('maximized')
}

export function setMaximized(value: boolean): void {
  store.set('maximized', value)
}

export function getTheme(): ThemeName {
  return store.get('theme')
}

export function setTheme(theme: ThemeName): void {
  store.set('theme', theme)
}
