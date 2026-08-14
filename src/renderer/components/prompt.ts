export function promptModal(title: string, defaultValue = ''): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    overlay.innerHTML = `
      <div class="modal prompt-modal">
        <h2>${esc(title)}</h2>
        <input type="text" class="prompt-input" value="${esc(defaultValue)}" />
        <div class="modal-actions">
          <button data-act="ok">确定</button>
          <button data-act="cancel">取消</button>
        </div>
      </div>`
    document.body.appendChild(overlay)
    const input = overlay.querySelector('.prompt-input') as HTMLInputElement
    input.focus()
    input.select()
    function done(value: string | null): void {
      overlay.remove()
      resolve(value)
    }
    overlay.querySelector('[data-act="ok"]')!.addEventListener('click', () => done(input.value))
    overlay.querySelector('[data-act="cancel"]')!.addEventListener('click', () => done(null))
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done(input.value)
      else if (e.key === 'Escape') done(null)
    })
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) done(null)
    })
  })
}

export function confirmModal(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    overlay.innerHTML = `
      <div class="modal confirm-modal">
        <h2>${esc(title)}</h2>
        <p>${esc(message)}</p>
        <div class="modal-actions">
          <button data-act="ok">确定</button>
          <button data-act="cancel">取消</button>
        </div>
      </div>`
    document.body.appendChild(overlay)
    function done(value: boolean): void {
      overlay.remove()
      resolve(value)
    }
    overlay.querySelector('[data-act="ok"]')!.addEventListener('click', () => done(true))
    overlay.querySelector('[data-act="cancel"]')!.addEventListener('click', () => done(false))
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') done(false)
    })
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) done(false)
    })
  })
}

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
