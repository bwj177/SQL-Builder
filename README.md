# Offline SQL Builder

一个本地运行的可视化 SQL 构建工具。它适合在没有真实数据库连接的情况下，基于提前导入的 DDL 模型，通过点击字段、配置 Join、过滤条件、聚合和排序，快速生成可复制的查询 SQL。

项目定位是轻量、离线、可私有化的 SQL Builder，而不是 BI 平台或数据库客户端。

## 功能特性

- **DDL 模型管理**：粘贴或导入 `CREATE TABLE` DDL，保存为可复用模型。
- **模型分层管理**：模型名称支持 `目录/子目录/模型名`，并可按环境区分，例如 `pre`、`load`、`prd`。
- **字段点击选择**：查询字段、Join 字段、过滤字段均支持字段 Tag 点击选择，也保留模糊搜索输入。
- **Join 配置**：支持 `LEFT`、`INNER`、`RIGHT` Join，并支持多条件和条件组。
- **Where 条件组**：支持 `(a AND b) OR (c AND d)` 这类组合式过滤条件。
- **聚合查询**：支持 `SUM`、`AVG`、`COUNT`、`COUNT DISTINCT`、`MIN`、`MAX`。
- **模板管理**：查询模板支持 `目录/子目录/模板名` 的层级保存和载入。
- **SQL 实时预览**：配置变化后实时生成 SQL，支持一键复制。
- **AI 生成 SQL**：可选使用 OpenAI 兼容接口，或本机 Codex 登录态桥接生成 SQL。
- **本地文件存储**：模型、模板和 AI 配置默认保存在本地 `data/*.json`，不会提交到 Git。

## 快速开始

要求：Python 3.9+。

```bash
python3 server.py
```

启动后访问：

```text
http://127.0.0.1:8000/
```

首次启动时，服务会自动创建本地运行数据目录和 JSON 文件。

## 使用流程

1. 在「选择模型」中输入环境和模型路径，例如 `prd` + `财务/成本/CUT表`。
2. 粘贴或导入 DDL，点击「保存为模型」。
3. 选择基表。
4. 在「选择字段」中点击字段 Tag，或保留为空默认 `SELECT *`。
5. 如需多表查询，在「配置 Join」中选择左右表和字段。
6. 在「设置过滤」中配置 Where 条件，必要时新增条件组。
7. 在「聚合排序」和「排序限制」中配置指标、排序和 Limit。
8. 在右侧 SQL 预览中复制生成的 SQL。
9. 可将当前查询保存为模板，例如 `财务/成本/最近30天费用`。

## 本地数据与隐私

以下文件是本地运行数据，可能包含私有 DDL、表名、字段注释、查询模板或本地 AI 配置，已在 `.gitignore` 中排除：

```text
data/models.json
data/queries.json
data/llm_config.json
```

说明：

- `models.json` 保存模型元数据和原始 DDL。
- `queries.json` 保存查询模板和查询配置。
- `llm_config.json` 保存 AI 提供方、模型名、Base URL、环境变量名等配置。
- API Key 不会写入 JSON，OpenAI 兼容模式只读取环境变量。
- 如果这些文件已经被 Git 跟踪过，请执行：

```bash
git rm --cached data/models.json data/queries.json data/llm_config.json
```

## AI 配置

AI 功能是可选的。

### OpenAI 兼容接口

启动服务前设置环境变量：

```bash
export OPENAI_API_KEY=your_api_key
python3 server.py
```

页面中选择「OpenAI / 兼容接口」，配置 Base URL、模型名和 API Key 环境变量名。

### Codex 登录态

如果本机已经安装并登录 Codex CLI，可选择「Codex 登录态」。服务会通过本机 `codex` 命令桥接生成 SQL。

```bash
codex login status
```

如果未登录，需要先完成本机 Codex 登录。

## 项目结构

```text
.
├── index.html                  # 页面入口
├── styles.css                  # 页面样式
├── app.js                      # 前端交互、DDL 解析、SQL 生成逻辑
├── server.py                   # 本地 Python HTTP 服务和文件存储 API
├── schema/
│   ├── sample_schema.sql       # 可公开的演示 DDL
│   └── sql_ai_result.schema.json
└── data/                       # 本地运行数据，默认被 .gitignore 排除
```

## API 概览

本地服务提供以下接口：

- `GET /api/state`：读取模型、模板、AI 配置和 Codex 登录状态。
- `POST /api/models`：保存模型列表。
- `POST /api/queries`：保存查询模板列表。
- `POST /api/llm-config`：保存 AI 配置。
- `GET /api/codex-login-status`：检查本机 Codex 登录状态。
- `POST /api/generate-sql`：调用 AI 生成 SQL。

## 当前限制

- 不连接真实数据库，不执行 SQL。
- 不做自动外键/血缘推断，Join 需要手动配置。
- DDL 解析是轻量实现，覆盖常见 `CREATE TABLE` / Hive DDL 场景，不是完整 SQL Parser。
- 多用户协作、鉴权、远程存储暂未内置。

## 开源前检查清单

提交到 GitHub 前建议执行：

```bash
git status --short
git ls-files --others --exclude-standard
rg -n -i "api[_-]?key|secret|token|password|cookie|authorization|bearer|sk-" .
```

确认 `data/*.json`、`.env*`、密钥文件和本地缓存没有出现在待提交列表中。

