import lightThemeCss from '@milkdown/crepe/theme/frame.css?inline'
import darkThemeCss from '@milkdown/crepe/theme/frame-dark.css?inline'
import type { ThemeName } from '../shared/types'

/**
 * Theme manager. Crepe ships its variable definitions in separate light/dark
 * theme CSS files; we inject the active one's text into a single <style> tag
 * and swap it on toggle. The app chrome reacts via the data-theme attribute.
 */
const STYLE_ID = 'crepe-active-theme'

function styleEl(): HTMLStyleElement {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  return el
}

export function applyTheme(theme: ThemeName): void {
  styleEl().textContent = theme === 'dark' ? darkThemeCss : lightThemeCss
  document.documentElement.setAttribute('data-theme', theme)
}

export function nextTheme(theme: ThemeName): ThemeName {
  return theme === 'dark' ? 'light' : 'dark'
}
