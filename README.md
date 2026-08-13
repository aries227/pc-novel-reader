# 简阅 · PC 小说阅读器

简洁高效的 Windows 桌面小说阅读器，基于 Electron + TypeScript 构建。

## 功能

- 格式支持：TXT（自动识别 UTF-8 / GBK / GB18030 / Big5 等编码）、EPUB、MOBI、AZW3、FB2、PDF、HTML、DOCX。
- 书架：网格展示、最近阅读排序、进度记忆、书签、书架 JSON 导入/导出。
- 阅读器：翻页 / 滚动双模式、字号 / 行距 / 主题（白 / 米黄 / 夜间）调节、章节目录、进度条、快捷键（`←`/`→`/`PageUp`/`PageDown`/`空格` 翻页，`Esc` 返回书架）。
- 扫码上传：手机扫描二维码后直接用浏览器上传书籍到书架，无需安装 App。
- 书源系统：导入 / 删除 / 搜索 JSON 书源，在线搜索、阅读、加入书架，章节自动缓存，断网可读。
- 网页解析：粘贴任意网页 URL，自动提取正文生成书籍。

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

- `简阅 Setup 0.1.0.exe`（NSIS 安装版）
- `简阅 0.1.0.exe`（免安装便携版）

## 自动更新

安装版支持自动更新（基于 GitHub Releases 的差分下载，只拉取变化部分，类似补丁）：

- 应用启动约 5 秒后自动检查新版本，发现更新后后台下载。
- 下载完成后重启应用即自动安装，无需手动下载安装包。
- 也可以随时在“设置 → 检查更新”里手动检查。

免安装便携版无法自动替换正在运行的程序，请手动下载最新便携版覆盖旧文件。

发布新版本流程（维护者）：

```bash
npm run dist
gh release create v0.2.0 "dist/简阅 Setup 0.2.0.exe" "dist/简阅 Setup 0.2.0.exe.blockmap" "dist/简阅 0.2.0.exe" "dist/latest.yml" --title "v0.2.0" --notes "更新说明"
```

## 扫码上传

1. 在书架右上角点击“扫码上传”。
2. 点击“启动服务”，窗口内出现二维码和局域网地址（如 `http://192.168.1.5:12345/?token=xxx`）。
3. 手机连接同一 Wi-Fi，扫描二维码，在打开的网页中选择书籍文件上传。
4. 上传完成后书籍自动出现在书架中。

若手机无法访问，通常是 Windows 防火墙拦截，可放行端口（把 6789 换成实际端口）：

```powershell
netsh advfirewall firewall add rule name="jian-yue-upload" dir=in action=allow protocol=TCP localport=6789
```

## 书源使用

1. 点击“书源” → “导入书源文件”（或从 URL 导入 JSON）。
2. 点击书源右侧“搜索”，输入书名。
3. 在结果中“阅读”章节，或“加入书架”以便记录进度。

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
