import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Settings } from '../shared/book'
import { DEFAULT_SETTINGS, ensureAiSettings } from '../shared/book'

export class SettingsStore {
  private settings: Settings = { ...DEFAULT_SETTINGS }

  constructor(private readonly dir: string) {}

  private get file(): string {
    return join(this.dir, 'settings.json')
  }

  async get(): Promise<Settings> {
    try {
      this.settings = ensureAiSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(await readFile(this.file, 'utf8')) as Partial<Settings>) })
    } catch {
      this.settings = ensureAiSettings({ ...DEFAULT_SETTINGS })
    }
    return this.settings
  }

  async set(patch: Partial<Settings>): Promise<Settings> {
    this.settings = { ...this.settings, ...patch }
    await mkdir(this.dir, { recursive: true })
    await writeFile(this.file, JSON.stringify(this.settings, null, 2), 'utf8')
    return this.settings
  }
}
