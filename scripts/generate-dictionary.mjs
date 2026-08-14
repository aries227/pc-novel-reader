// 从 ECDICT 与 Tatoeba 生成精简离线词典数据。
// 用法：
//   node scripts/generate-dictionary.mjs <dict.json> <lemma.json> <sentences.json> <outDir>
// 数据来源：
//   - ECDICT: https://github.com/skywind3000/ECDICT
//   - Tatoeba 中英句对: https://github.com/leonsilicon/tatoeba-sentence-pairs-in-mandarin-chinese-english
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const [dictPath, lemmaPath, sentencesPath, outDir] = process.argv.slice(2)
if (!dictPath || !lemmaPath || !sentencesPath || !outDir) {
  console.error('usage: node scripts/generate-dictionary.mjs <dict.json> <lemma.json> <sentences.json> <outDir>')
  process.exit(1)
}

const MAX_WORDS = 25000
const WORD_RE = /^[a-z]+(?:['-][a-z]+)*$/i

const dictRaw = JSON.parse(await readFile(dictPath, 'utf8'))
const dictMap = new Map(dictRaw.map((e) => [String(e.word).toLowerCase(), e]))
console.log(`dict entries: ${dictMap.size}`)

const lemmaRaw = JSON.parse(await readFile(lemmaPath, 'utf8'))
const lemmas = lemmaRaw
  .filter((l) => WORD_RE.test(l.word) && l.word.length > 1)
  .sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0))
console.log(`candidate lemmas: ${lemmas.length}`)

const words = {}
const forms = {}
let kept = 0
for (const l of lemmas) {
  if (kept >= MAX_WORDS) break
  const base = l.word.toLowerCase()
  const d = dictMap.get(base)
  if (!d || !d.translation) continue
  words[base] = { t: d.translation, ...(d.phonetic ? { p: d.phonetic } : {}) }
  for (const v of l.variations ?? []) {
    const f = String(v).toLowerCase()
    if (f !== base && WORD_RE.test(f)) forms[f] = base
  }
  kept++
}
console.log(`kept words: ${kept}, forms: ${Object.keys(forms).length}`)

const sentences = JSON.parse(await readFile(sentencesPath, 'utf8'))
const wordSet = new Set(Object.keys(words))
const examples = {}
let withExamples = 0
for (const [, cn, , en] of sentences) {
  if (!en || !cn) continue
  const tokens = String(en).toLowerCase().match(/[a-z]+(?:['-][a-z]+)*/g) ?? []
  const seen = new Set()
  for (const tok of tokens) {
    const w = tok.replace(/^'+|'+$/g, '')
    if (!wordSet.has(w) || seen.has(w)) continue
    seen.add(w)
    const arr = examples[w] ?? (examples[w] = [])
    if (arr.length < 2) {
      arr.push({ e: String(en), cn: String(cn) })
      if (arr.length === 1) withExamples++
    }
  }
}
console.log(`words with examples: ${withExamples}`)

await mkdir(outDir, { recursive: true })
await writeFile(join(outDir, 'dictionary.json'), JSON.stringify({ words, forms }))
await writeFile(join(outDir, 'examples.json'), JSON.stringify(examples))
console.log('written to', outDir)
