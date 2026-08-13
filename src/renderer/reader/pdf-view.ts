import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export interface PdfControls {
  next(): boolean
  prev(): boolean
  goTo(p: number): void
}

export async function renderPdf(
  container: HTMLElement,
  url: string,
  onProgress: (page: number, total: number) => void
): Promise<PdfControls> {
  const doc = await pdfjsLib.getDocument({ url }).promise
  const canvas = document.createElement('canvas')
  container.appendChild(canvas)
  let pageNumber = 1

  async function renderPage(n: number): Promise<void> {
    const page = await doc.getPage(n)
    const base = Math.max(container.clientWidth - 96, 320)
    const viewport = page.getViewport({ scale: 1 })
    const scale = base / viewport.width
    const scaled = page.getViewport({ scale })
    canvas.width = Math.floor(scaled.width)
    canvas.height = Math.floor(scaled.height)
    canvas.style.width = `${scaled.width}px`
    canvas.style.height = `${scaled.height}px`
    await page.render({ canvas, viewport: scaled }).promise
    onProgress(pageNumber, doc.numPages)
  }

  await renderPage(pageNumber)
  return {
    next: () => { if (pageNumber < doc.numPages) { pageNumber++; void renderPage(pageNumber); return true } return false },
    prev: () => { if (pageNumber > 1) { pageNumber--; void renderPage(pageNumber); return true } return false },
    goTo: (p) => { pageNumber = Math.max(1, Math.min(doc.numPages, p)); void renderPage(pageNumber) }
  }
}
