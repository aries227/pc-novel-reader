import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface DictEntry {
  word: string
  translation: string
  phonetic?: string
}

export interface ExamplePair {
  en: string
  cn: string
}

export interface Dictionary {
  lookup(word: string): Promise<DictEntry | null>
  examples(word: string): Promise<ExamplePair[]>
}

interface DictData {
  words: Record<string, { t: string; p?: string }>
  forms: Record<string, string>
}

export async function createDictionary(dir: string): Promise<Dictionary> {
  const cache = new Map<string, Promise<unknown>>()
  function load<T>(file: string): Promise<T> {
    let p = cache.get(file)
    if (!p) {
      p = readFile(join(dir, file), 'utf8').then((s) => JSON.parse(s) as T)
      cache.set(file, p)
    }
    return p as Promise<T>
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
      const w = normalize(word)
      if (!w) return null
      const data = await load<DictData>('dictionary.json')
      const base = baseOf(data, w)
      if (!base) return null
      const e = data.words[base]
      return e ? { word: base, translation: e.t, ...(e.p ? { phonetic: e.p } : {}) } : null
    },
    async examples(word) {
      const w = normalize(word)
      if (!w) return []
      const data = await load<DictData>('dictionary.json')
      const base = baseOf(data, w)
      if (!base) return []
      const ex = await load<Record<string, ExamplePair[]>>('examples.json')
      return ex[base] ?? []
    }
  }
}
