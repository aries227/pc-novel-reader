import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Quiz } from './quiz'

export class QuizStore {
  constructor(private readonly dir: string) {}

  private get file(): string {
    return join(this.dir, 'quiz-history.json')
  }

  private key(bookId: string, chapterIndex: number, count: number, difficulty: string): string {
    return `${bookId}:${chapterIndex}:${count}:${difficulty}`
  }

  private async load(): Promise<Record<string, Quiz>> {
    try {
      const raw = JSON.parse(await readFile(this.file, 'utf8')) as Record<string, Quiz>
      return raw && typeof raw === 'object' ? raw : {}
    } catch {
      return {}
    }
  }

  async get(bookId: string, chapterIndex: number, count: number, difficulty: string): Promise<Quiz | null> {
    const data = await this.load()
    return data[this.key(bookId, chapterIndex, count, difficulty)] ?? null
  }

  async save(bookId: string, chapterIndex: number, count: number, difficulty: string, quiz: Quiz): Promise<Quiz> {
    const data = await this.load()
    data[this.key(bookId, chapterIndex, count, difficulty)] = quiz
    await mkdir(this.dir, { recursive: true })
    await writeFile(this.file, JSON.stringify(data, null, 2), 'utf8')
    return quiz
  }
}
