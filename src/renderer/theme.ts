import type { Settings } from '../shared/book'
import { toReaderFileUrl } from '../shared/urls'

export function applySettingsToBody(s: Settings): void {
  document.body.dataset.theme = s.theme
  const root = document.documentElement
  if (s.backgroundImage) {
    const bg = s.backgroundImage.startsWith('data:') ? s.backgroundImage : toReaderFileUrl(s.backgroundImage)
    root.style.setProperty('--reader-bg-image', `url("${bg}")`)
    root.style.setProperty('--reader-bg-opacity', String(s.backgroundOpacity ?? 0.8))
  } else {
    root.style.removeProperty('--reader-bg-image')
  }

  const existing = document.getElementById('custom-reader-font') as HTMLStyleElement | null
  if (s.customFont) {
    const font = s.customFont.startsWith('data:') ? s.customFont : toReaderFileUrl(s.customFont)
    const css = `@font-face{font-family:'CustomReaderFont';src:url("${font}");font-display:swap;}`
    if (existing) {
      existing.textContent = css
    } else {
      const el = document.createElement('style')
      el.id = 'custom-reader-font'
      el.textContent = css
      document.head.appendChild(el)
    }
  } else if (existing) {
    existing.remove()
  }
}

export function resolveFontFamily(fontFamily: string, customFont?: string): string {
  if (fontFamily === 'custom' && customFont) return 'CustomReaderFont'
  if (fontFamily === 'system') return ''
  return `"${fontFamily}"`
}
