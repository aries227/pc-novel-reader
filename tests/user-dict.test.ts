import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createDictionary, parseUserDictFile } from '../src/main/dictionary'

let dirs: string[] = []
async function tempDir(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), 'udict-'))
  dirs.push(d)
  return d
}
afterEach(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })))
  dirs = []
})

describe('parseUserDictFile', () => {
  it('解析 JSON 词条数组', async () => {
    const dir = await tempDir()
    const f = join(dir, 'dict.json')
    await writeFile(f, JSON.stringify([{ word: 'Foo', translation: '自定义', phonetic: '/f/ /' }]), 'utf8')
    const r = await parseUserDictFile(f)
    expect(r.words.foo.t).toBe('自定义')
  })
  it('解析 ECDICT 风格 CSV', async () => {
    const dir = await tempDir()
    const f = join(dir, 'dict.csv')
    await writeFile(f, 'word,phonetic,definition,translation,pos\nbar,bɑːr,,酒吧,n.\n', 'utf8')
    const r = await parseUserDictFile(f)
    expect(r.words.bar.t).toBe('酒吧')
    expect(r.words.bar.p).toBe('bɑːr')
  })
  it('解析 TXT（Tab 分隔）', async () => {
    const dir = await tempDir()
    const f = join(dir, 'dict.txt')
    await writeFile(f, 'hello\t你好\nworld\t世界\n', 'utf8')
    const r = await parseUserDictFile(f)
    expect(r.words.hello.t).toBe('你好')
    expect(r.words.world.t).toBe('世界')
  })
})

describe('createDictionary 用户词典', () => {
  it('用户词典优先于内置词典', async () => {
    const dir = await tempDir()
    await writeFile(join(dir, 'user-dict.json'), JSON.stringify({ words: { hello: { t: '用户释义' } } }), 'utf8')
    await writeFile(join(dir, 'dictionary.json'), await readFile(join('tests', 'fixtures', 'dict-fixture', 'dictionary.json'), 'utf8'), 'utf8')
    await writeFile(join(dir, 'examples.json'), await readFile(join('tests', 'fixtures', 'dict-fixture', 'examples.json'), 'utf8'), 'utf8')
    const dict = await createDictionary(dir)
    expect((await dict.lookup('hello'))?.translation).toBe('用户释义')
    expect((await dict.lookup('run'))?.translation).toContain('跑')
    expect(await dict.stats()).toBe(1)
  })
  it('导入文件后统计数量', async () => {
    const dir = await tempDir()
    const dict = await createDictionary(dir)
    const f = join(dir, 'a.txt')
    await writeFile(f, 'alpha\t阿尔法\nbeta\t贝塔\n', 'utf8')
    const r = await dict.importFile(f)
    expect(r.added).toBe(2)
    expect(r.total).toBe(2)
    await expect(dict.lookup('alpha')).resolves.toMatchObject({ translation: '阿尔法' })
  })
})
