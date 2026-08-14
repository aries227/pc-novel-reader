import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

export interface DictEntry {
  word: string
  translation: string
  phonetic?: string
  tags?: string
}

export interface ExamplePair {
  en: string
  cn: string
}

export interface Dictionary {
  lookup(word: string): Promise<DictEntry | null>
  examples(word: string): Promise<ExamplePair[]>
  importFile(filePath: string): Promise<{ added: number; total: number }>
  stats(): Promise<number>
  examTags(): Promise<Record<string, string>>
  warmup(): Promise<void>
}

interface DictData {
  words: Record<string, { t: string; p?: string; g?: string }>
  forms: Record<string, string>
}

interface UserDictData {
  words: Record<string, { t: string; p?: string }>
}

export interface UserDictResult {
  words: Record<string, { t: string; p?: string }>
}

export async function parseUserDictFile(filePath: string): Promise<UserDictResult> {
  const raw = await readFile(filePath, 'utf8')
  const words: Record<string, { t: string; p?: string }> = {}
  const ext = extname(filePath).toLowerCase()
  if (ext === '.json') {
    const data = JSON.parse(raw) as unknown
    const root = (data as { words?: unknown }).words ?? data
    if (Array.isArray(root)) {
      for (const item of root as { word?: unknown; translation?: unknown; t?: unknown; phonetic?: unknown; p?: unknown }[]) {
        const word = String(item.word ?? '').trim().toLowerCase()
        const t = String(item.translation ?? item.t ?? '').trim()
        if (word && t) words[word] = { t, ...((item.phonetic ?? item.p) ? { p: String(item.phonetic ?? item.p) } : {}) }
      }
    } else {
      for (const [word, val] of Object.entries(root as Record<string, unknown>)) {
        const key = word.trim().toLowerCase()
        if (!key) continue
        if (typeof val === 'string' && val.trim()) words[key] = { t: val.trim() }
        else if (val && typeof val === 'object') {
          const v = val as { t?: unknown; translation?: unknown; p?: unknown; phonetic?: unknown }
          const t = String(v.translation ?? v.t ?? '').trim()
          if (t) words[key] = { t, ...((v.phonetic ?? v.p) ? { p: String(v.phonetic ?? v.p) } : {}) }
        }
      }
    }
  } else if (ext === '.csv') {
    const lines = raw.split(/\r?\n/).filter((l) => l.trim())
    const header = lines[0].toLowerCase()
    let wordIdx = 0
    let phonIdx = -1
    let transIdx = 1
    if (header.includes('word') && header.includes('translation')) {
      const cols = splitCsv(lines[0])
      wordIdx = cols.findIndex((c) => c.trim().toLowerCase() === 'word')
      transIdx = cols.findIndex((c) => c.trim().toLowerCase() === 'translation')
      phonIdx = cols.findIndex((c) => c.trim().toLowerCase() === 'phonetic')
      lines.shift()
    } else if (lines[0].split(',').length >= 4) {
      phonIdx = 1
      transIdx = 3
      lines.shift()
    }
    for (const line of lines) {
      const cols = splitCsv(line)
      const word = (cols[wordIdx] ?? '').trim().toLowerCase()
      const t = (cols[transIdx] ?? '').trim()
      if (word && t) words[word] = { t, ...(phonIdx >= 0 && cols[phonIdx] ? { p: cols[phonIdx].trim() } : {}) }
    }
  } else {
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim() || line.startsWith('#')) continue
      let parts = line.split('\t')
      if (parts.length < 2) parts = line.split(/[,，]/)
      const [word, ...rest] = parts
      if (!word?.trim()) continue
      const t = rest.join(' ').trim()
      if (!t) continue
      words[word.trim().toLowerCase()] = { t }
    }
  }
  return { words }
}

function splitCsv(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else inQ = false
      } else cur += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

export async function createDictionary(dir: string): Promise<Dictionary> {
  const cache = new Map<string, Promise<unknown>>()
  let user: UserDictData = { words: {} }
  let userLoaded = false
  function load<T>(file: string): Promise<T> {
    let p = cache.get(file)
    if (!p) {
      p = readFile(join(dir, file), 'utf8').then((s) => JSON.parse(s) as T)
      cache.set(file, p)
    }
    return p as Promise<T>
  }

  async function loadUser(): Promise<void> {
    if (userLoaded) return
    userLoaded = true
    try {
      const raw = JSON.parse(await readFile(join(dir, 'user-dict.json'), 'utf8')) as UserDictData
      user = { words: raw.words ?? {} }
    } catch {
      user = { words: {} }
    }
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

  return {
    async lookup(word) {
      await loadUser()
      const w = normalize(word)
      if (!w) return null
      if (user.words[w]) {
        const u = user.words[w]
        return { word: w, translation: u.t, ...(u.p ? { phonetic: u.p } : {}) }
      }
      const data = await load<DictData>('dictionary.json')
      const base = baseOf(data, w)
      if (!base) return null
      const e = data.words[base]
      return e ? { word: base, translation: e.t, ...(e.p ? { phonetic: e.p } : {}), ...(e.g ? { tags: e.g } : {}) } : null
    },
    async examples(word) {
      await loadUser()
      const w = normalize(word)
      if (!w) return []
      const data = await load<DictData>('dictionary.json')
      const base = baseOf(data, w)
      if (!base) return []
      const ex = await load<Record<string, ExamplePair[]>>('examples.json')
      return ex[base] ?? []
    },
    async importFile(filePath) {
      const parsed = await parseUserDictFile(filePath)
      await loadUser()
      let added = 0
      for (const [word, entry] of Object.entries(parsed.words)) {
        if (!user.words[word]) added++
        user.words[word] = entry
      }
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'user-dict.json'), JSON.stringify({ words: user.words }), 'utf8')
      return { added, total: Object.keys(user.words).length }
    },
    async stats() {
      await loadUser()
      return Object.keys(user.words).length
    },
    async examTags() {
      return load<Record<string, string>>('exam-tags.json')
    },
    async warmup() {
      await Promise.all([load<DictData>('dictionary.json'), load<Record<string, ExamplePair[]>>('examples.json'), load<Record<string, string>>('exam-tags.json'), loadUser()])
    }
  }
}
