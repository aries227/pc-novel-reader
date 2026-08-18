# 简阅 · PC 小说阅读器

简洁高效的 Windows 桌面小说阅读器，基于 Electron + TypeScript 构建。

## 功能

- 格式支持：TXT（自动识别 UTF-8 / GBK / GB18030 / Big5 等编码）、EPUB、MOBI、AZW3、FB2、PDF、HTML、DOCX。
- 书架：网格展示、最近阅读排序、进度记忆、书签、书架 JSON 导入/导出。
- 阅读器：左右翻页 / 上下翻页 / 横向滑动 / 滚动四种模式，字号 / 行距 / 主题调节、章节目录、进度条、快捷键翻页（`Esc` 返回书架）。
- 考试词自动着色：按词典里的考试标签（中考 / 高考 / 四六级 / 考研 / 托福 / 雅思 / GRE）自动给单词标上对应颜色，鼠标悬停可看级别。
- 默认背景：白 / 米黄 / 夜间 / 护眼绿之外，新增日落 / 海洋 / 森林 / 纸张四套渐变背景。
- 书架：书籍支持一键改名；扫码上传 / 网页解析的书籍可随时重命名。
- 阅读高亮：选中任意文字可加黄 / 绿 / 粉三色高亮，点击高亮可取消，重新打开书籍仍然保留。
- 主题与外观：白 / 米黄 / 夜间 / 护眼绿四套主题，支持上传自定义背景图片和字体文件。
- 扫码上传：手机扫描二维码后直接用浏览器上传书籍到书架，无需安装 App。
- 书源系统：导入 / 删除 / 搜索 JSON 书源，在线搜索、阅读、加入书架，章节自动缓存，断网可读。
- 网页解析：粘贴任意网页 URL，自动提取正文生成书籍。
- AI 接入：支持多家 OpenAI 兼容供应商（DeepSeek、OpenAI、硅基流动、Moonshot 等），每个供应商可独立配置接口地址、API Key 与模型，一键测试连接、拉取模型列表，翻译与练习可分别选择默认供应商和模型。
- AI 翻译：可翻译选中文字或整章内容，输出到右下角面板。
- 学习功能：内置离线英汉词典（ECDICT 约 7.8 万词条 + 考试标签）与 Tatoeba 中英例句；支持导入 JSON / CSV / TXT 用户词典；阅读时选中单词可查词、收藏到生词本，生词本支持掌握状态管理。
- AI 本章练习：右侧分栏边翻边做；可自定义题量（1-12）、难度（初中/高中/四级/六级/考研/雅思/托福/GRE）与自定义出题提示词；提交后自动判分并显示解析。

## 开发运行

```bash
npm install
npm run dev
```

测试与构建：

```bash
npm test
npm run build
```

打包 Windows 安装版与便携版：

```bash
npm run dist
```

产物在 `dist/` 目录：
- `简阅 Setup x.x.x.exe`（NSIS 安装版）
- `简阅 x.x.x.exe`（免安装便携版）

## 自动更新

安装版支持自动更新（基于 GitHub Releases 的差分下载，只拉取变化部分，类似补丁）：

- 应用启动约 5 秒后自动检查新版本，发现更新后后台下载。
- 下载完成后重启应用即自动安装，无需手动下载安装包。
- 也可以随时在「设置 → 检查更新」里手动检查。

免安装便携版无法自动替换正在运行的程序，请手动下载最新便携版覆盖旧文件。

发布新版本流程（维护者）：

```bash
npm run dist
gh release create v0.4.0 "dist/简阅 Setup 0.4.0.exe" "dist/简阅 Setup 0.4.0.exe.blockmap" "dist/简阅 0.4.0.exe" "dist/latest.yml" --title "v0.4.0" --notes "更新说明"
```

## 扫码上传

1. 在书架右上角点击「扫码上传」。
2. 点击「启动服务」，窗口内出现二维码和局域网地址（如 `http://192.168.1.5:12345/?token=xxx`）。
3. 手机连接同一 Wi-Fi，扫描二维码，在打开的网页中选择书籍文件上传。
4. 上传完成后书籍自动出现在书架中。

若手机无法访问，通常是 Windows 防火墙拦截，可放行端口（把 6789 换成实际端口）：

```powershell
netsh advfirewall firewall add rule name="jian-yue-upload" dir=in action=allow protocol=TCP localport=6789
```

## 主题与外观

在「设置」中：
- 主题：白 / 米黄 / 夜间 / 护眼绿。
- 上传背景图片：阅读页使用该图片作为背景，并自动叠加半透明遮罩保证文字可读性；可随时清除恢复纯色背景。
- 上传字体：支持 ttf / otf / woff / woff2，上传后在「字体」里选择「自定义字体」生效。

## AI 服务（多供应商）

1. 打开「设置 → AI 服务」，点击「+ 添加供应商」。
2. 填写名称、接口地址（如 `https://api.deepseek.com` 或 `https://api.openai.com/v1`，无需手动加 `/v1`）、API Key 与可用模型（逗号分隔）。
3. 点击「测试连接」验证 Key 是否可用；点击「获取模型」自动拉取该供应商支持的模型列表。
4. 在下方为「翻译」和「练习」分别选择默认供应商与模型。

说明：
- 所有供应商均走 OpenAI 兼容的 `/chat/completions` 接口，DeepSeek、OpenAI、硅基流动、Moonshot、通义、智谱等主流服务都能用。
- API Key 只保存在本机设置文件中，仅用于向对应供应商发起请求。
- 旧版本已填写的 DeepSeek API Key 会自动迁移为默认供应商，无需重新配置。

翻译用法：阅读页点击工具栏「翻译」按钮——选中了文字就翻译选中片段，否则翻译当前整章；译文显示在右下角面板。

## 安卓版（0.7.0 起）

安卓版基于 Capacitor 复用同一套阅读界面与数据模型：

- 已支持：书架与进度、TXT / EPUB / MOBI / AZW3 / FB2 / DOCX / HTML / PDF 阅读、离线词典与考试词着色、生词本、高亮、主题与设置、AI 翻译 / 练习、WebToEpub 批量导入、书架搜索、用户词典导入。
- 暂不支持：扫码上传与自动更新（桌面端专属）；书源在线搜索 / 在线阅读暂未接入，请用「网页转EPUB」导入。

构建安卓 APK（需要 Android Studio / JDK 17+ / Android SDK）：

```bash
npm install
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

产物在 `android/app/build/outputs/apk/debug/`。

## 学习功能

### 查词与生词本

1. 阅读时用鼠标选中单词，会弹出「查词 / 收藏」小菜单。
2. 查词：内置 ECDICT 英汉词典（约 7.8 万词条 + 词形变化 + 考试标签），显示音标、中文释义、考试标签与 Tatoeba 中英例句，也可一键加入生词本；词典数据在启动后后台预热，查词更快。查词窗口默认出现在单词旁边，也可在右侧「词典」标签里查看。
3. 收藏：自动保存单词、释义、所在句子、书名与章节。
4. 生词本：阅读页工具栏「生词本」可查看全部生词，标记为新词 / 学习中 / 已掌握，或删除。
5. 导入词典：生词本弹窗里点「导入词典」，支持 JSON（词条数组或对象）、ECDICT 风格 CSV、TXT（单词<Tab>释义），导入内容立即参与查词，且优先于内置词典。

### AI 本章练习

- 阅读页工具栏「练习」在右侧分栏打开，可以随时收起继续翻页，边翻边做。
- 练习面板顶部可展开「本章原文」，边看原文边做题；同章节同题量同难度的题目会自动保存，重新打开直接复用，只有点「重新生成」才会出新题。
- 练习前可选题量（1-12 道）与难度（初中 / 高中 / 四级 / 六级 / 考研 / 雅思 / 托福 / GRE）；基于当前章节生成 1 道阅读理解题和其余练习题（选择题 / 翻译题 / 语法题混合），提交自动判分并显示解析。
- 可在「设置 → AI 服务」中为「练习」单独选择供应商与模型、默认题量、默认难度，并可填写自定义出题提示词（填写后覆盖默认指令）；未配置 Key 时会提示先去设置。

### 数据与版权

- 词典数据来自开源项目 [ECDICT](https://github.com/skywind3000/ECDICT)，例句来自 [Tatoeba](https://tatoeba.org) 中英句对。
- 词典与例句数据随应用离线内置，查词无需联网。

## 书源使用

1. 点击「书源」→「导入书源文件」（或从 URL 导入 JSON）。
2. 点击书源右侧「搜索」，输入书名。
3. 在结果中「阅读」章节，或「加入书架」以记录进度。

书源 JSON 示例（简化格式，规则以 `css:` / `regex:` 开头，URL 支持 `{{keyword}}`、`{{bookUrl}}`、`{{chapterUrl}}`、`{{baseUrl}}` 模板变量）：

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "示例书源",
  "version": 1,
  "baseUrl": "https://example.com",
  "enabled": true,
  "search": {
    "url": "https://example.com/search?q={{keyword}}",
    "method": "GET",
    "list": "css:.book-list li",
    "title": "css:.title",
    "author": "css:.author",
    "bookUrl": "css:a@href"
  },
  "chapters": {
    "url": "{{bookUrl}}",
    "list": "css:.chapter-list a",
    "title": "css:@text",
    "chapterUrl": "css:@href"
  },
  "content": {
    "url": "{{chapterUrl}}",
    "content": "css:#content",
    "remove": ["css:.ad"]
  }
}
```

应用不内置任何书源，只加载用户自己导入的规则。

## 数据位置

书架、进度、书签、设置与书源数据存放在 Electron 用户数据目录（Windows 为 `%APPDATA%/jian-yue`）：

```text
library.json      书架、进度、书签
sources.json      书源列表
settings.json     全局设置
books/            扫码上传 / 网页解析产生的书籍副本
cache/            书源章节缓存
```

## 快捷键

| 按键 | 功能 |
| --- | --- |
| `←` / `→` | 上一页 / 下一页（翻页模式） |
| `PageUp` / `PageDown` / `空格` | 上一页 / 下一页 |
| `Esc` | 返回书架 |
| `F11` | 全屏（浏览器默认） |

## 安全说明

- 渲染进程启用 `contextIsolation`、`sandbox`，外来 HTML 一律经 DOMPurify 净化。
- 网络请求仅由主进程发起，书源 URL 仅允许 http/https。
- 书源规则不支持 JS 注入，仅支持 CSS 选择器与正则。
