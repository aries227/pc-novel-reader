import { strToU8, zipSync } from 'fflate'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function makeMinimalEpub(dir: string): Promise<string> {
  const files: Record<string, Uint8Array> = {
    'mimetype': strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8('<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
    'OEBPS/content.opf': strToU8('<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>测试书</dc:title><dc:creator>作者甲</dc:creator></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest><spine toc="ncx"><itemref idref="c1"/></spine></package>'),
    'OEBPS/toc.ncx': strToU8('<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap><navPoint id="n1" playOrder="1"><navLabel><text>第一章</text></navLabel><content src="c1.xhtml"/></navPoint></navMap></ncx>'),
    'OEBPS/c1.xhtml': strToU8('<html xmlns="http://www.w3.org/1999/xhtml"><head><title>第一章</title></head><body><h1>第一章</h1><p>内容</p></body></html>')
  }
  const path = join(dir, 'minimal.epub')
  await writeFile(path, zipSync(files))
  return path
}

export async function makeMinimalFb2(dir: string): Promise<string> {
  const xml = '<?xml version="1.0"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>测试书</book-title><author><first-name>甲</first-name></author></title-info></description><body><section><title><p>第一章</p></title><p>内容</p></section></body></FictionBook>'
  const path = join(dir, 'minimal.fb2')
  await writeFile(path, xml, 'utf8')
  return path
}
