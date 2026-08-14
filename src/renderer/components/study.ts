import type { Quiz, QuizQuestion, VocabEntry } from '../../shared/ipc'

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
      <div class="vocab-list"></div>
      <button data-act="close">关闭</button>
    </div>`
  container.appendChild(overlay)

  async function render(): Promise<void> {
    const list = await window.reader.vocab.list()
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
  await render()
}

export interface QuizModalOptions {
  bookId: string
  chapterTitle: string
  chapterText: string
}

export async function openQuizModal(container: HTMLElement, opts: QuizModalOptions): Promise<void> {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal modal-wide quiz-modal">
      <h2>本章练习</h2>
      <div class="quiz-body">正在生成练习…（需在设置中配置练习用的 AI 供应商与 Key）</div>
      <div class="quiz-actions">
        <button data-act="submit">提交</button>
        <button data-act="regenerate">重新生成</button>
        <button data-act="close">关闭</button>
      </div>
    </div>`
  container.appendChild(overlay)

  let quiz: Quiz | null = null
  const answers = new Map<string, string>()

  async function generate(): Promise<void> {
    const body = overlay.querySelector('.quiz-body') as HTMLElement
    body.textContent = '正在生成练习…（需在设置中配置练习用的 AI 供应商与 Key）'
    try {
      quiz = await window.reader.ai.quiz(opts)
      answers.clear()
      renderQuiz()
    } catch (err) {
      body.textContent = err instanceof Error ? err.message : '生成失败'
    }
  }

  function renderQuiz(): void {
    if (!quiz) return
    const body = overlay.querySelector('.quiz-body') as HTMLElement
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

  overlay.querySelector('[data-act="submit"]')!.addEventListener('click', () => {
    if (!quiz) return
    let score = 0
    const body = overlay.querySelector('.quiz-body') as HTMLElement
    quiz.questions.forEach((q) => {
      const box = overlay.querySelector(`[data-quiz-q="${q.id}"]`) as HTMLElement
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
  overlay.querySelector('[data-act="regenerate"]')!.addEventListener('click', () => {
    void generate()
  })
  overlay.querySelector('[data-act="close"]')!.addEventListener('click', () => overlay.remove())
  void generate()
}

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
