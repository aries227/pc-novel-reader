# PC 端小说阅读器 设计文档

日期：2026-08-13
状态：已确认（用户确认了格式档位 B、Electron 自研路线、书源方案 A）

## 1. 背景与目标

做一个 Windows 桌面端小说阅读器：

- 支持主流小说格式：TXT、EPUB、MOBI、AZW3、FB2、PDF、HTML、DOCX。
- 界面简洁高效：书架 + 阅读页两级结构，常用操作 1～2 步完成。
- 支持局域网扫码上传：手机扫描窗口中的二维码，用浏览器直接上传文件到书架。
- 支持“书源”系统：用户可导入/编辑/导出 JSON 书源规则（参考“阅读/Legado”的思路），在应用内搜索并在线阅读第三方网站内容。
- 附带轻量“网页正文解析”入口：粘贴任意网页 URL，应用自动提取正文加入书架。

## 2. 非目标

- 不内置任何书源、不内置盗版内容，只加载用户自己导入的规则。
- 不做自动绕过登录、验证码、反爬机制。
- 不做账号体系、云同步、多端同步。
- 不做语音朗读、划线笔记、翻译等扩展功能（保留架构扩展点）。
- 不做手机端 App（扫码上传只用到手机浏览器）。

## 3. 技术选型

- 桌面框架：Electron（主进程 Node.js + 渲染进程 Chromium）。
- 界面：TypeScript + Vite + 原生 DOM，不引入 React/Vue，控制体积与复杂度。
- 格式解析：
  - TXT：`jschardet` 编码检测 + `iconv-lite` 解码 + 自研章节切分。
  - EPUB / MOBI / AZW3 / FB2：`@lingo-reader/*` 解析器，统一输出章节 HTML。
  - DOCX：`mammoth` 转 HTML。
  - HTML：直接读取 + `dompurify` 净化。
  - PDF：`pdfjs-dist` 在渲染进程逐页渲染。
- 扫码上传：Node `http` 服务 + `busboy` 处理上传 + `qrcode` 生成二维码。
- 网页正文解析：`jsdom` + `@mozilla/readability`。
- 测试：`vitest`。
- 打包：`electron-builder`（NSIS 安装版 + 便携版）。

## 4. 项目结构

独立项目目录 `D:\ft\reader`，自带 git 仓库，不影响 `D:\ft` 下现有足球游戏项目。

```text
reader/
  package.json
  electron.vite.config.ts        # 主进程/预加载/渲染进程构建
  src/
    main/                        # Electron 主进程
      index.ts                   # 窗口创建、生命周期
      ipc.ts                     # IPC 路由注册
      parsers/
        txt.ts                   # 编码检测 + 章节切分
        ebook.ts                 # lingo-reader 统一封装
        docx.ts
        pdf.ts
        html.ts
      library.ts                 # 书架存储
      settings.ts
      upload-server.ts           # 扫码上传服务
      network.ts                 # 书源请求 / 网页抓取
      sources/
        types.ts                 # 书源类型定义
        validate.ts              # 书源校验
        template.ts              # URL 模板渲染
        extract.ts               # CSS/正则规则提取
        search.ts
        chapter.ts
        content.ts
      readability.ts             # jsdom + readability 封装
    preload/
      index.ts                   # contextBridge 暴露安全 API
    renderer/
      index.html
      main.ts
      style.css
      components/                # 书架/阅读页/目录/设置/扫码/书源面板
      reader/
        pager.ts                 # 分页引擎（CSS 多列）
        scroller.ts              # 滚动模式
        pdf-view.ts
        progress.ts              # 进度定位
    shared/
      ipc.ts                     # IPC 通道常量与类型
      book.ts                    # 书籍/章节/进度/书签类型
      source.ts                  # 书源 JSON 类型
  tests/
    txt.test.ts
    template.test.ts
    extract.test.ts
    validate.test.ts
    fixtures/                    # 测试用最小 epub/fb2/html 样本
```

## 5. 架构与进程边界

- 主进程：所有文件系统访问、网络请求、格式解析、上传服务、数据持久化。
- 渲染进程：纯 UI。通过 preload 暴露的白名单 API 调用主进程，`contextIsolation: true`、`nodeIntegration: false`。
- 所有远程/外来 HTML 在渲染前必须经过 DOMPurify 净化；解析在进程内完成，不加载远程脚本。
- 书源抓取由主进程的 `network.ts` 统一执行，支持超时、错误分类和中文错误提示。

## 6. 功能规格

### 6.1 书架

- 网格卡片展示：封面（TXT 自动生成文字封面）、书名、作者、进度百分比、最近阅读时间。
- 操作：打开文件加入书架、从文件夹批量导入、拖拽文件加入、移除书籍、清空书架。
- 打开书籍时自动恢复到上次进度。
- 本地文件以“原路径引用”方式入库；扫码上传的文件复制到应用数据目录下的 `books/`。
- 书源书籍单独归类展示，标记来源，可手动“更新章节”。

### 6.2 阅读器

- 翻页模式：CSS 多列分页，左右方向键 / PageUp / PageDown / 空格翻页。
- 滚动模式：连续滚动阅读。
- 顶部工具栏：书名、目录按钮、书签、设置（字号 / 行距 / 主题 / 字体）、扫码上传、返回书架。
- 主题：白、米黄、夜间；设置全局记忆。
- 目录侧栏：章节列表，点击跳转；当前章节高亮。
- 进度条：底部显示百分比，可拖动跳转。
- 书签：在章节内添加/删除书签，书签列表可从目录侧栏进入。
- 快捷键：Esc 返回书架、←/→ 翻页、F11 全屏、Ctrl+= / Ctrl+- 调整字号。

### 6.3 格式解析管线

统一内部模型：`Book { id, title, author, cover?, source, format, chapters: Chapter[] }`，章节内容统一为 HTML 片段（TXT 解析出的纯文本转义为段落）。

- TXT：
  - 读前若干 KB 用 jschardet 检测编码，常用 UTF-8 / GBK / GB18030 / Big5；检测失败默认按 UTF-8 解码，若出现替换字符则回退 GBK。
  - 章节识别规则：匹配 `第[0-9零一二三四五六七八九十百千两]+[章回卷集部节]` 等常见模式；命中少于 2 章时按固定字数（默认 3000 字）切分段落组。
  - 忽略书籍开头空白、版权声明等噪声行的策略：章节标题行单独成段，正文连续段落。
- EPUB / MOBI / AZW3 / FB2：统一由 lingo-reader 解析为章节 HTML；保留目录顺序；解析失败时给出明确错误并跳过该文件。
- DOCX：mammoth 输出 HTML，按 `h1/h2` 切分章节，无标题时整篇为单章。
- HTML：读取文本后净化；按 `h1-h3` 切分章节。
- PDF：pdf.js 渲染，不切章；进度按页码记录，目录使用 PDF 大纲（outline）若可用。

进度定位：

| 格式 | 进度定位方式 |
| --- | --- |
| TXT | 章节索引 + 章节内字符偏移 |
| EPUB/MOBI/AZW3/FB2/DOCX/HTML | 章节索引 + 章节内 DOM 文本锚点（段落序号 + 文本前缀哈希） |
| PDF | 页码 |
| 书源 | 书源 ID + 章节索引 |

### 6.4 扫码上传

- 主进程启动局域网 HTTP 服务（默认随机端口，可通过设置指定固定端口）。
- 窗口内“扫码上传”面板展示：二维码（内容为 `http://<局域网IP>:<端口>/?token=<随机令牌>`）、可复制的 URL、服务开关。
- 手机访问该 URL：一个极简网页，包含文件选择（多选）和拖拽上传区，只接受支持的扩展名，单文件默认上限 100MB。
- 上传完成后页面显示成功列表；桌面端收到上传完成事件，自动把文件复制进应用数据 `books/` 并刷新书架，显示通知。
- 令牌机制：URL 中带一次性随机令牌，防止局域网内无关设备随意上传；令牌在会话内有效，重启后失效。
- 安全：上传目录为应用数据下的临时目录，处理完即清理；不解析文件名中的路径成分。

### 6.5 书源系统（方案 A）

用户可导入 JSON 书源文件（本地文件或 URL），可编辑、导出、启停、删除。应用内“书源搜索”输入关键词，选择书源后列出结果，点开章节在线阅读，可加入书架并记录进度。

#### 6.5.1 书源 JSON 格式（简化版，参考 Legado 思路）

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
    "headers": { "User-Agent": "Mozilla/5.0" },
    "charset": "auto",
    "list": "css:.book-list li",
    "title": "css:.title",
    "author": "css:.author",
    "bookUrl": "css:a@href"
  },
  "detail": {
    "url": "{{bookUrl}}",
    "method": "GET",
    "cover": "css:.cover img@src",
    "author": "css:.author",
    "intro": "css:.intro"
  },
  "chapters": {
    "url": "{{bookUrl}}",
    "method": "GET",
    "list": "css:.chapter-list a",
    "title": "css:@text",
    "chapterUrl": "css:@href"
  },
  "content": {
    "url": "{{chapterUrl}}",
    "method": "GET",
    "content": "css:#content",
    "remove": [
      "css:.ad",
      "regex:本章未完.*",
      "regex:请记住本站.*"
    ]
  }
}
```

规则语法：

- `css:选择器`：取元素列表；`css:选择器@属性` 取属性值；`css:@text` 取纯文本；`css:@html` 取内部 HTML。
- `regex:正则`：在整页 HTML 或文本上取第一个/全部匹配，支持捕获组（`$1` 表示第一组）。
- URL 模板变量：`{{keyword}}`、`{{bookUrl}}`、`{{chapterUrl}}`、`{{baseUrl}}`，支持 URL 编码（`{{keyword|urlencode}}`）。
- 相对 URL 自动基于 `baseUrl` 拼接为绝对 URL。
- `charset` 支持 `utf-8`、`gbk`、`auto`（jschardet 自动检测）。
- `method` 支持 GET / POST（POST 场景预留 `body` 模板字段，v1 只保证 GET 常用场景）。
- `remove` 中的规则在取正文后逐个应用，用于清理广告/片尾。

导入时做全量校验（schema + 必填字段 + 规则语法），非法书源给出逐条错误提示，不写入书源库。

#### 6.5.2 抓取与展示

- 搜索、详情、章节列表、正文均走主进程网络层：超时 15 秒、重试 1 次、异常按“网络错误/解析失败/内容为空”分类提示。
- 正文 HTML 净化后再进入阅读器；书源章节内容支持翻页/滚动、字号主题调整，与本地书一致。
- 书架中书源书籍带“更新章节”按钮，重新拉取章节列表，保留进度锚点。
- 断网时已缓存章节仍可阅读（按书源 ID + 章节索引缓存最近 N 章，默认 50 章）。

### 6.6 网页正文解析（轻量补充）

- “网页解析”入口：粘贴 URL，主进程用 `jsdom` + `@mozilla/readability` 提取标题与正文。
- 提取成功则生成一本书籍（标题 = 网页标题，正文 = 提取后的 HTML），加入书架，之后离线可读。
- 提取失败给出原因（无法访问 / 页面无正文 / 内容过长等）。

### 6.7 设置

- 阅读：默认主题、字号、行距、字体、默认打开模式（翻页/滚动）。
- 上传：端口策略（随机/固定）、单文件大小上限。
- 缓存：书源章节缓存上限、清除缓存按钮。
- 数据：书架 JSON 导出/导入、书源导出/导入。

## 7. 数据存储

全部存于 Electron `userData` 目录：

```text
userData/
  library.json      # 书籍元数据、进度、书签
  sources.json      # 书源列表
  settings.json     # 全局设置
  books/            # 扫码上传/网页解析得到的本地副本
  cache/            # 书源章节缓存
```

写入策略：修改后防抖 500ms 写入；进度在翻页时实时写内存、防抖落盘；损坏的 JSON 自动备份为 `.bak` 并以空数据启动，不崩溃。

## 8. IPC 接口

按领域分组，均为 preload 白名单方法：

- 书架：`library.list`、`library.addFiles`、`library.addFolder`、`library.remove`、`library.clear`、`library.export`、`library.import`
- 打开/解析：`book.open`、`book.chapters`、`book.progress`、`book.bookmarks`
- 设置：`settings.get`、`settings.set`
- 扫码上传：`upload.status`、`upload.start`、`upload.stop`、`upload.events`
- 书源：`sources.list`、`sources.import`、`sources.importUrl`、`sources.save`、`sources.delete`、`sources.export`、`sources.search`、`sources.chapters`、`sources.content`、`sources.refresh`
- 网页解析：`web.parse`
- 通用：`dialog.openFile`、`app.quit`

## 9. 安全

- 渲染进程：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`、严格 CSP。
- 所有外来 HTML 渲染前经 DOMPurify；不允许外来脚本、事件属性、危险协议。
- 网络请求只由主进程发起；书源 URL 模板输出做协议白名单（http/https）。
- 上传服务令牌校验；上传文件名消毒；上传目录不跟随符号链接。
- 书源规则可注入 JS 的字段（如 Legado 的 JS 规则）一律不支持，v1 只做 CSS/正则规则。

## 10. 错误处理

- 解析失败：单书失败不阻塞书架，卡片显示“解析失败”，可重试或移除。
- 网络失败：按错误类型给中文提示，书源搜索失败可换书源重试。
- 上传失败：手机上显示失败原因（超时/大小超限/类型不支持/服务器已停止）。
- 数据损坏：JSON 读取失败时备份并重建，日志记录路径与错误信息。

## 11. 测试

单元测试（vitest）：

- TXT 编码检测（UTF-8/GBK/GB18030/Big5 样本）与章节切分（含无章节头回退）。
- 书源 URL 模板渲染、CSS/正则提取规则（用 fixtures HTML 断言结果）。
- 书源 JSON 校验（合法/非法/缺字段）。
- 最小 EPUB / FB2 fixture 解析冒烟。

手工验证：

- 真实 TXT / EPUB / MOBI / AZW3 / PDF / DOCX / HTML 样本各一份。
- 手机扫码上传全流程（同一局域网）。
- 打包后安装版与便携版启动、退出、进度恢复。

## 12. 打包与交付

- `pnpm dev`：开发运行。
- `pnpm build`：类型检查 + 渲染/主进程构建。
- `pnpm dist`：electron-builder 产出 Windows NSIS 安装包与免安装便携版。
- README 提供使用说明：导入书籍、扫码上传、书源导入示例、打包命令。

## 13. 里程碑

1. M1 脚手架：Electron + Vite + TypeScript + 窗口 + IPC 骨架 + 打包配置。
2. M2 TXT 管线 + 书架 + 阅读页 + 进度记忆 + 设置。
3. M3 其余格式：EPUB / MOBI / AZW3 / FB2 / DOCX / HTML / PDF。
4. M4 扫码上传 + 网页正文解析。
5. M5 书源系统（导入/校验/搜索/抓取/缓存）。
6. M6 测试补齐 + 打包验证 + README + 验收。

## 14. 风险与决策记录

- lingo-reader 对 MOBI/AZW3 的支持为纯 JS 解析，复杂排版（如重排目录、图片位置）可能降级为“文本优先”展示；若样本验证不通过，回退方案为提示用户先用 Calibre 转 EPUB。
- 书源格式采用自有简化规范而非完整兼容 Legado 规则引擎；未来如需兼容 Legado 书源，可作为独立适配层扩展。
- 扫码上传依赖局域网；Windows 防火墙可能拦截，README 中提供放行命令示例。
