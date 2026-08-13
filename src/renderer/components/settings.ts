export async function openSettingsModal(container: HTMLElement): Promise<void> {
  const s = await window.reader.settings.get()
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal">
      <h2>设置</h2>
      <label>主题 <select data-set="theme"><option value="light">白</option><option value="sepia">米黄</option><option value="dark">夜间</option></select></label>
      <label>默认字号 <input type="number" data-set="fontSize" min="12" max="32" /></label>
      <label>默认行距 <input type="number" data-set="lineHeight" min="1.2" max="2.6" step="0.1" /></label>
      <label>上传端口 <select data-set="uploadPortMode"><option value="random">随机</option><option value="fixed">固定</option></select></label>
      <label>上传上限(MB) <input type="number" data-set="maxUploadMb" min="1" max="1024" /></label>
      <button data-act="close">关闭</button>
    </div>`
  container.appendChild(overlay)
  overlay.querySelectorAll('[data-set]').forEach((el) => {
    const key = (el as HTMLElement).dataset.set!
    ;(el as HTMLInputElement).value = String((s as unknown as Record<string, unknown>)[key])
    el.addEventListener('change', async () => {
      const raw = (el as HTMLInputElement).value
      const patch: Record<string, unknown> = { [key]: ['fontSize', 'lineHeight', 'maxUploadMb'].includes(key) ? Number(raw) : raw }
      await window.reader.settings.set(patch as never)
      document.body.dataset.theme = key === 'theme' ? raw : document.body.dataset.theme
    })
  })
  overlay.querySelector('[data-act="close"]')!.addEventListener('click', () => overlay.remove())
}
