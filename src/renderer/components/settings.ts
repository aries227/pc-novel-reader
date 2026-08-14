import type { AiProvider, Settings } from '../../shared/book'
import { applySettingsToBody } from '../theme'

export async function openSettingsModal(container: HTMLElement): Promise<void> {
  const s = await window.reader.settings.get()
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal modal-wide">
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
      <h3>AI 服务</h3>
      <p class="hint">支持任意 OpenAI 兼容接口：填写接口地址、API Key 与可用模型即可，可同时配置多家供应商。</p>
      <div class="ai-providers" data-ai-providers></div>
      <button data-act="add-provider">+ 添加供应商</button>
      <div class="ai-defaults">
        <label>翻译默认供应商 <select data-ai-default="translateProvider"></select></label>
        <label>翻译默认模型 <input data-ai-default="translateModel" placeholder="如 deepseek-chat" /></label>
        <label>练习默认供应商 <select data-ai-default="quizProvider"></select></label>
        <label>练习默认模型 <input data-ai-default="quizModel" placeholder="如 deepseek-chat" /></label>
        <label>练习题量 <select data-ai-default="quizCount"></select></label>
        <label>练习难度 <select data-ai-default="quizDifficulty"></select></label>
        <label>自定义提示词 <textarea data-ai-default="quizPrompt" rows="3" placeholder="可选：覆盖默认出题指令"></textarea></label>
        <label>翻译目标 <select data-set="translateTarget"><option>中文</option><option>英文</option><option>日文</option><option>韩文</option></select></label>
      </div>
      <label>上传端口 <select data-set="uploadPortMode"><option value="random">随机</option><option value="fixed">固定</option></select></label>
      <label>上传上限(MB) <input type="number" data-set="maxUploadMb" min="1" max="1024" /></label>
      <div class="update-row">
        <button data-act="check-update">检查更新</button>
        <span class="update-status"></span>
      </div>
      <button data-act="close">关闭</button>
    </div>`
  container.appendChild(overlay)

  function providerCard(p: AiProvider): HTMLElement {
    const card = document.createElement('div')
    card.className = 'ai-provider'
    card.dataset.providerId = p.id
    card.innerHTML = `
      <div class="ai-provider-head">
        <input data-provider-input="name" placeholder="名称（如 DeepSeek / OpenAI / 硅基流动）" value="${escapeHtml(p.name)}" />
        <button data-provider-act="remove" title="删除该供应商">×</button>
      </div>
      <input data-provider-input="baseUrl" placeholder="接口地址，如 https://api.deepseek.com" value="${escapeHtml(p.baseUrl)}" />
      <input data-provider-input="apiKey" type="password" placeholder="API Key" value="${escapeHtml(p.apiKey ?? '')}" />
      <input data-provider-input="models" placeholder="模型（逗号分隔），如 deepseek-chat, deepseek-reasoner" value="${escapeHtml(p.models.join(', '))}" />
      <div class="ai-provider-actions">
        <button data-provider-act="test">测试连接</button>
        <button data-provider-act="fetch">获取模型</button>
        <span class="ai-provider-status"></span>
      </div>`
    return card
  }

  function collectProviders(): AiProvider[] {
    return [...overlay.querySelectorAll<HTMLElement>('.ai-provider')].map((card) => ({
      id: card.dataset.providerId!,
      name: (card.querySelector('[data-provider-input="name"]') as HTMLInputElement).value.trim() || '未命名',
      baseUrl: (card.querySelector('[data-provider-input="baseUrl"]') as HTMLInputElement).value.trim(),
      apiKey: (card.querySelector('[data-provider-input="apiKey"]') as HTMLInputElement).value.trim(),
      models: (card.querySelector('[data-provider-input="models"]') as HTMLInputElement).value
        .split(/[,，]/)
        .map((m) => m.trim())
        .filter(Boolean)
    }))
  }

  async function persistProviders(): Promise<Settings> {
    const next = await window.reader.settings.set({ aiProviders: collectProviders() })
    renderAi(next)
    return next
  }

  function fillDefaultSelect(sel: HTMLSelectElement, providers: AiProvider[], currentId: string): void {
    sel.innerHTML = ''
    providers.forEach((p) => {
      const opt = document.createElement('option')
      opt.value = p.id
      opt.textContent = p.name
      opt.selected = p.id === currentId
      sel.appendChild(opt)
    })
  }

  function renderAi(next: Settings): void {
    const box = overlay.querySelector('[data-ai-providers]') as HTMLElement
    box.innerHTML = ''
    next.aiProviders.forEach((p) => box.appendChild(providerCard(p)))
    const tSel = overlay.querySelector('[data-ai-default="translateProvider"]') as HTMLSelectElement
    const qSel = overlay.querySelector('[data-ai-default="quizProvider"]') as HTMLSelectElement
    fillDefaultSelect(tSel, next.aiProviders, next.aiDefaults.translateProviderId)
    fillDefaultSelect(qSel, next.aiProviders, next.aiDefaults.quizProviderId)
    ;(overlay.querySelector('[data-ai-default="translateModel"]') as HTMLInputElement).value = next.aiDefaults.translateModel
    ;(overlay.querySelector('[data-ai-default="quizModel"]') as HTMLInputElement).value = next.aiDefaults.quizModel
    const countSel = overlay.querySelector('[data-ai-default="quizCount"]') as HTMLSelectElement
    countSel.innerHTML = ''
    for (let i = 1; i <= 12; i++) {
      const opt = document.createElement('option')
      opt.value = String(i)
      opt.textContent = `${i} 道`
      opt.selected = i === next.aiDefaults.quizCount
      countSel.appendChild(opt)
    }
    const diffSel = overlay.querySelector('[data-ai-default="quizDifficulty"]') as HTMLSelectElement
    diffSel.innerHTML = ''
    ;['通用', '初中', '高中', '四级', '六级', '考研', '雅思', '托福', 'GRE'].forEach((d) => {
      const opt = document.createElement('option')
      opt.value = d
      opt.textContent = d
      opt.selected = d === next.aiDefaults.quizDifficulty
      diffSel.appendChild(opt)
    })
    ;(overlay.querySelector('[data-ai-default="quizPrompt"]') as HTMLTextAreaElement).value = next.aiDefaults.customQuizPrompt ?? ''
    wireProviderCards()
  }

  function wireProviderCards(): void {
    overlay.querySelectorAll<HTMLElement>('.ai-provider').forEach((card) => {
      card.querySelectorAll<HTMLElement>('[data-provider-input]').forEach((el) => {
        el.addEventListener('change', () => {
          void persistProviders()
        })
      })
      card.querySelector('[data-provider-act="remove"]')!.addEventListener('click', () => {
        card.remove()
        void persistProviders()
      })
      card.querySelector('[data-provider-act="test"]')!.addEventListener('click', () => {
        void runProviderAction(card, 'test')
      })
      card.querySelector('[data-provider-act="fetch"]')!.addEventListener('click', () => {
        void runProviderAction(card, 'fetch')
      })
    })
  }

  async function runProviderAction(card: HTMLElement, act: 'test' | 'fetch'): Promise<void> {
    const provider = collectProviders().find((p) => p.id === card.dataset.providerId)!
    const status = card.querySelector('.ai-provider-status') as HTMLElement
    status.textContent = act === 'test' ? '测试中…' : '获取中…'
    try {
      if (act === 'test') {
        const r = await window.reader.ai.test(provider)
        status.textContent = r.ok ? `连接成功，共 ${r.models.length} 个模型` : r.message
      } else {
        const models = await window.reader.ai.fetchModels(provider)
        ;(card.querySelector('[data-provider-input="models"]') as HTMLInputElement).value = models.join(', ')
        await persistProviders()
        status.textContent = `已获取 ${models.length} 个模型`
      }
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : '操作失败'
    }
  }

  overlay.querySelector('[data-act="add-provider"]')!.addEventListener('click', () => {
    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const box = overlay.querySelector('[data-ai-providers]') as HTMLElement
    box.appendChild(providerCard({ id, name: '新供应商', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }))
    wireProviderCards()
    void persistProviders()
  })

  overlay.querySelector('[data-ai-default="translateProvider"]')!.addEventListener('change', async (e) => {
    const sel = e.target as HTMLSelectElement
    const provider = collectProviders().find((p) => p.id === sel.value)
    const next = await window.reader.settings.set({
      aiDefaults: {
        ...(await window.reader.settings.get()).aiDefaults,
        translateProviderId: sel.value,
        translateModel: provider?.models[0] ?? ''
      }
    })
    renderAi(next)
  })

  overlay.querySelector('[data-ai-default="quizProvider"]')!.addEventListener('change', async (e) => {
    const sel = e.target as HTMLSelectElement
    const provider = collectProviders().find((p) => p.id === sel.value)
    const next = await window.reader.settings.set({
      aiDefaults: {
        ...(await window.reader.settings.get()).aiDefaults,
        quizProviderId: sel.value,
        quizModel: provider?.models[0] ?? ''
      }
    })
    renderAi(next)
  })

  overlay.querySelector('[data-ai-default="translateModel"]')!.addEventListener('change', async (e) => {
    const next = await window.reader.settings.set({
      aiDefaults: { ...(await window.reader.settings.get()).aiDefaults, translateModel: (e.target as HTMLInputElement).value.trim() }
    })
    renderAi(next)
  })

  overlay.querySelector('[data-ai-default="quizModel"]')!.addEventListener('change', async (e) => {
    const next = await window.reader.settings.set({
      aiDefaults: { ...(await window.reader.settings.get()).aiDefaults, quizModel: (e.target as HTMLInputElement).value.trim() }
    })
    renderAi(next)
  })

  overlay.querySelector('[data-ai-default="quizCount"]')!.addEventListener('change', async (e) => {
    const next = await window.reader.settings.set({
      aiDefaults: { ...(await window.reader.settings.get()).aiDefaults, quizCount: Number((e.target as HTMLSelectElement).value) }
    })
    renderAi(next)
  })

  overlay.querySelector('[data-ai-default="quizDifficulty"]')!.addEventListener('change', async (e) => {
    const next = await window.reader.settings.set({
      aiDefaults: { ...(await window.reader.settings.get()).aiDefaults, quizDifficulty: (e.target as HTMLSelectElement).value }
    })
    renderAi(next)
  })

  overlay.querySelector('[data-ai-default="quizPrompt"]')!.addEventListener('change', async (e) => {
    const value = (e.target as HTMLTextAreaElement).value.trim()
    const next = await window.reader.settings.set({
      aiDefaults: { ...(await window.reader.settings.get()).aiDefaults, customQuizPrompt: value || undefined }
    })
    renderAi(next)
  })

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

  renderAi(s)
}

function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
