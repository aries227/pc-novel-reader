import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type ReviewState = 'new' | 'learning' | 'mastered'

export interface VocabEntry {
  id: string
  word: string
  phonetic?: string
  translation?: string
  examples: string[]
  contextSentence?: string
  sourceBook?: string
  sourceChapter?: string
  addedAt: number
  reviewState: ReviewState
  note?: string
}

export interface VocabInput {
  word: string
  phonetic?: string
  translation?: string
  examples?: string[]
  contextSentence?: string
  sourceBook?: string
  sourceChapter?: string
}

export class VocabularyStore {
  constructor(private readonly dir: string) {}

  private get file(): string {
    return join(this.dir, 'vocabulary.json')
  }

  private async load(): Promise<VocabEntry[]> {
    try {
      const raw = JSON.parse(await readFile(this.file, 'utf8'))
      return Array.isArray(raw) ? raw : []
    } catch {
      return []
    }
  }

  private async save(list: VocabEntry[]): Promise<void> {
    await mkdir(this.dir, { recursive: true })
    await writeFile(this.file, JSON.stringify(list, null, 2), 'utf8')
  }

  async list(): Promise<VocabEntry[]> {
    return this.load()
  }

  async add(input: VocabInput): Promise<VocabEntry> {
    const list = await this.load()
    const key = input.word.trim().toLowerCase()
    const existing = list.find((e) => e.word.toLowerCase() === key)
    if (existing) {
      const merged: VocabEntry = {
        ...existing,
        phonetic: existing.phonetic ?? input.phonetic,
        translation: existing.translation ?? input.translation,
        examples: existing.examples.length ? existing.examples : input.examples ?? [],
        contextSentence: existing.contextSentence ?? input.contextSentence,
        sourceBook: existing.sourceBook ?? input.sourceBook,
        sourceChapter: existing.sourceChapter ?? input.sourceChapter
      }
      list[list.indexOf(existing)] = merged
      await this.save(list)
      return merged
    }
    const entry: VocabEntry = {
      id: randomUUID(),
      word: input.word.trim(),
      phonetic: input.phonetic,
      translation: input.translation,
      examples: input.examples ?? [],
      contextSentence: input.contextSentence,
      sourceBook: input.sourceBook,
      sourceChapter: input.sourceChapter,
      addedAt: Date.now(),
      reviewState: 'new'
    }
    list.push(entry)
    await this.save(list)
    return entry
  }

  async remove(id: string): Promise<void> {
    const list = await this.load()
    await this.save(list.filter((e) => e.id !== id))
  }

  async update(id: string, patch: Partial<Pick<VocabEntry, 'reviewState' | 'note' | 'translation'>>): Promise<VocabEntry> {
    const list = await this.load()
    const i = list.findIndex((e) => e.id === id)
    if (i < 0) throw new Error('生词不存在')
    list[i] = { ...list[i], ...patch }
    await this.save(list)
    return list[i]
  }
}
