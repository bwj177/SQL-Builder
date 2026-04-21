# DDL SQL Builder MVP

An offline, browser-based SQL builder for cases where you only have DDL and want a point-and-click way to:

- choose tables
- add manual joins
- pick fields
- apply aggregations like `SUM(amount)` or `COUNT(DISTINCT user_id)`
- add filters, sorting, and limits
- preview and save generated SQL locally

This MVP is browser-first, but it now includes a tiny local Python server so models and saved queries are stored on disk instead of only in browser storage.

## What It Does

1. Save one or more DDL files as reusable models with separate `env + tableName` metadata.
2. Store models in `data/models.json`.
3. Store saved query presets in `data/queries.json`.
4. Store AI model settings in `data/llm_config.json` without persisting the API key itself.
5. Choose a model, then choose a base table.
6. Optionally add manual joins between parsed tables.
7. Build one of three query types:
   - `明细查询`
   - `聚合查询`
   - `Top N`
8. Preview the SQL in real time.
9. Optionally describe a query in natural language and let either a configured OpenAI-compatible model or the local `codex` login session generate SQL from the current DDL model.

## Files

- [index.html](/Users/bytedance/sql-builder-mvp/index.html)
- [styles.css](/Users/bytedance/sql-builder-mvp/styles.css)
- [app.js](/Users/bytedance/sql-builder-mvp/app.js)
- [server.py](/Users/bytedance/sql-builder-mvp/server.py)
- [data/llm_config.json](/Users/bytedance/sql-builder-mvp/data/llm_config.json)
- [data/models.json](/Users/bytedance/sql-builder-mvp/data/models.json)
- [data/queries.json](/Users/bytedance/sql-builder-mvp/data/queries.json)
- [schema/sample_schema.sql](/Users/bytedance/sql-builder-mvp/schema/sample_schema.sql)

## Run It

```bash
cd /Users/bytedance/sql-builder-mvp
python3 server.py
```

Then open `http://127.0.0.1:8000`.

If you want AI SQL generation, export the API key before starting the server:

```bash
export OPENAI_API_KEY=...
python3 server.py
```

If you want to use the local Codex login bridge instead, make sure this machine already has:

```bash
codex login status
```

When it returns a logged-in state, choose `Codex 登录态` in the page and save the AI config.
If the model field is left blank in Codex mode, the bridge will use the default model from `~/.codex/config.toml`.

## Current Scope

- DDL-driven table and column parsing
- Model metadata managed by `env + tableName`
- Manual join setup
- Dimensions, metrics, filters, sorting, limit
- SQL preview and copy
- AI-driven SQL generation through either a configurable OpenAI-compatible Responses API endpoint or a local `codex exec` bridge
- Search-driven table/field browser for large schemas
- On-disk models and saved query specs

## Current Limitations

- No automatic join inference from foreign keys yet
- No nested subqueries yet
- No dialect-specific quoting rules
- DDL parsing is intentionally lightweight and targets common `CREATE TABLE` syntax
- The local server is single-user and meant for local use only

## Extension Ideas

- import/export metadata JSON
- saved join presets
- reusable named filters
- SQL dialect selection
- CSV data preview via DuckDB/WASM
