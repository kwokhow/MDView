import type { ThemeName } from '../../shared/types'

/**
 * Every colour in the app — chrome, editor and preview — is a CSS variable
 * keyed off data-theme, so switching theme is a single attribute change.
 */
export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme
}

export function nextTheme(theme: ThemeName): ThemeName {
  return theme === 'dark' ? 'light' : 'dark'
}
