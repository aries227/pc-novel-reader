import './style.css'
import { renderLibrary } from './components/library'
import { renderReader } from './components/reader'
import { openSourcesModal } from './components/sources'
import { openUploadModal } from './components/upload'

const appEl = document.getElementById('app')!

async function showReader(id: string): Promise<void> {
  await renderReader(appEl, id, () => void showLibrary())
}

async function showLibrary(): Promise<void> {
  await renderLibrary(appEl, (id) => void showReader(id))
}

appEl.addEventListener('open-upload', () => {
  void openUploadModal(appEl, () => void showLibrary())
})
appEl.addEventListener('library-changed', () => void showLibrary())
appEl.addEventListener('open-sources', () => void openSourcesModal(appEl))
appEl.addEventListener('open-settings', () => alert('设置将在后续任务实现'))

void showLibrary()
