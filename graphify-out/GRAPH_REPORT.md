# Graph Report - sql-builder-mvp  (2026-04-22)

## Corpus Check
- 2 files · ~14,822 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 238 nodes · 595 edges · 8 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]

## God Nodes (most connected - your core abstractions)
1. `render()` - 23 edges
2. `renderPreview()` - 17 edges
3. `pushSqlStatus()` - 17 edges
4. `loadActiveModelSchema()` - 12 edges
5. `getAvailableFields()` - 12 edges
6. `renderSQL()` - 12 edges
7. `escapeHtml()` - 11 edges
8. `escapeAttr()` - 11 edges
9. `parseSelectSqlAst()` - 10 edges
10. `getJoinConditions()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `init()` --calls--> `render()`  [EXTRACTED]
  app.js → app.js  _Bridges community 2 → community 3_
- `renderPreview()` --calls--> `buildModelLabel()`  [EXTRACTED]
  app.js → app.js  _Bridges community 2 → community 7_
- `handleSaveModel()` --calls--> `parseDDL()`  [EXTRACTED]
  app.js → app.js  _Bridges community 2 → community 6_
- `handleDynamicChange()` --calls--> `render()`  [EXTRACTED]
  app.js → app.js  _Bridges community 4 → community 3_
- `handleDynamicClick()` --calls--> `createNextJoinGroupId()`  [EXTRACTED]
  app.js → app.js  _Bridges community 4 → community 0_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (53): buildModelSelectGroups(), buildSavedQueryTree(), cleanIdentifier(), closeTopSavedQueriesMenu(), createNextFilterGroupId(), createNextGroupId(), createNextHavingGroupId(), createNextJoinGroupId() (+45 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (28): AppHandler, build_sql_generation_payload(), call_codex_cli_for_sql(), call_llm_for_sql(), call_openai_compatible_for_sql(), compose_model_name(), default_llm_config_payload(), default_models_payload() (+20 more)

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (36): bindEvents(), buildModelLabel(), clone(), ensureSampleModel(), exportQuerySpec(), fetchJson(), getActiveModel(), handleDeleteActiveModel() (+28 more)

### Community 3 - "Community 3"
Cohesion: 0.1
Nodes (30): addDimensionFromInput(), findFieldMatch(), getAvailableFields(), getAvailableTables(), getFieldSuggestionLabels(), getHavingFields(), getResolvedJoins(), getSortDisplayValue() (+22 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (24): buildJoinOnClause(), buildJoinOnClauseWithContext(), buildJoinPreview(), createDefaultFilter(), getColumnsForTable(), getJoinConditions(), getLastFilterGroupId(), getLastHavingGroupId() (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (20): buildHavingFieldMap(), collectFieldsFromSpec(), createSqlRenderContext(), defaultMetricAlias(), describeSqlDialect(), formatAlias(), formatQueryColumn(), formatTableColumn() (+12 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (19): escapeAttr(), escapeHtml(), getMatchingColumns(), getModelDisplayName(), parseDDL(), renderDimensionTag(), renderFilterGroup(), renderFilterRow() (+11 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (15): buildAiStatusMessages(), buildManualSqlSourceKey(), buildPreviewMeta(), describeProvider(), describeSavedQuery(), describeSelectedDimensions(), getModelLabelById(), getRenderableAiResult() (+7 more)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `render()` connect `Community 3` to `Community 0`, `Community 2`, `Community 4`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `renderPreview()` connect `Community 7` to `Community 0`, `Community 2`, `Community 3`, `Community 5`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._