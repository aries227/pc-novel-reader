let overlay: HTMLElement | null = null

export function showLoading(message: string, percent?: number): void {
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.className = 'loading-overlay'
    overlay.innerHTML = `
      <div class="loading-card">
        <div class="loading-spinner"></div>
        <div class="loading-message"></div>
        <div class="loading-bar hidden"><div class="loading-bar-fill"></div></div>
      </div>`
    document.body.appendChild(overlay)
  }
  updateLoading(message, percent)
}

export function updateLoading(message: string, percent?: number): void {
  if (!overlay) return
  ;(overlay.querySelector('.loading-message') as HTMLElement).textContent = message
  const bar = overlay.querySelector('.loading-bar') as HTMLElement
  const fill = overlay.querySelector('.loading-bar-fill') as HTMLElement
  if (percent == null) {
    bar.classList.add('hidden')
    fill.style.width = '0%'
  } else {
    bar.classList.remove('hidden')
    fill.style.width = `${Math.max(0, Math.min(100, percent))}%`
  }
}

export function hideLoading(): void {
  overlay?.remove()
  overlay = null
}
