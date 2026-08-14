import type { Quiz, QuizQuestion, VocabEntry } from '../../shared/ipc'
import { hideLoading, showLoading } from './loading'

const STATE_LABELS: Record<VocabEntry['reviewState'], string> = {
  new: '新词',
  learning: '学习中',
  mastered: '已掌握'
}

const TYPE_LABELS: Record<QuizQuestion['type'], string> = {
  reading: '阅读理解',
  choice: '选择题',
  translation: '翻译题',
  grammar: '语法题'
}

export async function openVocabModal(container: HTMLElement): Promise<void> {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal modal-wide vocab-modal">
      <h2>生词本</h2>
      <div class="vocab-tools"><button data-act="import-dict">导入词典</button><span class="dict-stats"></span></div>
      <div class="vocab-list"></div>
      <button data-act="close">关闭</button>
    </div>`
  container.appendChild(overlay)

  async function render(): Promise<void> {
    const list = await window.reader.vocab.list()
    const stats = await window.reader.dictionary.stats()
    const statsEl = overlay.querySelector('.dict-stats') as HTMLElement
    statsEl.textContent = stats > 0 ? `已导入 ${stats} 条` : ''
    const box = overlay.querySelector('.vocab-list') as HTMLElement
    box.innerHTML = ''
    if (list.length === 0) {
      box.innerHTML = '<p class="hint">还没有生词。阅读时选中单词点「收藏」即可加入。</p>'
      return
    }
    list.forEach((e) => box.appendChild(entryCard(e)))
  }

  function entryCard(e: VocabEntry): HTMLElement {
    const card = document.createElement('div')
    card.className = 'vocab-entry'
    const src = [e.sourceBook, e.sourceChapter].filter(Boolean).join(' · ')
    card.innerHTML = `
      <div class="vocab-head">
        <strong>${esc(e.word)}</strong>
        ${e.phonetic ? `<span class="vocab-phonetic">${esc(e.phonetic)}</span>` : ''}
        ${src ? `<span class="vocab-src">${esc(src)}</span>` : ''}
      </div>
      <div class="vocab-trans">${esc(e.translation ?? '')}</div>
      ${e.contextSentence ? `<div class="vocab-context">${esc(e.contextSentence)}</div>` : ''}
      ${e.examples.length ? `<ul class="vocab-examples">${e.examples.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <div class="vocab-actions">
        <select data-vocab-state>
          ${(Object.keys(STATE_LABELS) as VocabEntry['reviewState'][])
            .map((s) => `<option value="${s}" ${s === e.reviewState ? 'selected' : ''}>${STATE_LABELS[s]}</option>`)
            .join('')}
        </select>
        <button data-vocab-act="delete">删除</button>
      </div>`
    card.querySelector('[data-vocab-state]')!.addEventListener('change', async (ev) => {
      await window.reader.vocab.update(e.id, { reviewState: (ev.target as HTMLSelectElement).value as VocabEntry['reviewState'] })
    })
    card.querySelector('[data-vocab-act="delete"]')!.addEventListener('click', async () => {
      await window.reader.vocab.remove(e.id)
      await render()
    })
    return card
  }

  overlay.querySelector('[data-act="close"]')!.addEventListener('click', () => overlay.remove())
  overlay.querySelector('[data-act="import-dict"]')!.addEventListener('click', async () => {
    const btn = overlay.querySelector('[data-act="import-dict"]') as HTMLButtonElement
    btn.disabled = true
    try {
      const r = await window.reader.dictionary.import()
      alert(r.added > 0 ? `导入成功：新增 ${r.added} 条，当前共 ${r.total} 条` : `没有新增条目，当前共 ${r.total} 条`)
    } catch (err) {
      alert(err instanceof Error ? err.message : '导入失败')
    } finally {
      btn.disabled = false
      await render()
    }
  })
  await render()
}

export interface QuizModalOptions {
  bookId: string
  chapterTitle: string
  chapterText: string
  chapterIndex?: number
}

export async function createQuizWidget(host: HTMLElement, opts: QuizModalOptions): Promise<void> {
  const settings = await window.reader.settings.get()
  let quizCount = settings.aiDefaults.quizCount ?? 4
  let quizDifficulty = settings.aiDefaults.quizDifficulty ?? '通用'
  host.innerHTML = `
    <div class="quiz-controls">
      <label>题量 <select data-quiz-count></select></label>
      <label>难度 <select data-quiz-difficulty></select></label>
    </div>
    <details class="quiz-passage">
      <summary>本章原文（点开对照着做）</summary>
      <div class="quiz-passage-text"></div>
    </details>
    <div class="quiz-body">正在生成练习…（需在设置中配置练习用的 AI 供应商与 Key）</div>
    <div class="quiz-actions">
      <button data-act="submit">提交</button>
      <button data-act="regenerate">重新生成</button>
    </div>`
  ;(host.querySelector('.quiz-passage-text') as HTMLElement).textContent = opts.chapterText.slice(0, 8000)

  const countSel = host.querySelector('[data-quiz-count]') as HTMLSelectElement
  for (let i = 1; i <= 12; i++) {
    const opt = document.createElement('option')
    opt.value = String(i)
    opt.textContent = `${i} 道`
    opt.selected = i === quizCount
    countSel.appendChild(opt)
  }
  const diffSel = host.querySelector('[data-quiz-difficulty]') as HTMLSelectElement
  ;['通用', '初中', '高中', '四级', '六级', '考研', '雅思', '托福', 'GRE'].forEach((d) => {
    const opt = document.createElement('option')
    opt.value = d
    opt.textContent = d
    opt.selected = d === quizDifficulty
    diffSel.appendChild(opt)
  })
  async function saveQuizPrefs(): Promise<void> {
    const cur = await window.reader.settings.get()
    await window.reader.settings.set({ aiDefaults: { ...cur.aiDefaults, quizCount, quizDifficulty } })
  }
  countSel.addEventListener('change', () => {
    quizCount = Number(countSel.value)
    void saveQuizPrefs()
  })
  diffSel.addEventListener('change', () => {
    quizDifficulty = diffSel.value
    void saveQuizPrefs()
  })

  let quiz: Quiz | null = null
  const answers = new Map<string, string>()

  async function generate(force: boolean): Promise<void> {
    const body = host.querySelector('.quiz-body') as HTMLElement
    body.textContent = '正在生成练习…（需在设置中配置练习用的 AI 供应商与 Key）'
    try {
      showLoading('正在生成练习…')
      quiz = await window.reader.ai.quiz({
        ...opts,
        chapterIndex: opts.chapterIndex ?? 0,
        count: quizCount,
        difficulty: quizDifficulty,
        force
      })
      answers.clear()
      renderQuiz()
    } catch (err) {
      body.textContent = err instanceof Error ? err.message : '生成失败'
    } finally {
      hideLoading()
    }
  }

  function renderQuiz(): void {
    if (!quiz) return
    const body = host.querySelector('.quiz-body') as HTMLElement
    body.innerHTML = `<h3>${esc(quiz.title)}</h3>` + quiz.questions.map((q) => {
      let control = ''
      if (q.options?.length) {
        control = q.options
          .map((o) => `<label class="quiz-option"><input type="radio" name="${q.id}" value="${esc(o)}" data-quiz-answer="${q.id}" /> ${esc(o)}</label>`)
          .join('')
      } else {
        control = `<input type="text" data-quiz-answer="${q.id}" placeholder="输入你的答案" />`
      }
      return `
        <div class="quiz-question" data-quiz-q="${q.id}">
          <p class="quiz-qtext"><b>${TYPE_LABELS[q.type]}</b> ${esc(q.question)}</p>
          ${control}
          <div class="quiz-feedback hidden"></div>
        </div>`
    }).join('')
    body.querySelectorAll<HTMLInputElement>('[data-quiz-answer]').forEach((el) => {
      el.addEventListener('change', () => {
        const key = el.dataset.quizAnswer!
        answers.set(key, el.type === 'radio' ? el.value : el.value.trim())
      })
    })
  }

  host.querySelector('[data-act="submit"]')!.addEventListener('click', () => {
    if (!quiz) return
    let score = 0
    const body = host.querySelector('.quiz-body') as HTMLElement
    quiz.questions.forEach((q) => {
      const box = host.querySelector(`[data-quiz-q="${q.id}"]`) as HTMLElement
      const fb = box.querySelector('.quiz-feedback') as HTMLElement
      const checked = box.querySelector<HTMLInputElement>('input[type="radio"]:checked')
      const text = box.querySelector<HTMLInputElement>('input[type="text"]')
      const answer = checked?.value ?? text?.value.trim() ?? ''
      const correct = answer.trim().toLowerCase() === q.answer.trim().toLowerCase()
      if (correct) score++
      fb.classList.remove('hidden')
      fb.textContent = `${correct ? '✓ 正确' : `✗ 正确答案：${q.answer}`} — ${q.explanation}`
    })
    const h3 = body.querySelector('h3')
    if (h3 && quiz) h3.textContent = `${quiz.title}（得分 ${score}/${quiz.questions.length}）`
  })
  host.querySelector('[data-act="regenerate"]')!.addEventListener('click', () => {
    void generate(true)
  })
  void generate(false)
}

export async function openQuizModal(container: HTMLElement, opts: QuizModalOptions): Promise<void> {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal modal-wide quiz-modal">
      <h2>本章练习</h2>
      <div class="quiz-widget"></div>
      <div class="quiz-actions">
        <button data-act="close">关闭</button>
      </div>
    </div>`
  container.appendChild(overlay)
  overlay.querySelector('[data-act="close"]')!.addEventListener('click', () => overlay.remove())
  await createQuizWidget(overlay.querySelector('.quiz-widget') as HTMLElement, opts)
}

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
