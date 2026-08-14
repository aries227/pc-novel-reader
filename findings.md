# 研究发现

## 打包与发布

- 主进程为 ESM（package.json type=module），electron-updater 是 CJS 且无法被 Node ESM 具名导出探测，必须默认导入后解构（v0.4.1 已修复）。
- git push 直连/代理均不可靠；当前用 GitHub REST API（blob/tree/commit/ref）推送，父提交与 base_tree 必须取远端值。
- electron-builder 对中文产物名会生成 ASCII 的 latest.yml URL，发布时需用 ASCII 资产名。
- 离线词典数据经 extraResources 打进 `resources/resources/`，代码用 `process.resourcesPath + '/resources'`。

## 词典数据

- ECDICT dict.json 77 万条，lemma.json 6.2 万词条含词形与频率；Tatoeba 中英句对约 7MB。
- 当前内置 2.5 万高频词（2.9MB）+ 例句 1.8MB；扩容需重新跑 scripts/generate-dictionary.mjs。
- ECDICT translation 通常自带词性前缀（n./v. 等），tag 字段覆盖 zk/gk/cet4/cet6/ky/toefl/ielts/gre。

## UI

- 阅读器现有浮动 translate-panel；新面板改为右侧 Tab（翻译/词典/练习），练习收起后保持状态实现边翻边做。
