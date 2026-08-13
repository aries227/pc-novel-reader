import './style.css'
import { renderLibrary } from './components/library'

const appEl = document.getElementById('app')!

async function showLibrary(): Promise<void> {
  await renderLibrary(appEl, () => {})
}

appEl.addEventListener('open-upload', () => alert('扫码上传将在后续任务实现'))
appEl.addEventListener('open-sources', () => alert('书源将在后续任务实现'))
appEl.addEventListener('open-settings', () => alert('设置将在后续任务实现'))

void showLibrary()
