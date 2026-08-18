interface DictData {
  words: Record<string, { t: string; p?: string; g?: string }>
  forms: Record<string, string>
}

interface UserDict {
  words: Record<string, { t: string; p?: string }>
}

const cache: { dict?: DictData; examples?: Record<string, { e: string; cn: string }[]>; tags?: Record<string, string> } = {}

async function loadJson<T>(url: string, key: keyof typeof cache): Promise<T> {
  if (cache[key] === undefined) {
    const res = await fetch(url)
    if (!res.ok) throw new Error('词典数据加载失败')
    ;(cache as Record<string, unknown>)[key] = await res.json()
  }
  return cache[key] as T
}

function normalize(word: string): string {
  return word.trim().toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '')
}

function baseOf(data: DictData, word: string): string | null {
  if (data.words[word]) return word
  if (data.forms[word]) return data.forms[word]
  const rules: ((w: string) => string | null)[] = [
    (w) => (w.endsWith('ies') ? w.slice(0, -3) + 'y' : null),
    (w) => (w.endsWith('es') ? w.slice(0, -2) : null),
    (w) => (w.endsWith('s') ? w.slice(0, -1) : null),
    (w) => (w.endsWith('ing') ? w.slice(0, -3) : null),
    (w) => (w.endsWith('ed') ? w.slice(0, -2) : null)
  ]
  for (const rule of rules) {
    const cand = rule(word)
    if (cand && (data.words[cand] || data.forms[cand])) return data.forms[cand] ?? cand
  }
  return null
}

function loadUserDict(): UserDict {
  try {
    const raw = JSON.parse(localStorage.getItem('jianyue.userdict') ?? '{}') as UserDict
    return { words: raw.words ?? {} }
  } catch {
    return { words: {} }
  }
}

export interface DictEntry {
  word: string
  translation: string
  phonetic?: string
  tags?: string
}

export async function lookup(word: string): Promise<DictEntry | null> {
  const w = normalize(word)
  if (!w) return null
  const user = loadUserDict().words[w]
  if (user) return { word: w, translation: user.t, ...(user.p ? { phonetic: user.p } : {}) }
  const data = await loadJson<DictData>('/resources/dictionary.json', 'dict')
  const base = baseOf(data, w)
  if (!base) return null
  const e = data.words[base]
  return e ? { word: base, translation: e.t, ...(e.p ? { phonetic: e.p } : {}), ...(e.g ? { tags: e.g } : {}) } : null
}

export async function examples(word: string): Promise<{ en: string; cn: string }[]> {
  const w = normalize(word)
  if (!w) return []
  const data = await loadJson<DictData>('/resources/dictionary.json', 'dict')
  const base = baseOf(data, w)
  if (!base) return []
  const ex = await loadJson<Record<string, { e: string; cn: string }[]>>('/resources/examples.json', 'examples')
  return (ex[base] ?? []).map((x) => ({ en: x.e, cn: x.cn }))
}

export async function examTags(): Promise<Record<string, string>> {
  return loadJson<Record<string, string>>('/resources/exam-tags.json', 'tags')
}

export async function importUserDict(text: string, kind: 'json' | 'csv' | 'txt'): Promise<{ added: number; total: number }> {
  const user = loadUserDict()
  const parsed = parseDictText(text, kind)
  let added = 0
  for (const [word, entry] of Object.entries(parsed)) {
    if (!user.words[word]) added++
    user.words[word] = entry
  }
  localStorage.setItem('jianyue.userdict', JSON.stringify(user))
  return { added, total: Object.keys(user.words).length }
}

export function userStats(): number {
  try {
    const raw = JSON.parse(localStorage.getItem('jianyue.userdict') ?? '{}') as UserDict
    return Object.keys(raw.words ?? {}).length
  } catch {
    return 0
  }
}

function parseDictText(text: string, kind: 'json' | 'csv' | 'txt'): Record<string, { t: string; p?: string }> {
  const out: Record<string, { t: string; p?: string }> = {}
  if (kind === 'json') {
    const data = JSON.parse(text) as unknown
    const root = (data as { words?: unknown }).words ?? data
    if (Array.isArray(root)) {
      for (const item of root as { word?: string; translation?: string; phonetic?: string }[]) {
        const w = (item.word ?? '').trim().toLowerCase()
        if (w && item.translation) out[w] = { t: item.translation, ...(item.phonetic ? { p: item.phonetic } : {}) }
      }
    } else {
      for (const [w, v] of Object.entries(root as Record<string, unknown>)) {
        const key = w.trim().toLowerCase()
        if (!key) continue
        if (typeof v === 'string' && v.trim()) out[key] = { t: v.trim() }
      }
    }
  } else if (kind === 'csv') {
    for (const line of text.split(/\r?\n/).slice(1)) {
      const cols = line.split(',')
      const w = (cols[0] ?? '').trim().toLowerCase()
      const t = (cols[3] ?? cols[1] ?? '').trim()
      if (w && t) out[w] = { t, ...(cols[1] ? { p: cols[1].trim() } : {}) }
    }
  } else {
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim() || line.startsWith('#')) continue
      const parts = line.split('\t')
      if (parts.length < 2) continue
      const w = parts[0].trim().toLowerCase()
      const t = parts.slice(1).join(' ').trim()
      if (w && t) out[w] = { t }
    }
  }
  return out
}
