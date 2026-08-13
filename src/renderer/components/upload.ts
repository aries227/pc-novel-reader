export async function openUploadModal(container: HTMLElement, onUploaded: () => void): Promise<void> {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal">
      <h2>扫码上传</h2>
      <p class="upload-hint">用手机扫一扫，在浏览器里选择书籍文件上传</p>
      <div class="upload-qr"></div>
      <p class="upload-url"></p>
      <div class="modal-actions">
        <button data-act="start">启动服务</button>
        <button data-act="stop">停止</button>
        <button data-act="close">关闭</button>
      </div>
    </div>`
  container.appendChild(overlay)
  const qrEl = overlay.querySelector('.upload-qr') as HTMLElement
  const urlEl = overlay.querySelector('.upload-url') as HTMLElement

  async function refresh(): Promise<void> {
    const s = await window.reader.upload.status()
    if (s.running && s.qrDataUrl) {
      qrEl.innerHTML = `<img src="${s.qrDataUrl}" alt="二维码" />`
      urlEl.textContent = s.url ?? ''
    }
  }

  overlay.querySelector('[data-act="start"]')!.addEventListener('click', async () => {
    const s = await window.reader.upload.start()
    if (s.running && s.qrDataUrl) {
      qrEl.innerHTML = `<img src="${s.qrDataUrl}" alt="二维码" />`
      urlEl.textContent = s.url ?? ''
    }
  })
  overlay.querySelector('[data-act="stop"]')!.addEventListener('click', async () => {
    await window.reader.upload.stop()
    qrEl.innerHTML = ''
    urlEl.textContent = ''
  })
  overlay.querySelector('[data-act="close"]')!.addEventListener('click', () => overlay.remove())
  await refresh()
}
