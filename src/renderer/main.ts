import './style.css'
import { renderLibrary } from './components/library'
import { renderReader } from './components/reader'
import { openSourcesModal } from './components/sources'
import { openSettingsModal } from './components/settings'
import { openUploadModal } from './components/upload'
import { applySettingsToBody } from './theme'

const appEl = document.getElementById('app')!

async function showReader(id: string): Promise<void> {
  await renderReader(appEl, id, () => void showLibrary())
}

async function showLibrary(): Promise<void> {
  applySettingsToBody(await window.reader.settings.get())
  await renderLibrary(appEl, (id) => void showReader(id))
}

appEl.addEventListener('open-upload', () => {
  void openUploadModal(appEl, () => void showLibrary())
})
appEl.addEventListener('library-changed', () => void showLibrary())
appEl.addEventListener('open-sources', () => void openSourcesModal(appEl))
appEl.addEventListener('open-settings', () => void openSettingsModal(appEl))

void showLibrary()
