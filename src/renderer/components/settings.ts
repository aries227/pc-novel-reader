import { applySettingsToBody } from '../theme'

export async function openSettingsModal(container: HTMLElement): Promise<void> {
  const s = await window.reader.settings.get()
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal">
      <h2>设置</h2>
      <label>主题 <select data-set="theme"><option value="light">白</option><option value="sepia">米黄</option><option value="dark">夜间</option><option value="green">护眼绿</option></select></label>
      <label>默认字号 <input type="number" data-set="fontSize" min="12" max="32" /></label>
      <label>默认行距 <input type="number" data-set="lineHeight" min="1.2" max="2.6" step="0.1" /></label>
      <label>字体 <select data-set="fontFamily"><option value="system">系统默认</option><option value="宋体">宋体</option><option value="楷体">楷体</option><option value="黑体">黑体</option><option value="微软雅黑">微软雅黑</option><option value="custom">自定义字体</option></select></label>
      <div class="asset-row">
        <button data-act="upload-bg">上传背景图片</button>
        <button data-act="clear-bg">清除背景</button>
        <button data-act="upload-font">上传字体</button>
        <button data-act="clear-font">清除字体</button>
      </div>
      <hr />
      <label>DeepSeek API Key <input type="password" data-set="translateApiKey" placeholder="sk-..." /></label>
      <label>翻译目标 <select data-set="translateTarget"><option>中文</option><option>英文</option><option>日文</option><option>韩文</option></select></label>
      <label>接口地址 <input data-set="translateBaseUrl" /></label>
      <label>模型 <input data-set="translateModel" /></label>
      <label>上传端口 <select data-set="uploadPortMode"><option value="random">随机</option><option value="fixed">固定</option></select></label>
      <label>上传上限(MB) <input type="number" data-set="maxUploadMb" min="1" max="1024" /></label>
      <div class="update-row">
        <button data-act="check-update">检查更新</button>
        <span class="update-status"></span>
      </div>
      <button data-act="close">关闭</button>
    </div>`
  container.appendChild(overlay)
  overlay.querySelectorAll('[data-set]').forEach((el) => {
    const key = (el as HTMLElement).dataset.set!
    ;(el as HTMLInputElement).value = String((s as unknown as Record<string, unknown>)[key])
    el.addEventListener('change', async () => {
      const raw = (el as HTMLInputElement).value
      const patch: Record<string, unknown> = { [key]: ['fontSize', 'lineHeight', 'maxUploadMb'].includes(key) ? Number(raw) : raw }
      const next = await window.reader.settings.set(patch as never)
      applySettingsToBody(next)
    })
  })
  overlay.querySelector('[data-act="upload-bg"]')!.addEventListener('click', async () => {
    applySettingsToBody(await window.reader.settings.uploadBackground())
  })
  overlay.querySelector('[data-act="clear-bg"]')!.addEventListener('click', async () => {
    applySettingsToBody(await window.reader.settings.clearBackground())
  })
  overlay.querySelector('[data-act="upload-font"]')!.addEventListener('click', async () => {
    applySettingsToBody(await window.reader.settings.uploadFont())
  })
  overlay.querySelector('[data-act="clear-font"]')!.addEventListener('click', async () => {
    applySettingsToBody(await window.reader.settings.clearFont())
  })
  const statusEl = overlay.querySelector('.update-status') as HTMLElement
  const unsub = window.reader.update.onStatus((status) => {
    if (status.phase === 'checking') statusEl.textContent = '正在检查更新…'
    else if (status.phase === 'available') statusEl.textContent = `发现新版本 v${status.version}，正在后台下载…`
    else if (status.phase === 'downloading') statusEl.textContent = `下载中 ${Math.round(status.percent ?? 0)}%`
    else if (status.phase === 'downloaded') statusEl.textContent = '已下载，重启应用即可安装更新'
    else if (status.phase === 'up-to-date') statusEl.textContent = '已是最新版本'
    else if (status.phase === 'error') statusEl.textContent = status.message ?? '检查更新失败'
  })
  overlay.querySelector('[data-act="check-update"]')!.addEventListener('click', () => {
    void window.reader.update.check()
  })
  overlay.querySelector('[data-act="close"]')!.addEventListener('click', () => {
    unsub()
    overlay.remove()
  })
}
