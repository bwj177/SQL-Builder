(function () {
  const LEGACY_STORAGE_KEYS = {
    models: "sqlBuilder.models",
    activeModelId: "sqlBuilder.activeModelId",
    savedQueries: "sqlBuilder.savedQueries",
    ddl: "sqlBuilder.ddl",
  };

  const API_PATHS = {
    state: "/api/state",
    models: "/api/models",
    queries: "/api/queries",
    dictionary: "/api/dictionary",
    llmConfig: "/api/llm-config",
    generateSql: "/api/generate-sql",
    codexLoginStatus: "/api/codex-login-status",
  };

  const SAMPLE_DDL = `CREATE TABLE users (
  user_id BIGINT PRIMARY KEY,
  user_name VARCHAR(128),
  country VARCHAR(32),
  signup_date DATE,
  is_vip BOOLEAN
);

CREATE TABLE orders (
  order_id BIGINT PRIMARY KEY,
  user_id BIGINT,
  order_status VARCHAR(32),
  biz_line VARCHAR(64),
  pay_amount DECIMAL(18,2),
  discount_amount DECIMAL(18,2),
  pay_date DATE,
  created_at TIMESTAMP
);

CREATE TABLE order_items (
  item_id BIGINT PRIMARY KEY,
  order_id BIGINT,
  sku_id BIGINT,
  category_name VARCHAR(128),
  quantity INT,
  item_amount DECIMAL(18,2)
);

CREATE TABLE refunds (
  refund_id BIGINT PRIMARY KEY,
  order_id BIGINT,
  refund_amount DECIMAL(18,2),
  refund_reason VARCHAR(255),
  refund_date DATE
);`;

  const SAMPLE_MODEL = {
    id: "demo-ecommerce-model",
    env: "demo",
    tableName: "电商演示模型",
    name: "demo / 电商演示模型",
    ddl: SAMPLE_DDL,
    builtIn: true,
    createdAt: "2026-04-20T00:00:00.000Z",
  };

  const TEMPLATE_META = {
    detail: {
      title: "明细查询",
      description: "直接选字段，生成明细 SQL。",
    },
    aggregate: {
      title: "聚合查询",
      description: "选维度和指标，生成 GROUP BY SQL。",
    },
    topn: {
      title: "Top N",
      description: "聚合后按指标排序并限制返回行数。",
    },
  };

  const OPERATORS = [
    { value: "=", label: "等于 (=)" },
    { value: "!=", label: "不等于 (!=)" },
    { value: ">", label: "大于 (>)" },
    { value: ">=", label: "大于等于 (>=)" },
    { value: "<", label: "小于 (<)" },
    { value: "<=", label: "小于等于 (<=)" },
    { value: "like", label: "模糊匹配 (LIKE)" },
    { value: "in", label: "包含在 (IN)" },
    { value: "between", label: "区间 (BETWEEN)" },
    { value: "is_null", label: "为空 (IS NULL)" },
    { value: "is_not_null", label: "不为空 (IS NOT NULL)" },
  ];

  const AGGREGATIONS = ["sum", "avg", "count", "count_distinct", "min", "max"];
  const SQL_DIALECTS = ["hive", "mysql", "presto", "plain"];
  const DEFAULT_LLM_CONFIG = {
    provider: "codex_cli",
    baseUrl: "https://api.openai.com/v1",
    model: "",
    apiKeyEnv: "OPENAI_API_KEY",
    reasoningEffort: "medium",
    temperature: "0.1",
  };

  const EMPTY_STATE = {
    models: [],
    activeModelId: "",
    modelDraftEnv: "prd",
    modelDraftTableName: "",
    modelDraftDdl: "",
    schemaTableSearch: "",
    schemaColumnSearch: "",
    schemaActiveTable: "",
    schema: { tables: [] },
    baseTable: "",
    joins: [],
    template: "detail",
    selectedDimensions: [],
    metrics: [],
    filters: [],
    filterConditionOperator: "and",
    filterGroupOperator: "and",
    havingFilters: [],
    havingConditionOperator: "and",
    havingGroupOperator: "and",
    sort: { field: "", dir: "desc" },
    limit: "100",
    offset: "",
    sqlDialect: "hive",
    sqlStrictMode: true,
    savedQueries: [],
    dictionaryEntries: [],
    llmConfig: clone(DEFAULT_LLM_CONFIG),
    codexLoginStatus: {
      configured: false,
      hasAuthFile: false,
      statusMessage: "Codex 登录状态未检查",
    },
    aiPrompt: "",
    aiResult: null,
    aiLoading: false,
    sqlDraft: "",
    sqlDraftSource: "",
    editingModelId: "",
    activeConfigTab: "model",
  };

  let state = clone(EMPTY_STATE);
  let dom = {};

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  async function init() {
    dom = {
      modelSelect: document.getElementById("model-select"),
      modelStatus: document.getElementById("model-status"),
      schemaSummary: document.getElementById("schema-summary"),
      schemaTableSearchInput: document.getElementById("schema-table-search"),
      schemaTableOptions: document.getElementById("schema-table-options"),
      schemaColumnSearchInput: document.getElementById("schema-column-search"),
      schemaColumnOptions: document.getElementById("schema-column-options"),
      modelEnvInput: document.getElementById("model-env-input"),
      modelTableNameInput: document.getElementById("model-table-name-input"),
      modelDdlInput: document.getElementById("model-ddl-input"),
      modelFileInput: document.getElementById("model-file-input"),
      loadActiveModelDraftButton: document.getElementById("load-active-model-draft-btn"),
      updateActiveModelButton: document.getElementById("update-active-model-btn"),
      baseTableSelect: document.getElementById("base-table-select"),
      templateStrip: document.getElementById("template-strip"),
      joinsList: document.getElementById("joins-list"),
      dimensionAddInput: document.getElementById("dimension-add-input"),
      dimensionFieldOptions: document.getElementById("dimension-field-options"),
      selectedDimensionsList: document.getElementById("selected-dimensions-list"),
      metricsList: document.getElementById("metrics-list"),
      filtersList: document.getElementById("filters-list"),
      havingFiltersList: document.getElementById("having-filters-list"),
      sortFieldInput: document.getElementById("sort-field-input"),
      sortFieldOptions: document.getElementById("sort-field-options"),
      sortDirectionSelect: document.getElementById("sort-direction-select"),
      limitInput: document.getElementById("limit-input"),
      offsetInput: document.getElementById("offset-input"),
      sqlDialectSelect: document.getElementById("sql-dialect-select"),
      sqlStrictModeInput: document.getElementById("sql-strict-mode-input"),
      llmProviderSelect: document.getElementById("llm-provider-select"),
      llmBaseUrlInput: document.getElementById("llm-base-url-input"),
      llmModelInput: document.getElementById("llm-model-input"),
      llmApiKeyEnvInput: document.getElementById("llm-api-key-env-input"),
      llmReasoningEffortSelect: document.getElementById("llm-reasoning-effort-select"),
      llmTemperatureInput: document.getElementById("llm-temperature-input"),
      saveLlmConfigButton: document.getElementById("save-llm-config-btn"),
      codexLoginStatus: document.getElementById("codex-login-status"),
      refreshCodexStatusButton: document.getElementById("refresh-codex-status-btn"),
      aiPromptInput: document.getElementById("ai-prompt-input"),
      generateAiSqlButton: document.getElementById("generate-ai-sql-btn"),
      clearAiResultButton: document.getElementById("clear-ai-result-btn"),
      aiResultStatus: document.getElementById("ai-result-status"),
      dictTermInput: document.getElementById("dict-term-input"),
      dictFieldInput: document.getElementById("dict-field-input"),
      dictFieldOptions: document.getElementById("dict-field-options"),
      dictDescriptionInput: document.getElementById("dict-description-input"),
      addDictionaryEntryButton: document.getElementById("add-dictionary-entry-btn"),
      dictionaryList: document.getElementById("dictionary-list"),
      querySummary: document.getElementById("query-summary"),
      sqlStatus: document.getElementById("sql-status"),
      sqlOutput: document.getElementById("sql-output"),
      saveNameInput: document.getElementById("save-name-input"),
      savedQueriesList: document.getElementById("saved-queries-list"),
      topSavedQueriesButton: document.getElementById("top-saved-queries-btn"),
      topSavedQueriesMenu: document.getElementById("top-saved-queries-menu"),
      configTabButtons: Array.from(document.querySelectorAll("[data-config-tab]")),
      configTabPanels: Array.from(document.querySelectorAll("[data-tab-panel]")),
    };

    bindEvents();
    await hydrateFromBackend();
    loadActiveModelSchema({ resetBuilder: true, quiet: true });
    render();
  }

  async function hydrateFromBackend() {
    try {
      const payload = await fetchJson(API_PATHS.state);
      state.models = normalizeModels(payload.models);
      state.activeModelId = state.models.some((model) => model.id === payload.activeModelId)
        ? payload.activeModelId
        : state.models[0]?.id || "";
      state.savedQueries = Array.isArray(payload.savedQueries) ? payload.savedQueries : [];
      state.dictionaryEntries = Array.isArray(payload.dictionaryEntries) ? payload.dictionaryEntries : [];
      state.llmConfig = normalizeLlmConfig(payload.llmConfig);
      state.codexLoginStatus = normalizeCodexLoginStatus(payload.codexLoginStatus);

      const migrated = await maybeMigrateLegacyStorage(payload);
      if (migrated) {
        return;
      }
    } catch (error) {
      state.models = [clone(SAMPLE_MODEL)];
      state.activeModelId = SAMPLE_MODEL.id;
      state.savedQueries = [];
      state.dictionaryEntries = [];
      state.llmConfig = clone(DEFAULT_LLM_CONFIG);
      state.codexLoginStatus = clone(EMPTY_STATE.codexLoginStatus);
      pushSqlStatus(
        "error",
        `读取本地文件存储失败，已回退到临时内存状态：${error.message || "未知错误"}`
      );
    }
  }

  async function maybeMigrateLegacyStorage(remotePayload) {
    const legacy = readLegacyStorageSnapshot();
    if (!legacy.models.length && !legacy.savedQueries.length) {
      return false;
    }

    const remoteOnlySample =
      (remotePayload.models || []).length <= 1 &&
      (remotePayload.models || [])[0]?.id === SAMPLE_MODEL.id &&
      !(remotePayload.savedQueries || []).length;

    if (!remoteOnlySample) {
      return false;
    }

    state.models = legacy.models.length ? legacy.models : [clone(SAMPLE_MODEL)];
    state.activeModelId =
      state.models.some((model) => model.id === legacy.activeModelId)
        ? legacy.activeModelId
        : state.models[0]?.id || "";
    state.savedQueries = legacy.savedQueries;

    await persistModels();
    await persistQueries();
    pushSqlStatus("info", "已把旧版浏览器缓存中的模型和查询模板迁移到本地文件。");
    return true;
  }

  function readLegacyStorageSnapshot() {
    const storedModels = safeLocalStorageGet(LEGACY_STORAGE_KEYS.models);
    const storedQueries = safeLocalStorageGet(LEGACY_STORAGE_KEYS.savedQueries);
    const storedActiveModelId = safeLocalStorageGet(LEGACY_STORAGE_KEYS.activeModelId);
    const legacyDdl = safeLocalStorageGet(LEGACY_STORAGE_KEYS.ddl);

    const hasLegacyModelData =
      Boolean(storedModels && storedModels.trim()) || Boolean(legacyDdl && legacyDdl.trim());
    const models = hasLegacyModelData
      ? normalizeModels(storedModels ? safeParseJson(storedModels, []) : null, legacyDdl)
      : [];
    const savedQueries = storedQueries ? safeParseJson(storedQueries, []) : [];

    return {
      models,
      activeModelId: storedActiveModelId || models[0]?.id || "",
      savedQueries: Array.isArray(savedQueries) ? savedQueries : [],
    };
  }

  function normalizeModels(input, legacyDdl) {
    let rawModels = [];

    if (Array.isArray(input)) {
      rawModels = input;
    } else if (typeof input === "string") {
      rawModels = safeParseJson(input, []);
    }

    let models = Array.isArray(rawModels)
      ? rawModels
          .filter((item) => item && typeof item.ddl === "string")
          .map((item) => normalizeModelRecord(item))
      : [];

    if (!models.length && legacyDdl && legacyDdl.trim()) {
      models = [
        normalizeModelRecord({
          id: "legacy-import-model",
          env: "default",
          tableName: "历史导入模型",
          ddl: legacyDdl,
          builtIn: false,
          createdAt: new Date().toISOString(),
          updatedAt: "",
        }),
      ];
    }

    if (!models.length) {
      models = [clone(SAMPLE_MODEL)];
    }

    return models;
  }

  function normalizeModelRecord(input) {
    const builtIn = Boolean(input?.builtIn);
    const env = String(input?.env || "").trim() || (builtIn ? "demo" : "default");
    const tableName = String(input?.tableName || input?.name || "").trim() || "未命名模型";
    const name = buildModelLabel({ env, tableName });
    return {
      id: input?.id || makeModelId(env, tableName),
      env,
      tableName,
      name,
      ddl: input?.ddl || "",
      builtIn,
      createdAt: input?.createdAt || new Date().toISOString(),
      updatedAt: input?.updatedAt || "",
    };
  }

  function buildModelLabel(model) {
    if (!model) {
      return "";
    }
    const env = String(model?.env || "").trim() || "default";
    const tableName = String(model?.tableName || model?.name || "").trim() || "未命名模型";
    return `${env} / ${tableName}`;
  }

  function getModelDisplayName(model) {
    const parts = splitModelPath(model?.tableName || model?.name || "");
    return parts[parts.length - 1] || "未命名模型";
  }

  function splitModelPath(name) {
    return String(name || "")
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function normalizeLlmConfig(input) {
    const source = input && typeof input === "object" ? input : {};
    const provider = ["codex_cli", "openai_compatible"].includes(
      String(source.provider || "").trim()
    )
      ? String(source.provider).trim()
      : DEFAULT_LLM_CONFIG.provider;
    const reasoningEffort = ["none", "low", "medium", "high", "xhigh"].includes(
      String(source.reasoningEffort || "").trim().toLowerCase()
    )
      ? String(source.reasoningEffort).trim().toLowerCase()
      : DEFAULT_LLM_CONFIG.reasoningEffort;

    let temperature = source.temperature;
    if (temperature === null || typeof temperature === "undefined" || temperature === "") {
      temperature = DEFAULT_LLM_CONFIG.temperature;
    }

    return {
      provider,
      baseUrl: String(source.baseUrl || DEFAULT_LLM_CONFIG.baseUrl).trim() || DEFAULT_LLM_CONFIG.baseUrl,
      model:
        provider === "codex_cli"
          ? String(source.model || "").trim()
          : String(source.model || "gpt-5.4-mini").trim() || "gpt-5.4-mini",
      apiKeyEnv:
        String(source.apiKeyEnv || DEFAULT_LLM_CONFIG.apiKeyEnv).trim() || DEFAULT_LLM_CONFIG.apiKeyEnv,
      reasoningEffort,
      temperature: String(temperature).trim() || DEFAULT_LLM_CONFIG.temperature,
    };
  }

  function normalizeCodexLoginStatus(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      configured: Boolean(source.configured),
      hasAuthFile: Boolean(source.hasAuthFile),
      statusMessage: String(source.statusMessage || "Codex 登录状态未检查").trim(),
    };
  }

  function bindEvents() {
    document.getElementById("load-demo-model-btn")?.addEventListener("click", async () => {
      ensureSampleModel();
      state.activeModelId = SAMPLE_MODEL.id;
      state.aiResult = null;
      await persistModels();
      loadActiveModelSchema({ resetBuilder: true, quiet: true });
      render();
      pushSqlStatus("info", "已切换到演示模型。");
    });

    dom.topSavedQueriesButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleTopSavedQueriesMenu();
    });

    document.getElementById("execute-sql-btn").addEventListener("click", () => {
      handleValidateSqlSyntax();
    });

    dom.configTabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.activeConfigTab = button.dataset.configTab || "model";
        renderConfigTabs();
      });
    });

    document.getElementById("delete-model-btn").addEventListener("click", async () => {
      await handleDeleteActiveModel();
    });

    dom.modelSelect.addEventListener("change", async (event) => {
      state.activeModelId = event.target.value;
      state.editingModelId = "";
      state.aiResult = null;
      await persistModels();
      loadActiveModelSchema({ resetBuilder: true, quiet: true });
      render();
      pushSqlStatus("info", `已切换到模型「${buildModelLabel(getActiveModel())}」。`);
    });

    dom.modelEnvInput.addEventListener("input", (event) => {
      state.modelDraftEnv = event.target.value;
    });

    dom.modelTableNameInput.addEventListener("input", (event) => {
      state.modelDraftTableName = event.target.value;
    });

    dom.modelDdlInput.addEventListener("input", (event) => {
      state.modelDraftDdl = event.target.value;
    });

    dom.schemaTableSearchInput.addEventListener("input", (event) => {
      state.schemaTableSearch = event.target.value;
      updateSchemaActiveTableFromSearch();
      renderSchemaSummary();
    });

    dom.schemaTableSearchInput.addEventListener("change", (event) => {
      state.schemaTableSearch = event.target.value;
      updateSchemaActiveTableFromSearch();
      renderSchemaSummary();
    });

    dom.schemaColumnSearchInput.addEventListener("input", (event) => {
      state.schemaColumnSearch = event.target.value;
      renderSchemaSummary();
    });

    dom.schemaColumnSearchInput.addEventListener("change", (event) => {
      state.schemaColumnSearch = event.target.value;
      renderSchemaSummary();
    });

    document.getElementById("save-model-btn").addEventListener("click", async () => {
      await handleSaveModel();
    });

    dom.loadActiveModelDraftButton.addEventListener("click", () => {
      loadActiveModelIntoDraft();
    });

    dom.updateActiveModelButton.addEventListener("click", async () => {
      await handleUpdateActiveModel();
    });

    document.getElementById("clear-model-draft-btn").addEventListener("click", () => {
      state.modelDraftEnv = "prd";
      state.modelDraftTableName = "";
      state.modelDraftDdl = "";
      state.editingModelId = "";
      syncDraftInputs();
    });

    document.getElementById("use-sample-draft-btn").addEventListener("click", () => {
      state.modelDraftEnv = "demo";
      state.modelDraftTableName = "电商演示模型";
      state.modelDraftDdl = SAMPLE_DDL;
      state.editingModelId = "";
      syncDraftInputs();
    });

    dom.modelFileInput.addEventListener("change", (event) => {
      const [file] = event.target.files || [];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        state.modelDraftDdl = String(reader.result || "");
        if (!state.modelDraftTableName.trim()) {
          state.modelDraftTableName = file.name.replace(/\.[^.]+$/, "");
        }
        syncDraftInputs();
      };
      reader.readAsText(file);
      event.target.value = "";
    });

    dom.baseTableSelect.addEventListener("change", (event) => {
      state.baseTable = event.target.value;
      state.joins = [];
      state.selectedDimensions = [];
      state.metrics = [];
      state.filters = [];
      state.havingFilters = [];
      state.sort.field = "";
      render();
    });

    dom.sortFieldInput.addEventListener("change", (event) => {
      state.sort.field = normalizeSortFieldInput(event.target.value);
      dom.sortFieldInput.value = getSortDisplayValue(state.sort.field);
      render();
    });

    dom.sortDirectionSelect.addEventListener("change", (event) => {
      state.sort.dir = event.target.value;
      render();
    });

    dom.limitInput.addEventListener("input", (event) => {
      state.limit = event.target.value;
      render();
    });

    dom.offsetInput.addEventListener("input", (event) => {
      state.offset = event.target.value;
      render();
    });

    dom.sqlDialectSelect.addEventListener("change", (event) => {
      state.sqlDialect = normalizeSqlDialect(event.target.value);
      render();
    });

    dom.sqlStrictModeInput.addEventListener("change", (event) => {
      state.sqlStrictMode = event.target.checked;
      render();
    });

    dom.llmProviderSelect.addEventListener("change", (event) => {
      state.llmConfig.provider = event.target.value;
      if (state.llmConfig.provider === "codex_cli" && state.llmConfig.model === "gpt-5.4-mini") {
        state.llmConfig.model = "";
      }
      if (state.llmConfig.provider === "openai_compatible" && !state.llmConfig.model.trim()) {
        state.llmConfig.model = "gpt-5.4-mini";
      }
      render();
    });

    dom.llmBaseUrlInput.addEventListener("input", (event) => {
      state.llmConfig.baseUrl = event.target.value;
    });

    dom.llmModelInput.addEventListener("input", (event) => {
      state.llmConfig.model = event.target.value;
    });

    dom.llmApiKeyEnvInput.addEventListener("input", (event) => {
      state.llmConfig.apiKeyEnv = event.target.value;
    });

    dom.llmReasoningEffortSelect.addEventListener("change", (event) => {
      state.llmConfig.reasoningEffort = event.target.value;
    });

    dom.llmTemperatureInput.addEventListener("input", (event) => {
      state.llmConfig.temperature = event.target.value;
    });

    dom.aiPromptInput.addEventListener("input", (event) => {
      state.aiPrompt = event.target.value;
    });

    dom.saveLlmConfigButton.addEventListener("click", async () => {
      await handleSaveLlmConfig();
    });

    dom.refreshCodexStatusButton.addEventListener("click", async () => {
      await refreshCodexLoginStatus();
    });

    dom.generateAiSqlButton.addEventListener("click", async () => {
      await handleGenerateAiSql();
    });

    dom.clearAiResultButton.addEventListener("click", () => {
      state.aiResult = null;
      state.aiLoading = false;
      renderPreview();
      pushSqlStatus("info", "已切回手动生成结果。");
    });

    dom.dimensionAddInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addDimensionFromInput();
      }
    });
    dom.dimensionAddInput.addEventListener("input", () => {
      renderDimensionFieldOptions(dom.dimensionAddInput.value);
    });
    dom.dimensionAddInput.addEventListener("focus", () => {
      renderDimensionFieldOptions(dom.dimensionAddInput.value);
    });

    document.getElementById("add-dimension-btn").addEventListener("click", () => {
      addDimensionFromInput();
    });

    document.getElementById("add-join-btn").addEventListener("click", () => {
      if (!state.baseTable) {
        pushSqlStatus("error", "请先选择基表。");
        return;
      }
      state.joins.push(createDefaultJoin());
      render();
    });

    document.getElementById("add-metric-btn").addEventListener("click", () => {
      state.metrics.push(createDefaultMetric());
      render();
    });

    document.getElementById("add-filter-btn").addEventListener("click", () => {
      state.filters.push(createDefaultFilter(getLastFilterGroupId()));
      render();
    });

    document.getElementById("add-filter-group-btn").addEventListener("click", () => {
      state.filters.push(createDefaultFilter(createNextFilterGroupId()));
      render();
    });

    document.getElementById("add-having-filter-btn").addEventListener("click", () => {
      state.havingFilters.push(createDefaultFilter(getLastHavingGroupId()));
      render();
    });

    document.getElementById("add-having-group-btn").addEventListener("click", () => {
      state.havingFilters.push(createDefaultFilter(createNextHavingGroupId()));
      render();
    });

    document.getElementById("copy-sql-btn").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(getCurrentSqlText());
        pushSqlStatus("info", "SQL 已复制到剪贴板。");
      } catch (_error) {
        pushSqlStatus("error", "当前浏览器不允许直接写入剪贴板。");
      }
    });

    dom.dictFieldInput.addEventListener("input", () => renderDictionaryFieldOptions());
    dom.dictFieldInput.addEventListener("focus", () => renderDictionaryFieldOptions());
    dom.addDictionaryEntryButton.addEventListener("click", async () => {
      await handleSaveDictionaryEntry();
    });
    dom.dictionaryList.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-delete-dict-entry]");
      if (!button) {
        return;
      }
      state.dictionaryEntries = state.dictionaryEntries.filter((item) => item.id !== button.dataset.deleteDictEntry);
      await persistDictionary();
      renderDictionary();
      pushSqlStatus("info", "字典项已删除。");
    });

    dom.sqlOutput.addEventListener("input", () => {
      state.sqlDraft = dom.sqlOutput.value;
      state.sqlDraftSource = "manual";
    });

    document.getElementById("save-query-btn").addEventListener("click", async () => {
      const name = dom.saveNameInput.value.trim();
      if (!name) {
        pushSqlStatus("error", "请先输入查询模板名称。");
        return;
      }

      if (!state.activeModelId) {
        pushSqlStatus("error", "请先选择模型，再保存查询模板。");
        return;
      }

      const payload = {
        name,
        savedAt: new Date().toISOString(),
        spec: exportQuerySpec(),
      };

      state.savedQueries = state.savedQueries.filter((item) => item.name !== name);
      state.savedQueries.unshift(payload);
      const ok = await persistQueries();
      if (ok) {
        dom.saveNameInput.value = "";
        renderSavedQueries();
        pushSqlStatus("info", `已保存查询模板「${name}」。`);
      }
    });

    dom.templateStrip.addEventListener("click", (event) => {
      const button = event.target.closest("[data-template]");
      if (!button) {
        return;
      }
      state.template = button.dataset.template;
      render();
    });

    dom.selectedDimensionsList.addEventListener("click", (event) => {
      const toggleButton = event.target.closest("[data-toggle-dimension]");
      if (toggleButton) {
        const fieldId = toggleButton.dataset.toggleDimension;
        if (state.selectedDimensions.includes(fieldId)) {
          state.selectedDimensions = state.selectedDimensions.filter((item) => item !== fieldId);
        } else {
          state.selectedDimensions.push(fieldId);
        }
        render();
        return;
      }

      const button = event.target.closest("[data-remove-dimension]");
      if (!button) {
        return;
      }
      const fieldId = button.dataset.removeDimension;
      state.selectedDimensions = state.selectedDimensions.filter((item) => item !== fieldId);
      render();
    });

    dom.joinsList.addEventListener("change", handleDynamicChange);
    dom.metricsList.addEventListener("change", handleDynamicChange);
    dom.filtersList.addEventListener("change", handleDynamicChange);
    dom.havingFiltersList.addEventListener("change", handleDynamicChange);
    dom.metricsList.addEventListener("input", handleFieldSearchInput);
    dom.filtersList.addEventListener("input", handleFieldSearchInput);
    dom.havingFiltersList.addEventListener("input", handleFieldSearchInput);
    dom.metricsList.addEventListener("focusin", handleFieldSearchInput);
    dom.filtersList.addEventListener("focusin", handleFieldSearchInput);
    dom.havingFiltersList.addEventListener("focusin", handleFieldSearchInput);

    dom.joinsList.addEventListener("click", handleDynamicClick);
    dom.metricsList.addEventListener("click", handleDynamicClick);
    dom.filtersList.addEventListener("click", handleDynamicClick);
    dom.havingFiltersList.addEventListener("click", handleDynamicClick);
    dom.savedQueriesList.addEventListener("click", async (event) => {
      await handleSavedQueryClick(event);
    });
    dom.topSavedQueriesMenu.addEventListener("click", async (event) => {
      event.stopPropagation();
      await handleSavedQueryClick(event);
    });
    document.addEventListener("click", () => {
      closeTopSavedQueriesMenu();
    });
  }

  async function persistModels() {
    try {
      await postJson(API_PATHS.models, {
        models: state.models,
        activeModelId: state.activeModelId,
      });
      return true;
    } catch (error) {
      pushSqlStatus("error", `模型写入文件失败：${error.message || "未知错误"}`);
      return false;
    }
  }

  async function persistQueries() {
    try {
      await postJson(API_PATHS.queries, {
        savedQueries: state.savedQueries,
      });
      return true;
    } catch (error) {
      pushSqlStatus("error", `查询模板写入文件失败：${error.message || "未知错误"}`);
      return false;
    }
  }

  async function persistDictionary() {
    try {
      await postJson(API_PATHS.dictionary, {
        entries: state.dictionaryEntries,
      });
      return true;
    } catch (error) {
      pushSqlStatus("error", `字段字典写入失败：${error.message || "未知错误"}`);
      return false;
    }
  }

  async function persistLlmConfig() {
    try {
      const payload = normalizeLlmConfig(state.llmConfig);
      const saved = await postJson(API_PATHS.llmConfig, {
        ...payload,
        temperature: Number(payload.temperature),
      });
      state.llmConfig = normalizeLlmConfig(saved);
      return true;
    } catch (error) {
      pushSqlStatus("error", `AI 配置保存失败：${error.message || "未知错误"}`);
      return false;
    }
  }

  async function refreshCodexLoginStatus() {
    try {
      const payload = await fetchJson(API_PATHS.codexLoginStatus);
      state.codexLoginStatus = normalizeCodexLoginStatus(payload);
      renderAiConfigState();
      return state.codexLoginStatus;
    } catch (error) {
      state.codexLoginStatus = {
        configured: false,
        hasAuthFile: false,
        statusMessage: error.message || "检查 Codex 登录状态失败",
      };
      renderAiConfigState();
      pushSqlStatus("error", `读取 Codex 登录状态失败：${error.message || "未知错误"}`);
      return state.codexLoginStatus;
    }
  }

  async function handleSaveLlmConfig() {
    const ok = await persistLlmConfig();
    if (ok) {
      if (state.llmConfig.provider === "codex_cli") {
        await refreshCodexLoginStatus();
      }
      syncDraftInputs();
      pushSqlStatus(
        "info",
        `AI 配置已保存，当前模型：${state.llmConfig.model || "本机默认模型"}。`
      );
    }
  }

  async function handleGenerateAiSql() {
    const prompt = state.aiPrompt.trim();
    if (!prompt) {
      pushSqlStatus("error", "请先输入一句话需求描述。");
      return;
    }

    if (!state.activeModelId) {
      pushSqlStatus("error", "请先选择模型，再生成 SQL。");
      return;
    }

    if (state.llmConfig.provider === "codex_cli" && !state.codexLoginStatus.configured) {
      const status = await refreshCodexLoginStatus();
      if (!status.configured) {
        pushSqlStatus("error", `Codex 未登录，无法生成 SQL：${status.statusMessage}`);
        return;
      }
    }

    state.aiLoading = true;
    renderPreview();

    try {
      const result = await postJson(API_PATHS.generateSql, {
        activeModelId: state.activeModelId,
        prompt,
        builderSpec: {
          ...exportQuerySpec(),
          schemaSummary: buildSchemaSummaryForAi(),
          dictionaryEntries: getActiveDictionaryEntries(),
        },
      });
      state.aiResult = result;
      state.aiLoading = false;
      renderPreview();
      pushSqlStatus(
        "info",
        `AI 已根据描述生成 SQL，使用 ${describeProvider(result.llmProvider || state.llmConfig.provider)} · ${result.llmModel || state.llmConfig.model}。`
      );
    } catch (error) {
      state.aiLoading = false;
      renderPreview();
      pushSqlStatus("error", `AI 生成失败：${error.message || "未知错误"}`);
    }
  }

  function ensureSampleModel() {
    if (!state.models.some((model) => model.id === SAMPLE_MODEL.id)) {
      state.models.unshift(clone(SAMPLE_MODEL));
    }
  }

  async function handleSaveModel() {
    const env = state.modelDraftEnv.trim();
    const tableName = state.modelDraftTableName.trim();
    const ddl = state.modelDraftDdl.trim();
    const validation = validateModelDraft(env, tableName, ddl);
    if (!validation.ok) {
      pushSqlStatus("error", validation.error);
      return;
    }

    const existing = state.models.find(
      (model) =>
        model.env.toLowerCase() === env.toLowerCase()
        && model.tableName.toLowerCase() === tableName.toLowerCase()
    );
    const modelLabel = buildModelLabel({ env, tableName });

    if (existing && existing.ddl !== ddl) {
      const confirmed = window.confirm(`模型「${modelLabel}」已存在，是否覆盖？`);
      if (!confirmed) {
        return;
      }
    }

    if (existing) {
      existing.env = env;
      existing.tableName = tableName;
      existing.name = modelLabel;
      existing.ddl = ddl;
      existing.updatedAt = new Date().toISOString();
      state.activeModelId = existing.id;
    } else {
      state.models.unshift(normalizeModelRecord({
        id: makeModelId(env, tableName),
        env,
        tableName,
        ddl,
        builtIn: false,
        createdAt: new Date().toISOString(),
        updatedAt: "",
      }));
      state.activeModelId = state.models[0].id;
    }

    state.aiResult = null;
    state.aiLoading = false;

    const ok = await persistModels();
    if (!ok) {
      return;
    }

    state.modelDraftEnv = "prd";
    state.modelDraftTableName = "";
    state.modelDraftDdl = "";
    state.editingModelId = "";
    loadActiveModelSchema({ resetBuilder: true, quiet: true });
    render();
    pushSqlStatus("info", `模型「${modelLabel}」已保存到本地文件，可直接在上方选择使用。`);
  }

  function loadActiveModelIntoDraft() {
    const activeModel = getActiveModel();
    if (!activeModel) {
      pushSqlStatus("error", "当前没有可编辑的模型。");
      return;
    }
    state.modelDraftEnv = activeModel.env || "default";
    state.modelDraftTableName = activeModel.tableName || activeModel.name || "";
    state.modelDraftDdl = activeModel.ddl || "";
    state.editingModelId = activeModel.id;
    syncDraftInputs();
    pushSqlStatus("info", `已载入模型「${buildModelLabel(activeModel)}」到编辑区。`);
  }

  async function handleUpdateActiveModel() {
    const editingModel = state.models.find((model) => model.id === state.editingModelId) || getActiveModel();
    if (!editingModel) {
      pushSqlStatus("error", "当前没有可更新的模型。");
      return;
    }
    if (editingModel.builtIn) {
      pushSqlStatus("error", "内置演示模型不允许直接修改；请使用“保存为模型”另存。");
      return;
    }

    const env = state.modelDraftEnv.trim();
    const tableName = state.modelDraftTableName.trim();
    const ddl = state.modelDraftDdl.trim();
    const validation = validateModelDraft(env, tableName, ddl);
    if (!validation.ok) {
      pushSqlStatus("error", validation.error);
      return;
    }

    const duplicate = state.models.find(
      (model) =>
        model.id !== editingModel.id &&
        model.env.toLowerCase() === env.toLowerCase() &&
        model.tableName.toLowerCase() === tableName.toLowerCase()
    );
    const nextLabel = buildModelLabel({ env, tableName });
    if (duplicate) {
      pushSqlStatus("error", `模型「${nextLabel}」已存在，不能把当前模型重命名为同名模型。`);
      return;
    }

    const oldLabel = buildModelLabel(editingModel);
    editingModel.env = env;
    editingModel.tableName = tableName;
    editingModel.name = nextLabel;
    editingModel.ddl = ddl;
    editingModel.updatedAt = new Date().toISOString();
    state.activeModelId = editingModel.id;
    state.editingModelId = editingModel.id;
    state.aiResult = null;
    state.aiLoading = false;

    const ok = await persistModels();
    if (!ok) {
      return;
    }

    loadActiveModelSchema({ resetBuilder: true, quiet: true });
    render();
    pushSqlStatus("info", `模型已更新：${oldLabel} -> ${nextLabel}。已保留原模型 ID，历史模板关联不受影响。`);
  }

  function validateModelDraft(env, tableName, ddl) {
    if (!env) {
      return { ok: false, error: "请输入环境，例如 pre、load、prd。" };
    }
    if (!tableName) {
      return { ok: false, error: "请输入表名或模型名。" };
    }
    if (!ddl) {
      return { ok: false, error: "请输入 DDL 后再保存模型。" };
    }
    try {
      const schema = parseDDL(ddl);
      if (!schema.tables.length) {
        return { ok: false, error: "DDL 中没有识别到 CREATE TABLE 语句。" };
      }
    } catch (error) {
      return { ok: false, error: error.message || "DDL 解析失败，模型未保存。" };
    }
    return { ok: true };
  }

  async function handleDeleteActiveModel() {
    const activeModel = getActiveModel();
    if (!activeModel) {
      pushSqlStatus("error", "当前没有可删除的模型。");
      return;
    }

    if (state.models.length <= 1) {
      pushSqlStatus("error", "至少保留一个模型；如果需要测试，可先加载演示模型。");
      return;
    }

    const confirmed = window.confirm(`确认删除模型「${buildModelLabel(activeModel)}」？`);
    if (!confirmed) {
      return;
    }

    state.models = state.models.filter((model) => model.id !== activeModel.id);
    state.activeModelId = state.models[0]?.id || "";
    state.aiResult = null;
    const ok = await persistModels();
    if (!ok) {
      return;
    }

    loadActiveModelSchema({ resetBuilder: true, quiet: true });
    render();
    pushSqlStatus("info", `模型「${buildModelLabel(activeModel)}」已删除。`);
  }

  function handleDynamicChange(event) {
    const target = event.target;
    const rowIndex = Number(target.dataset.index);
    const filterCollection = target.dataset.filterScope === "having" ? state.havingFilters : state.filters;

    if (target.matches("[data-join-condition-field]")) {
      const key = target.dataset.joinConditionField;
      const conditionIndex = Number(target.dataset.conditionIndex);
      const join = state.joins[rowIndex];
      if (!join) {
        return;
      }
      join.conditions = getJoinConditions(join);
      if (!join.conditions[conditionIndex]) {
        join.conditions[conditionIndex] = { leftField: "", rightField: "", groupId: "1" };
      }
      join.conditions[conditionIndex][key] = normalizeJoinConditionValue(rowIndex, key, target.value);
      syncLegacyJoinFields(join);
      render();
      return;
    }

    if (target.matches("[data-join-field]")) {
      const key = target.dataset.joinField;
      state.joins[rowIndex][key] = normalizeJoinValue(rowIndex, key, target.value);
      if (key === "leftTable" || key === "rightTable") {
        state.joins[rowIndex].conditions = getJoinConditions(state.joins[rowIndex]);
        syncLegacyJoinFields(state.joins[rowIndex]);
      }
      render();
      return;
    }

    if (target.matches("[data-metric-field]")) {
      const key = target.dataset.metricField;
      state.metrics[rowIndex][key] =
        key === "field" ? normalizeFieldInput(target.value) : target.value;
      render();
      return;
    }

    if (target.matches("[data-filter-field]")) {
      const key = target.dataset.filterField;
      filterCollection[rowIndex][key] =
        key === "field"
          ? normalizeFieldInput(
              target.value,
              target.dataset.filterScope === "having" ? getHavingFields() : undefined
            )
          : target.value;
      render();
      return;
    }

    if (target.matches("[data-filter-config]")) {
      const key = target.dataset.filterConfig;
      const scope = target.dataset.filterScope || "where";
      if (key === "conditionOperator") {
        if (scope === "having") {
          state.havingConditionOperator = normalizeLogicalOperator(target.value);
        } else {
          state.filterConditionOperator = normalizeLogicalOperator(target.value);
        }
      } else if (key === "groupOperator") {
        if (scope === "having") {
          state.havingGroupOperator = normalizeLogicalOperator(target.value);
        } else {
          state.filterGroupOperator = normalizeLogicalOperator(target.value);
        }
      }
      render();
    }
  }

  function handleDynamicClick(event) {
    const joinFieldTag = event.target.closest("[data-pick-join-condition-field]");
    if (joinFieldTag) {
      const index = Number(joinFieldTag.dataset.index);
      const conditionIndex = Number(joinFieldTag.dataset.conditionIndex);
      const key = joinFieldTag.dataset.pickJoinConditionField;
      const join = state.joins[index];
      if (!join) {
        return;
      }
      join.conditions = getJoinConditions(join);
      if (!join.conditions[conditionIndex]) {
        join.conditions[conditionIndex] = { leftField: "", rightField: "", groupId: "1" };
      }
      join.conditions[conditionIndex][key] = joinFieldTag.dataset.field || "";
      syncLegacyJoinFields(join);
      render();
      return;
    }

    const filterFieldTag = event.target.closest("[data-pick-filter-field]");
    if (filterFieldTag) {
      const index = Number(filterFieldTag.dataset.index);
      const collection = filterFieldTag.dataset.filterScope === "having" ? state.havingFilters : state.filters;
      if (!collection[index]) {
        return;
      }
      collection[index].field = filterFieldTag.dataset.field || "";
      render();
      return;
    }

    const addConditionButton = event.target.closest("[data-add-join-condition]");
    if (addConditionButton) {
      const index = Number(addConditionButton.dataset.index);
      const join = state.joins[index];
      if (!join) {
        return;
      }
      join.conditions = getJoinConditions(join);
      join.conditions.push({
        leftField: "",
        rightField: "",
        groupId: addConditionButton.dataset.groupId || getLastJoinGroupId(join),
      });
      syncLegacyJoinFields(join);
      render();
      return;
    }

    const removeConditionButton = event.target.closest("[data-remove-join-condition]");
    if (removeConditionButton) {
      const index = Number(removeConditionButton.dataset.index);
      const conditionIndex = Number(removeConditionButton.dataset.conditionIndex);
      const join = state.joins[index];
      if (!join) {
        return;
      }
      join.conditions = getJoinConditions(join);
      if (join.conditions.length <= 1) {
        join.conditions = [{ leftField: "", rightField: "", groupId: "1" }];
      } else {
        join.conditions.splice(conditionIndex, 1);
      }
      syncLegacyJoinFields(join);
      render();
      return;
    }

    const addJoinGroupButton = event.target.closest("[data-add-join-condition-group]");
    if (addJoinGroupButton) {
      const index = Number(addJoinGroupButton.dataset.index);
      const join = state.joins[index];
      if (!join) {
        return;
      }
      join.conditions = getJoinConditions(join);
      join.conditions.push({ leftField: "", rightField: "", groupId: createNextJoinGroupId(join) });
      syncLegacyJoinFields(join);
      render();
      return;
    }

    const addFilterToGroupButton = event.target.closest("[data-add-filter-to-group]");
    if (addFilterToGroupButton) {
      const collection =
        addFilterToGroupButton.dataset.filterScope === "having" ? state.havingFilters : state.filters;
      collection.push(createDefaultFilter(addFilterToGroupButton.dataset.groupId || "1"));
      render();
      return;
    }

    const button = event.target.closest("[data-remove-row]");
    if (!button) {
      return;
    }
    const collection = button.dataset.removeRow;
    const index = Number(button.dataset.index);
    state[collection].splice(index, 1);
    render();
  }

  function handleFieldSearchInput(event) {
    const target = event.target;
    if (!target.matches("[data-metric-field='field'], [data-filter-field='field']")) {
      return;
    }
    updateFieldSearchOptions(
      target,
      target.dataset.filterScope === "having" ? getHavingFields() : getAvailableFields()
    );
  }

  function focusSavedQueriesPanel() {
    const panel = dom.savedQueriesList.closest(".saved-panel");
    panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    flashPanel(panel);
    dom.saveNameInput.focus();
  }

  function toggleTopSavedQueriesMenu() {
    if (!dom.topSavedQueriesMenu.hidden) {
      closeTopSavedQueriesMenu();
      return;
    }
    renderTopSavedQueriesMenu();
    dom.topSavedQueriesMenu.hidden = false;
  }

  function closeTopSavedQueriesMenu() {
    if (dom.topSavedQueriesMenu) {
      dom.topSavedQueriesMenu.hidden = true;
    }
  }

  function handleValidateSqlSyntax() {
    const previewPanel = dom.sqlOutput.closest(".preview-panel");
    previewPanel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    flashPanel(previewPanel);
    const sql = getCurrentSqlText();
    const result = parseSelectSqlAst(sql);
    if (result.ok) {
      pushSqlStatus("success", `AST 语法检查通过：${describeSqlAst(result.ast)}。未连接真实数据库，不执行 SQL。`);
      return;
    }
    pushSqlStatus("error", `AST 语法检查失败：${result.error}`);
  }

  function flashPanel(panel) {
    if (!panel) {
      return;
    }
    panel.classList.remove("attention-flash");
    void panel.offsetWidth;
    panel.classList.add("attention-flash");
  }

  function parseSelectSqlAst(sql) {
    const text = String(sql || "").trim();
    if (!text || text.startsWith("--")) {
      return { ok: false, error: "当前没有可检查的 SQL。" };
    }

    const semicolonCheck = validateStatementSemicolon(text);
    if (!semicolonCheck.ok) {
      return semicolonCheck;
    }

    const body = text.replace(/;\s*$/, "").trim();
    const scan = scanSqlStructure(body);
    if (!scan.ok) {
      return scan;
    }
    const caseCheck = validateCaseExpressionBalance(body);
    if (!caseCheck.ok) {
      return caseCheck;
    }

    if (!/^select\b/i.test(body)) {
      return { ok: false, error: "只支持检查 SELECT 查询。" };
    }

    const clauses = findTopLevelSqlClauses(body);
    const fromClause = clauses.find((clause) => clause.key === "from");
    if (!fromClause) {
      return { ok: false, error: "缺少 FROM 子句。" };
    }

    const invalidOrder = findInvalidClauseOrder(clauses);
    if (invalidOrder) {
      return { ok: false, error: `${invalidOrder} 子句顺序不正确。` };
    }

    const selectBody = body.slice("select".length, fromClause.index).trim();
    if (!selectBody) {
      return { ok: false, error: "SELECT 后没有输出字段。" };
    }

    const ast = {
      type: "select",
      selectItems: splitTopLevel(selectBody, ",").filter(Boolean),
      joins: [],
      hasWhere: clauses.some((clause) => clause.key === "where"),
      groupItems: [],
      having: "",
      orderBy: "",
      limit: "",
      offset: "",
    };

    if (!ast.selectItems.length) {
      return { ok: false, error: "SELECT 字段列表为空。" };
    }

    const fromEnd = getClauseEndIndex(clauses, fromClause);
    const fromBody = body.slice(fromClause.index + fromClause.keyword.length, fromEnd).trim();
    if (!fromBody) {
      return { ok: false, error: "FROM 后没有查询表。" };
    }

    const joinCheck = parseJoinAst(fromBody);
    if (!joinCheck.ok) {
      return joinCheck;
    }
    ast.from = joinCheck.from;
    ast.joins = joinCheck.joins;

    const whereClause = clauses.find((clause) => clause.key === "where");
    if (whereClause) {
      const whereBody = body.slice(whereClause.index + whereClause.keyword.length, getClauseEndIndex(clauses, whereClause)).trim();
      if (!whereBody) {
        return { ok: false, error: "WHERE 后没有过滤条件。" };
      }
      ast.where = whereBody;
    }

    const groupClause = clauses.find((clause) => clause.key === "group");
    if (groupClause) {
      const groupBody = body.slice(groupClause.index + groupClause.keyword.length, getClauseEndIndex(clauses, groupClause)).trim();
      ast.groupItems = splitTopLevel(groupBody, ",").filter(Boolean);
      if (!ast.groupItems.length) {
        return { ok: false, error: "GROUP BY 后没有分组字段。" };
      }
    }

    const havingClause = clauses.find((clause) => clause.key === "having");
    if (havingClause) {
      ast.having = body.slice(havingClause.index + havingClause.keyword.length, getClauseEndIndex(clauses, havingClause)).trim();
      if (!ast.having) {
        return { ok: false, error: "HAVING 后没有过滤条件。" };
      }
    }

    const orderClause = clauses.find((clause) => clause.key === "order");
    if (orderClause) {
      ast.orderBy = body.slice(orderClause.index + orderClause.keyword.length, getClauseEndIndex(clauses, orderClause)).trim();
      if (!ast.orderBy) {
        return { ok: false, error: "ORDER BY 后没有排序字段。" };
      }
    }

    const limitClause = clauses.find((clause) => clause.key === "limit");
    if (limitClause) {
      ast.limit = body.slice(limitClause.index + limitClause.keyword.length, getClauseEndIndex(clauses, limitClause)).trim();
      if (!/^\d+$/i.test(ast.limit)) {
        return { ok: false, error: "LIMIT 只支持正整数。" };
      }
    }

    const offsetClause = clauses.find((clause) => clause.key === "offset");
    if (offsetClause) {
      ast.offset = body.slice(offsetClause.index + offsetClause.keyword.length, getClauseEndIndex(clauses, offsetClause)).trim();
      if (!/^\d+$/i.test(ast.offset)) {
        return { ok: false, error: "OFFSET 只支持大于等于 0 的整数。" };
      }
    }

    return { ok: true, ast };
  }

  function validateStatementSemicolon(sql) {
    let quote = "";
    for (let index = 0; index < sql.length; index += 1) {
      const char = sql[index];
      const prev = sql[index - 1];
      if ((char === "'" || char === '"' || char === "`") && prev !== "\\") {
        quote = quote === char ? "" : quote || char;
      }
      if (!quote && char === ";" && sql.slice(index + 1).trim()) {
        return { ok: false, error: "只允许一条 SQL；分号只能出现在末尾。" };
      }
    }
    return { ok: true };
  }

  function scanSqlStructure(sql) {
    let quote = "";
    let depth = 0;
    for (let index = 0; index < sql.length; index += 1) {
      const char = sql[index];
      const prev = sql[index - 1];
      if ((char === "'" || char === '"' || char === "`") && prev !== "\\") {
        quote = quote === char ? "" : quote || char;
        continue;
      }
      if (quote) {
        continue;
      }
      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
        if (depth < 0) {
          return { ok: false, error: "右括号多于左括号。" };
        }
      }
    }
    if (quote) {
      return { ok: false, error: "字符串或标识符引用没有闭合。" };
    }
    if (depth !== 0) {
      return { ok: false, error: "括号没有闭合。" };
    }
    return { ok: true };
  }

  function validateCaseExpressionBalance(sql) {
    const tokens = tokenizeSqlWords(sql);
    let depth = 0;
    for (const token of tokens) {
      if (token === "case") {
        depth += 1;
      } else if (token === "end") {
        depth -= 1;
        if (depth < 0) {
          return { ok: false, error: "CASE 表达式 END 多于 CASE。" };
        }
      }
    }
    if (depth > 0) {
      return { ok: false, error: "CASE 表达式缺少 END。" };
    }
    return { ok: true };
  }

  function tokenizeSqlWords(sql) {
    const words = [];
    let quote = "";
    let current = "";
    for (let index = 0; index < sql.length; index += 1) {
      const char = sql[index];
      const prev = sql[index - 1];
      if ((char === "'" || char === '"' || char === "`") && prev !== "\\") {
        if (quote === char) {
          quote = "";
        } else if (!quote) {
          quote = char;
        }
        continue;
      }
      if (quote) {
        continue;
      }
      if (/[A-Za-z_]/.test(char)) {
        current += char.toLowerCase();
      } else if (current) {
        words.push(current);
        current = "";
      }
    }
    if (current) {
      words.push(current);
    }
    return words;
  }

  function findTopLevelSqlClauses(sql) {
    const clauseDefs = [
      { key: "from", keyword: "FROM" },
      { key: "where", keyword: "WHERE" },
      { key: "group", keyword: "GROUP BY" },
      { key: "having", keyword: "HAVING" },
      { key: "order", keyword: "ORDER BY" },
      { key: "limit", keyword: "LIMIT" },
      { key: "offset", keyword: "OFFSET" },
    ];
    const clauses = [];
    let quote = "";
    let depth = 0;
    const lowerSql = sql.toLowerCase();

    for (let index = 0; index < sql.length; index += 1) {
      const char = sql[index];
      const prev = sql[index - 1];
      if ((char === "'" || char === '"' || char === "`") && prev !== "\\") {
        quote = quote === char ? "" : quote || char;
      }
      if (quote) {
        continue;
      }
      if (char === "(") {
        depth += 1;
        continue;
      }
      if (char === ")") {
        depth -= 1;
        continue;
      }
      if (depth !== 0) {
        continue;
      }
      const match = clauseDefs.find((clause) => isSqlKeywordAt(lowerSql, clause.keyword.toLowerCase(), index));
      if (match && !clauses.some((clause) => clause.key === match.key)) {
        clauses.push({ ...match, index });
      }
    }

    return clauses.sort((left, right) => left.index - right.index);
  }

  function isSqlKeywordAt(lowerSql, keyword, index) {
    if (!lowerSql.startsWith(keyword, index)) {
      return false;
    }
    const before = lowerSql[index - 1] || " ";
    const after = lowerSql[index + keyword.length] || " ";
    return !/[a-z0-9_]/.test(before) && !/[a-z0-9_]/.test(after);
  }

  function findInvalidClauseOrder(clauses) {
    const order = ["from", "where", "group", "having", "order", "limit", "offset"];
    let last = -1;
    for (const clause of clauses) {
      const current = order.indexOf(clause.key);
      if (current < last) {
        return clause.keyword;
      }
      last = current;
    }
    return "";
  }

  function getClauseEndIndex(clauses, clause) {
    const next = clauses.find((item) => item.index > clause.index);
    return next ? next.index : Number.MAX_SAFE_INTEGER;
  }

  function parseJoinAst(fromBody) {
    const joinRegex = /\b(left|right|inner|full|cross)?\s*join\b/gi;
    const matches = Array.from(fromBody.matchAll(joinRegex));
    if (!matches.length) {
      return { ok: true, from: fromBody.trim(), joins: [] };
    }

    const baseFrom = fromBody.slice(0, matches[0].index).trim();
    if (!baseFrom) {
      return { ok: false, error: "JOIN 前缺少基表。" };
    }

    const joins = [];
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const nextIndex = matches[index + 1]?.index ?? fromBody.length;
      const segment = fromBody.slice(match.index, nextIndex).trim();
      const onIndex = findTopLevelKeywordIndex(segment, "on");
      if (onIndex === -1 && !/^cross\s+join\b/i.test(segment)) {
        return { ok: false, error: `第 ${index + 1} 个 JOIN 缺少 ON 条件。` };
      }
      const tablePart = onIndex === -1 ? segment.replace(/^(left|right|inner|full|cross)?\s*join\b/i, "").trim() : segment.slice(0, onIndex).replace(/^(left|right|inner|full|cross)?\s*join\b/i, "").trim();
      if (!tablePart) {
        return { ok: false, error: `第 ${index + 1} 个 JOIN 缺少右表。` };
      }
      const onPart = onIndex === -1 ? "" : segment.slice(onIndex + 2).trim();
      if (onIndex !== -1 && !onPart) {
        return { ok: false, error: `第 ${index + 1} 个 JOIN 的 ON 条件为空。` };
      }
      joins.push({ table: tablePart, on: onPart });
    }

    return { ok: true, from: baseFrom, joins };
  }

  function findTopLevelKeywordIndex(input, keyword) {
    let quote = "";
    let depth = 0;
    const lowerInput = input.toLowerCase();
    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      const prev = input[index - 1];
      if ((char === "'" || char === '"' || char === "`") && prev !== "\\") {
        quote = quote === char ? "" : quote || char;
      }
      if (quote) {
        continue;
      }
      if (char === "(") {
        depth += 1;
        continue;
      }
      if (char === ")") {
        depth -= 1;
        continue;
      }
      if (depth === 0 && isSqlKeywordAt(lowerInput, keyword.toLowerCase(), index)) {
        return index;
      }
    }
    return -1;
  }

  function describeSqlAst(ast) {
    const parts = [`${ast.selectItems.length} 个输出项`, `${ast.joins.length} 个 JOIN`];
    if (ast.hasWhere) {
      parts.push("包含 WHERE");
    }
    if (ast.groupItems.length) {
      parts.push(`${ast.groupItems.length} 个 GROUP BY 字段`);
    }
    if (ast.having) {
      parts.push("包含 HAVING");
    }
    if (ast.limit) {
      parts.push(`LIMIT ${ast.limit}`);
    }
    if (ast.offset) {
      parts.push(`OFFSET ${ast.offset}`);
    }
    return parts.join(" · ");
  }

  function getCurrentSqlText() {
    return "value" in dom.sqlOutput ? dom.sqlOutput.value || "" : dom.sqlOutput.textContent || "";
  }

  async function handleSavedQueryClick(event) {
    const loadButton = event.target.closest("[data-load-query]");
    const deleteButton = event.target.closest("[data-delete-query]");

    if (loadButton) {
      const name = loadButton.dataset.loadQuery;
      const item = state.savedQueries.find((query) => query.name === name);
      if (!item) {
        return;
      }
      const loaded = importQuerySpec(item.spec);
      if (loaded) {
        render();
        closeTopSavedQueriesMenu();
        pushSqlStatus("info", `已载入查询模板「${name}」。`);
      }
      return;
    }

    if (deleteButton) {
      const name = deleteButton.dataset.deleteQuery;
      state.savedQueries = state.savedQueries.filter((query) => query.name !== name);
      const ok = await persistQueries();
      if (ok) {
        renderSavedQueries();
      }
    }
  }

  function addDimensionFromInput() {
    const raw = dom.dimensionAddInput.value.trim();
    if (!raw) {
      return;
    }

    const match = findFieldMatch(raw);
    if (!match) {
      pushSqlStatus("error", "没有找到匹配的输出字段，请输入字段名；重名字段可选择“字段名（表名）”。");
      return;
    }

    if (!state.selectedDimensions.includes(match.id)) {
      state.selectedDimensions.push(match.id);
    }

    dom.dimensionAddInput.value = "";
    render();
  }

  function normalizeFieldInput(raw, fields) {
    const match = findFieldMatch(raw, fields);
    return match ? match.id : raw.trim();
  }

  function normalizeJoinValue(rowIndex, key, raw) {
    const value = raw.trim();
    if (!value) {
      return "";
    }

    if (key === "leftField") {
      return normalizeColumnInput(state.joins[rowIndex]?.leftTable, value);
    }

    if (key === "rightField") {
      return normalizeColumnInput(state.joins[rowIndex]?.rightTable, value);
    }

    return value;
  }

  function normalizeJoinConditionValue(rowIndex, key, raw) {
    const value = raw.trim();
    if (!value) {
      return "";
    }

    const join = state.joins[rowIndex];
    const tableName = key === "leftField" ? join?.leftTable : join?.rightTable;
    return normalizeColumnInput(tableName, value);
  }

  function normalizeColumnInput(tableName, raw) {
    const value = raw.trim();
    if (!tableName || !value) {
      return value;
    }

    const columns = getColumnsForTable(tableName);
    const exact = columns.find((column) => column.name.toLowerCase() === value.toLowerCase());
    if (exact) {
      return exact.name;
    }

    const fuzzy = columns.find((column) => column.name.toLowerCase().includes(value.toLowerCase()));
    return fuzzy ? fuzzy.name : value;
  }

  function normalizeSortFieldInput(raw) {
    const value = raw.trim();
    if (!value) {
      return "";
    }

    const options = getSortOptions();
    const exact = options.find(
      (option) =>
        option.value.toLowerCase() === value.toLowerCase() ||
        option.label.toLowerCase() === value.toLowerCase()
    );
    if (exact) {
      return exact.value;
    }

    const fuzzy = options.find(
      (option) =>
        option.value.toLowerCase().includes(value.toLowerCase()) ||
        option.label.toLowerCase().includes(value.toLowerCase())
    );
    return fuzzy ? fuzzy.value : value;
  }

  function getSortDisplayValue(value) {
    if (!value) {
      return "";
    }

    const option = getSortOptions().find((item) => item.value === value);
    return option ? option.label : value;
  }

  function findFieldMatch(raw, fields) {
    const normalized = String(raw || "").trim().toLowerCase();
    const shortNormalized = normalizeFieldSearchText(raw);
    const availableFields = fields || getAvailableFields();

    const exact = availableFields.find(
      (field) =>
        field.id.toLowerCase() === normalized ||
        `${field.table}.${field.name}`.toLowerCase() === normalized ||
        getFieldOptionLabel(field, availableFields).toLowerCase() === normalized
    );
    if (exact) {
      return exact;
    }

    const byName = availableFields.filter((field) => field.name.toLowerCase() === shortNormalized);
    if (byName.length) {
      return byName[0];
    }

    return availableFields.find((field) =>
      field.name.toLowerCase().includes(shortNormalized) ||
      `${field.table}.${field.name}`.toLowerCase().includes(shortNormalized) ||
      getFieldOptionLabel(field, availableFields).toLowerCase().includes(normalized)
    ) || null;
  }

  function getActiveModel() {
    return state.models.find((model) => model.id === state.activeModelId) || null;
  }

  function loadActiveModelSchema(options) {
    const { resetBuilder = false, quiet = false } = options || {};
    const activeModel = getActiveModel();

    if (!activeModel) {
      state.schema = { tables: [] };
      resetBuilderState();
      resetSchemaBrowserState();
      if (!quiet) {
        pushSqlStatus("info", "请先保存一个模型。");
      }
      return;
    }

    try {
      state.schema = parseDDL(activeModel.ddl);
      if (resetBuilder) {
        resetBuilderState();
        resetSchemaBrowserState();
        state.baseTable = state.schema.tables[0]?.name || "";
      } else {
        reconcileState();
      }
    } catch (error) {
      state.schema = { tables: [] };
      resetBuilderState();
      resetSchemaBrowserState();
      if (!quiet) {
        pushSqlStatus("error", error.message || `模型「${buildModelLabel(activeModel)}」解析失败。`);
      }
    }
  }

  function resetBuilderState() {
    state.baseTable = "";
    state.joins = [];
    state.template = "detail";
    state.selectedDimensions = [];
    state.metrics = [];
    state.filters = [];
    state.filterConditionOperator = "and";
    state.filterGroupOperator = "and";
    state.havingFilters = [];
    state.havingConditionOperator = "and";
    state.havingGroupOperator = "and";
    state.sort = { field: "", dir: "desc" };
    state.limit = "100";
    state.offset = "";
  }

  function resetSchemaBrowserState() {
    state.schemaTableSearch = "";
    state.schemaColumnSearch = "";
    state.schemaActiveTable = state.schema.tables[0]?.name || "";
  }

  function render() {
    reconcileState();
    syncDraftInputs();
    renderModelSelect();
    renderSchemaSummary();
    renderBaseTableSelect();
    renderTemplateStrip();
    renderJoins();
    renderDimensionPicker();
    renderMetrics();
    renderFilters();
    renderHavingFilters();
    renderSortControls();
    renderPreview();
    renderSavedQueries();
    renderDictionary();
    renderConfigTabs();
  }

  function renderConfigTabs() {
    const activeTab = state.activeConfigTab || "model";
    dom.configTabButtons.forEach((button) => {
      const isActive = button.dataset.configTab === activeTab;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });
    dom.configTabPanels.forEach((panel) => {
      const isActive = panel.dataset.tabPanel === activeTab;
      panel.classList.toggle("active", isActive);
      panel.hidden = !isActive;
    });
  }

  function syncDraftInputs() {
    dom.modelEnvInput.value = state.modelDraftEnv;
    dom.modelTableNameInput.value = state.modelDraftTableName;
    dom.modelDdlInput.value = state.modelDraftDdl;
    const canUpdateActiveModel =
      Boolean(state.editingModelId && state.editingModelId === state.activeModelId && getActiveModel());
    dom.updateActiveModelButton.disabled = !canUpdateActiveModel;
    dom.schemaTableSearchInput.value = state.schemaTableSearch;
    dom.schemaColumnSearchInput.value = state.schemaColumnSearch;
    dom.limitInput.value = state.limit;
    dom.llmProviderSelect.value = state.llmConfig.provider;
    dom.llmBaseUrlInput.value = state.llmConfig.baseUrl;
    dom.llmModelInput.value = state.llmConfig.model;
    dom.llmApiKeyEnvInput.value = state.llmConfig.apiKeyEnv;
    dom.llmReasoningEffortSelect.value = state.llmConfig.reasoningEffort;
    dom.llmTemperatureInput.value = state.llmConfig.temperature;
    dom.aiPromptInput.value = state.aiPrompt;
    dom.generateAiSqlButton.disabled = state.aiLoading;
    dom.generateAiSqlButton.textContent = state.aiLoading ? "AI 生成中..." : "AI 生成 SQL";
    dom.saveLlmConfigButton.disabled = state.aiLoading;
    dom.refreshCodexStatusButton.disabled = state.aiLoading;
    renderAiConfigState();
  }

  function renderAiConfigState() {
    const isCodexProvider = state.llmConfig.provider === "codex_cli";
    dom.llmBaseUrlInput.disabled = isCodexProvider;
    dom.llmApiKeyEnvInput.disabled = isCodexProvider;
    dom.llmTemperatureInput.disabled = isCodexProvider;
    dom.llmModelInput.placeholder = isCodexProvider
      ? "留空则使用本机 Codex 默认模型，例如 gpt-5.4"
      : "例如：gpt-5.4-mini";

    if (isCodexProvider) {
      dom.llmBaseUrlInput.placeholder = "Codex 登录态模式下不使用接口地址";
      dom.llmApiKeyEnvInput.placeholder = "Codex 登录态模式下不使用 API Key";
      dom.llmTemperatureInput.placeholder = "Codex 登录态模式下忽略温度";
    } else {
      dom.llmBaseUrlInput.placeholder = "https://api.openai.com/v1";
      dom.llmApiKeyEnvInput.placeholder = "OPENAI_API_KEY";
      dom.llmTemperatureInput.placeholder = "";
    }

    dom.refreshCodexStatusButton.hidden = !isCodexProvider;

    const statusText = isCodexProvider
      ? state.codexLoginStatus.statusMessage || "Codex 登录状态未检查"
      : `当前为 OpenAI / 兼容接口模式，读取环境变量 ${state.llmConfig.apiKeyEnv}`;
    dom.codexLoginStatus.textContent = statusText;
    dom.codexLoginStatus.className =
      isCodexProvider && state.codexLoginStatus.configured ? "status-chip" : "status-chip muted";
  }

  function reconcileState() {
    const availableTableNames = new Set(state.schema.tables.map((table) => table.name));
    if (!availableTableNames.has(state.baseTable)) {
      state.baseTable = state.schema.tables[0]?.name || "";
    }

    state.joins = state.joins
      .map(normalizeJoinConfig)
      .filter((join) => !join.leftTable || availableTableNames.has(join.leftTable))
      .filter((join) => !join.rightTable || availableTableNames.has(join.rightTable));

    const availableFields = getAvailableFields();
    const availableFieldIds = new Set(availableFields.map((field) => field.id));

    state.selectedDimensions = state.selectedDimensions.filter((fieldId) =>
      availableFieldIds.has(fieldId)
    );

    state.metrics = state.metrics
      .map((metric) => ({
        field: metric.field || "",
        func: AGGREGATIONS.includes(metric.func) ? metric.func : "sum",
        alias: metric.alias || "",
      }))
      .filter((metric) => !metric.field || availableFieldIds.has(metric.field));

    state.filters = state.filters
      .map((filter) => ({
        field: filter.field || "",
        operator: OPERATORS.some((item) => item.value === filter.operator)
          ? filter.operator
          : "=",
        value: filter.value || "",
        valueTo: filter.valueTo || "",
        groupId: normalizeGroupId(filter.groupId),
      }))
      .filter((filter) => !filter.field || availableFieldIds.has(filter.field));

    const havingFieldIds = new Set(getHavingFields().map((field) => field.id));
    state.havingFilters = state.havingFilters
      .map((filter) => ({
        field: filter.field || "",
        operator: OPERATORS.some((item) => item.value === filter.operator)
          ? filter.operator
          : "=",
        value: filter.value || "",
        valueTo: filter.valueTo || "",
        groupId: normalizeGroupId(filter.groupId),
      }))
      .filter((filter) => !filter.field || havingFieldIds.has(filter.field));

    state.filterConditionOperator = normalizeLogicalOperator(state.filterConditionOperator);
    state.filterGroupOperator = normalizeLogicalOperator(state.filterGroupOperator);
    state.havingConditionOperator = normalizeLogicalOperator(state.havingConditionOperator);
    state.havingGroupOperator = normalizeLogicalOperator(state.havingGroupOperator);
    state.sqlDialect = normalizeSqlDialect(state.sqlDialect);
    state.sqlStrictMode = state.sqlStrictMode !== false;
    if (!Number.isFinite(Number(state.offset)) || Number(state.offset) < 0) {
      state.offset = "";
    }

    const sortOptions = getSortOptions();
    if (!sortOptions.some((option) => option.value === state.sort.field)) {
      state.sort.field = "";
    }
  }

  function renderModelSelect() {
    if (!state.models.length) {
      dom.modelSelect.innerHTML = `<option value="">暂无模型</option>`;
      return;
    }

    dom.modelSelect.innerHTML = renderModelSelectOptions();
  }

  function renderModelSelectOptions() {
    const groups = buildModelSelectGroups(state.models);
    return groups
      .map(
        (group) => `
          <optgroup label="${escapeAttr(group.label)}">
            ${group.models.map(renderModelOption).join("")}
          </optgroup>
        `
      )
      .join("");
  }

  function renderModelOption(model) {
    const counts = safeCountTables(model.ddl);
    const suffix = counts.tableCount ? `（${counts.tableCount} 表）` : "";
    const pathParts = splitModelPath(model.tableName);
    const depth = Math.max(0, pathParts.length - 1);
    const prefix = depth ? `${"　".repeat(depth)}└ ` : "";
    const label = `${prefix}${getModelDisplayName(model)}${suffix}`;
    return `<option value="${escapeAttr(model.id)}" ${
      model.id === state.activeModelId ? "selected" : ""
    }>${escapeHtml(label)}</option>`;
  }

  function buildModelSelectGroups(models) {
    const groups = new Map();
    [...models]
      .sort((left, right) => buildModelLabel(left).localeCompare(buildModelLabel(right), "zh-CN"))
      .forEach((model) => {
        const env = String(model.env || "default").trim() || "default";
        const parts = splitModelPath(model.tableName);
        const folders = parts.length > 1 ? parts.slice(0, -1).join(" / ") : "未分组";
        const label = `${env} / ${folders}`;
        if (!groups.has(label)) {
          groups.set(label, { label, models: [] });
        }
        groups.get(label).models.push(model);
      });
    return Array.from(groups.values());
  }

  function renderSchemaSummary() {
    const tables = state.schema.tables;
    const tableCount = tables.length;
    const columnCount = tables.reduce((total, table) => total + table.columns.length, 0);
    const activeModel = getActiveModel();

    if (!activeModel || !tableCount) {
      dom.schemaSummary.className = "schema-summary empty-state";
      dom.schemaSummary.textContent = "先选择一个模型，再用搜索方式查看表和字段。";
      dom.modelStatus.textContent = "未加载模型";
      dom.modelStatus.className = "status-chip muted";
      dom.schemaTableOptions.innerHTML = "";
      dom.schemaColumnOptions.innerHTML = "";
      return;
    }

    const matchingTables = getMatchingSchemaTables();
    const activeTable = resolveSchemaActiveTable(matchingTables);
    const matchedColumns = getMatchingColumns(activeTable);
    const visibleColumns = matchedColumns.slice(0, 40);

    state.schemaActiveTable = activeTable?.name || "";
    if (activeTable && !state.schemaTableSearch.trim()) {
      dom.schemaTableSearchInput.placeholder = `当前表：${activeTable.name}`;
    }

    dom.modelStatus.textContent = `${activeModel.env} 环境 · ${getModelDisplayName(activeModel)} · ${tableCount} 张表 · ${columnCount} 个字段`;
    dom.modelStatus.className = "status-chip";
    dom.schemaSummary.className = "schema-summary";
    dom.schemaTableOptions.innerHTML = matchingTables
      .slice(0, 100)
      .map((table) => `<option value="${escapeAttr(table.name)}"></option>`)
      .join("");
    dom.schemaColumnOptions.innerHTML = activeTable
      ? activeTable.columns
          .filter((column) => {
            const query = state.schemaColumnSearch.trim().toLowerCase();
            if (!query) {
              return true;
            }
            return (
              column.name.toLowerCase().includes(query) ||
              column.type.toLowerCase().includes(query)
            );
          })
          .slice(0, 100)
          .map((column) => `<option value="${escapeAttr(column.name)}"></option>`)
          .join("")
      : "";

    if (!matchingTables.length) {
      dom.schemaSummary.className = "schema-summary empty-state";
      dom.schemaSummary.textContent = "没有匹配当前表搜索条件的表，请换个关键词试试。";
      return;
    }

    if (!activeTable) {
      dom.schemaSummary.className = "schema-summary empty-state";
      dom.schemaSummary.textContent = "请选择一个匹配的表，再继续查看字段。";
      return;
    }

    dom.schemaSummary.innerHTML = `
      <article class="schema-card">
        <h3>${escapeHtml(activeTable.name)}</h3>
        <div class="summary-grid compact">
          <article class="summary-card">
            <h3>匹配表数</h3>
            <p>${matchingTables.length} / ${tableCount}</p>
          </article>
          <article class="summary-card">
            <h3>当前表字段数</h3>
            <p>${activeTable.columns.length} 个</p>
          </article>
        </div>
        <div class="schema-columns">
          ${visibleColumns
            .map(
              (column) => `
                <span class="column-pill">
                  <code>${escapeHtml(column.name)}</code> · ${escapeHtml(column.type)}${
                    column.partition ? " · 分区" : ""
                  }${column.comment ? ` · ${escapeHtml(column.comment)}` : ""}
                </span>
              `
            )
            .join("")}
        </div>
        <p class="tiny-note">
          ${
            state.schemaColumnSearch.trim()
              ? `字段搜索后匹配 ${matchedColumns.length} 个，当前展示 ${visibleColumns.length} 个。`
              : `当前仅展示前 ${visibleColumns.length} 个字段；字段很多时请继续用上方搜索框缩小范围。`
          }
        </p>
      </article>
    `;
  }

  function updateSchemaActiveTableFromSearch() {
    const tables = getMatchingSchemaTables();
    const exact = state.schema.tables.find(
      (table) => table.name.toLowerCase() === state.schemaTableSearch.trim().toLowerCase()
    );

    if (exact) {
      state.schemaActiveTable = exact.name;
      return;
    }

    if (!state.schemaTableSearch.trim()) {
      state.schemaActiveTable = state.schema.tables[0]?.name || "";
      return;
    }

    state.schemaActiveTable = tables[0]?.name || "";
  }

  function getMatchingSchemaTables() {
    const query = state.schemaTableSearch.trim().toLowerCase();
    if (!query) {
      return state.schema.tables;
    }

    return state.schema.tables.filter(
      (table) =>
        table.name.toLowerCase().includes(query) ||
        table.columns.some((column) => column.name.toLowerCase().includes(query))
    );
  }

  function resolveSchemaActiveTable(matchingTables) {
    if (state.schemaActiveTable) {
      const matchedActive = matchingTables.find((table) => table.name === state.schemaActiveTable);
      if (matchedActive) {
        return matchedActive;
      }
    }
    return matchingTables[0] || null;
  }

  function getMatchingColumns(table) {
    if (!table) {
      return [];
    }

    const query = state.schemaColumnSearch.trim().toLowerCase();
    if (!query) {
      return table.columns;
    }

    return table.columns.filter(
      (column) =>
        column.name.toLowerCase().includes(query) ||
        column.type.toLowerCase().includes(query)
    );
  }

  function renderBaseTableSelect() {
    const tables = state.schema.tables;
    dom.baseTableSelect.innerHTML =
      `<option value="">请选择基表</option>` +
      tables
        .map(
          (table) => `
            <option value="${escapeAttr(table.name)}" ${
              table.name === state.baseTable ? "selected" : ""
            }>
              ${escapeHtml(table.name)}
            </option>
          `
        )
        .join("");
  }

  function renderTemplateStrip() {
    dom.templateStrip.innerHTML = Object.entries(TEMPLATE_META)
      .map(
        ([key, value]) => `
          <button class="template-card ${state.template === key ? "active" : ""}" data-template="${key}">
            <strong>${escapeHtml(value.title)}</strong>
            <span>${escapeHtml(value.description)}</span>
          </button>
        `
      )
      .join("");
  }

  function renderJoins() {
    if (!state.baseTable) {
      dom.joinsList.className = "rows-list empty-state";
      dom.joinsList.textContent = "先选择基表，再按需添加 Join。";
      return;
    }

    if (!state.joins.length) {
      dom.joinsList.className = "rows-list empty-state";
      dom.joinsList.textContent = "当前没有 Join。如果查询只用一张表，可以跳过这里。";
      return;
    }

    dom.joinsList.className = "rows-list";
    dom.joinsList.innerHTML = state.joins
      .map((join, index) => {
        const leftTableOptions = getJoinLeftTableOptions(index);
        const rightTableOptions = getJoinRightTableOptions(index);
        const conditions = getJoinConditions(join);
        return `
          <div class="row-card join-row">
            <div class="join-row-head">
              <strong>关联 ${index + 1}</strong>
              <button class="icon-button" data-remove-row="joins" data-index="${index}">删除</button>
            </div>
            <div class="join-grid">
              ${renderSelectField({
                label: "Join 类型",
                value: join.joinType,
                dataField: "joinType",
                index,
                options: [
                  { value: "inner", label: "INNER" },
                  { value: "left", label: "LEFT" },
                  { value: "right", label: "RIGHT" },
                ],
                type: "join",
              })}
              ${renderSelectField({
                label: "组内关系",
                value: join.conditionOperator || "and",
                dataField: "conditionOperator",
                index,
                options: [
                  { value: "and", label: "AND" },
                  { value: "or", label: "OR" },
                ],
                type: "join",
              })}
              ${renderSelectField({
                label: "组间关系",
                value: join.conditionGroupOperator || "and",
                dataField: "conditionGroupOperator",
                index,
                options: [
                  { value: "and", label: "AND" },
                  { value: "or", label: "OR" },
                ],
                type: "join",
              })}
              ${renderSelectField({
                label: "左表",
                value: join.leftTable,
                dataField: "leftTable",
                index,
                options: leftTableOptions.map((value) => ({ value, label: value })),
                type: "join",
              })}
              ${renderSelectField({
                label: "右表",
                value: join.rightTable,
                dataField: "rightTable",
                index,
                options: rightTableOptions.map((value) => ({ value, label: value })),
                type: "join",
              })}
            </div>
            <div class="join-condition-list">
              ${renderJoinConditionGroups(join, conditions, index)}
            </div>
            <div class="inline-actions">
              <button data-add-join-condition data-index="${index}" data-group-id="${escapeAttr(getLastJoinGroupId(join))}">当前组新增条件</button>
              <button data-add-join-condition-group data-index="${index}">新增条件组</button>
            </div>
            <label class="field join-preview-field">
              <span>Join 预览</span>
              <input value="${escapeAttr(buildJoinPreview(join))}" readonly />
            </label>
          </div>
        `;
      })
      .join("");
  }

  function renderJoinConditionGroups(join, conditions, joinIndex) {
    return groupIndexedConditions(conditions)
      .map(
        (group, groupIndex) => `
          <div class="condition-group">
            <div class="condition-group-head">
              <strong>条件组 ${groupIndex + 1}</strong>
              <span>组内 ${escapeHtml((join.conditionOperator || "and").toUpperCase())}</span>
            </div>
            ${group.items
              .map(
                ({ item: condition, index: conditionIndex }) => `
                  <div class="join-condition-row">
                    <span class="join-condition-index">条件 ${conditionIndex + 1}</span>
                    ${renderJoinConditionInputField({
                      label: "左字段",
                      value: condition.leftField,
                      dataField: "leftField",
                      index: joinIndex,
                      conditionIndex,
                      tableName: join.leftTable,
                      options: getColumnsForTable(join.leftTable).map((column) => column.name),
                      placeholder: "输入左表字段",
                      listId: `join-left-field-options-${joinIndex}-${conditionIndex}`,
                    })}
                    ${renderJoinConditionInputField({
                      label: "右字段",
                      value: condition.rightField,
                      dataField: "rightField",
                      index: joinIndex,
                      conditionIndex,
                      tableName: join.rightTable,
                      options: getColumnsForTable(join.rightTable).map((column) => column.name),
                      placeholder: "输入右表字段",
                      listId: `join-right-field-options-${joinIndex}-${conditionIndex}`,
                    })}
                    <button
                      class="icon-button"
                      data-remove-join-condition
                      data-index="${joinIndex}"
                      data-condition-index="${conditionIndex}"
                    >删除条件</button>
                  </div>
                `
              )
              .join("")}
            <div class="inline-actions">
              <button data-add-join-condition data-index="${joinIndex}" data-group-id="${escapeAttr(group.id)}">本组新增条件</button>
            </div>
          </div>
        `
      )
      .join("");
  }

  function renderDimensionPicker() {
    const availableFields = getAvailableFields();
    const query = dom.dimensionAddInput.value.trim();

    renderDimensionFieldOptions(dom.dimensionAddInput.value);

    if (!availableFields.length) {
      dom.selectedDimensionsList.className = "selected-list empty-state";
      dom.selectedDimensionsList.textContent = "请先选择基表或补充 Join。";
      return;
    }

    const selectedFields = state.selectedDimensions.map((fieldId) => getFieldById(fieldId)).filter(Boolean);
    const visibleFields = query
      ? availableFields
          .filter((field) => getFieldOptionLabel(field, availableFields).toLowerCase().includes(query.toLowerCase()))
          .slice(0, 60)
      : selectedFields;

    if (!visibleFields.length) {
      dom.selectedDimensionsList.className = "selected-list empty-state";
      dom.selectedDimensionsList.textContent = state.selectedDimensions.length
        ? "已选择的字段当前不可用。"
        : "未选择输出字段，默认 SELECT *。输入字段名后可搜索添加。";
      return;
    }

    dom.selectedDimensionsList.className = "selected-list field-picker-panel";
    dom.selectedDimensionsList.innerHTML = `
      <div class="selected-dimension-summary">
        <span>${
          state.selectedDimensions.length
            ? `已选择 ${state.selectedDimensions.length} 个字段`
            : "未选择字段，默认查询全部字段（SELECT *）"
        }</span>
        <span>${query ? "搜索结果，点击字段 Tag 可选择 / 取消" : "仅展示已选字段；搜索后显示候选字段"}</span>
      </div>
      <div class="field-tag-cloud">
        ${visibleFields.map(renderDimensionTag).join("")}
      </div>
    `;
  }

  function renderDimensionTag(field) {
    const selected = state.selectedDimensions.includes(field.id);
    return `
      <button
        type="button"
        class="field-tag ${selected ? "selected" : ""}"
        data-toggle-dimension="${escapeAttr(field.id)}"
        title="${escapeAttr(`${field.table}.${field.name}`)}"
      >
        <span>${escapeHtml(field.name)}</span>
        <code>${escapeHtml(field.type)}</code>
        ${field.partition ? `<em>分区</em>` : ""}
      </button>
    `;
  }

  function renderDimensionFieldOptions(query) {
    const availableFields = getAvailableFields();
    const selectableFields = availableFields.filter(
      (field) => !state.selectedDimensions.includes(field.id)
    );
    dom.dimensionFieldOptions.innerHTML = renderOptionValues(
      getFieldSuggestionLabels(query, selectableFields)
    );
  }

  function renderMetrics() {
    const availableFields = getAvailableFields();
    const metricsSupported = state.template !== "detail";

    if (!metricsSupported && !state.metrics.length) {
      dom.metricsList.className = "rows-list empty-state";
      dom.metricsList.textContent = "明细查询可以不加指标；切换到聚合查询或 Top N 再添加。";
      return;
    }

    if (!state.metrics.length) {
      dom.metricsList.className = "rows-list empty-state";
      dom.metricsList.textContent = "还没有指标，点“新增指标”开始配置。";
      return;
    }

    dom.metricsList.className = "rows-list";
    dom.metricsList.innerHTML = state.metrics
      .map(
        (metric, index) => `
          <div class="row-card">
            ${renderSearchInputField({
              label: "字段",
              value: getFieldDisplayValue(metric.field),
              dataField: "field",
              index,
              options: getFieldSuggestionLabels(getFieldDisplayValue(metric.field), availableFields),
              placeholder: "输入字段名",
              type: "metric",
              listId: `metric-field-options-${index}`,
            })}
            ${renderSelectField({
              label: "函数",
              value: metric.func,
              dataField: "func",
              index,
              options: AGGREGATIONS.map((value) => ({ value, label: value.toUpperCase() })),
              type: "metric",
            })}
            <label class="field">
              <span>别名</span>
              <input
                type="text"
                data-metric-field="alias"
                data-index="${index}"
                value="${escapeAttr(metric.alias)}"
                placeholder="${escapeAttr(defaultMetricAlias(metric))}"
              />
            </label>
            <label class="field">
              <span>表达式预览</span>
              <input value="${escapeAttr(previewMetric(metric))}" readonly />
            </label>
            <label class="field">
              <span>字段类型</span>
              <input value="${escapeAttr(getFieldById(metric.field)?.kind || "")}" readonly />
            </label>
            <button class="icon-button" data-remove-row="metrics" data-index="${index}">删除</button>
          </div>
        `
      )
      .join("");
  }

  function renderFilters() {
    const availableFields = getAvailableFields();

    if (!state.filters.length) {
      dom.filtersList.className = "rows-list empty-state";
      dom.filtersList.textContent = "还没有过滤条件，点“新增过滤条件”开始配置。";
      return;
    }

    dom.filtersList.className = "rows-list";
    dom.filtersList.innerHTML = `
      <div class="condition-toolbar">
        ${renderFilterConfigSelect({
          label: "组内关系",
          dataField: "conditionOperator",
          value: state.filterConditionOperator,
        })}
        ${renderFilterConfigSelect({
          label: "组间关系",
          dataField: "groupOperator",
          value: state.filterGroupOperator,
        })}
      </div>
      ${groupIndexedConditions(state.filters)
        .map((group, groupIndex) => renderFilterGroup(group, groupIndex, availableFields, "where"))
        .join("")}
    `;
  }

  function renderHavingFilters() {
    const availableFields = getHavingFields();

    if (state.template === "detail") {
      dom.havingFiltersList.className = "rows-list empty-state";
      dom.havingFiltersList.textContent = "HAVING 仅用于聚合查询；明细查询请使用 WHERE。";
      return;
    }

    if (!state.havingFilters.length) {
      dom.havingFiltersList.className = "rows-list empty-state";
      dom.havingFiltersList.textContent = "还没有 HAVING 条件，点“新增 Having 条件”开始配置。";
      return;
    }

    dom.havingFiltersList.className = "rows-list";
    dom.havingFiltersList.innerHTML = `
      <div class="condition-toolbar">
        ${renderFilterConfigSelect({
          label: "组内关系",
          dataField: "conditionOperator",
          value: state.havingConditionOperator,
          scope: "having",
        })}
        ${renderFilterConfigSelect({
          label: "组间关系",
          dataField: "groupOperator",
          value: state.havingGroupOperator,
          scope: "having",
        })}
      </div>
      ${groupIndexedConditions(state.havingFilters)
        .map((group, groupIndex) => renderFilterGroup(group, groupIndex, availableFields, "having"))
        .join("")}
    `;
  }

  function renderFilterGroup(group, groupIndex, availableFields, scope) {
    const conditionOperator =
      scope === "having" ? state.havingConditionOperator : state.filterConditionOperator;
    return `
      <div class="condition-group">
        <div class="condition-group-head">
          <strong>条件组 ${groupIndex + 1}</strong>
          <span>组内 ${escapeHtml(conditionOperator.toUpperCase())}</span>
        </div>
        ${group.items
          .map(({ item: filter, index }) => renderFilterRow(filter, index, availableFields, scope))
          .join("")}
        <div class="inline-actions">
          <button data-add-filter-to-group data-filter-scope="${escapeAttr(scope)}" data-group-id="${escapeAttr(group.id)}">本组新增条件</button>
        </div>
      </div>
    `;
  }

  function renderFilterRow(filter, index, availableFields, scope) {
    const needsSecondValue = filter.operator === "between";
    const skipsValue = filter.operator === "is_null" || filter.operator === "is_not_null";
    return `
      <div class="row-card filter-row">
        ${renderSearchInputField({
          label: "字段",
          value: getFieldDisplayValue(filter.field),
          dataField: "field",
          index,
          options: getFieldSuggestionLabels(getFieldDisplayValue(filter.field), availableFields),
          placeholder: "输入字段名",
          type: "filter",
          listId: `${scope}-filter-field-options-${index}`,
          quickFields: availableFields,
          selectedFieldId: filter.field,
          scope,
        })}
        ${renderSelectField({
          label: "操作符",
          value: filter.operator,
          dataField: "operator",
          index,
          scope,
          options: OPERATORS.map((operator) => ({
            value: operator.value,
            label: operator.label,
          })),
          type: "filter",
        })}
        <label class="field">
          <span>值</span>
          <input
            type="text"
            data-filter-field="value"
            data-filter-scope="${escapeAttr(scope)}"
            data-index="${index}"
            value="${escapeAttr(filter.value)}"
            placeholder="${skipsValue ? "该操作符无需输入值" : "例如：paid, 100, 2026-04-01"}"
            ${skipsValue ? "disabled" : ""}
          />
        </label>
        <label class="field">
          <span>${needsSecondValue ? "结束值" : "字段类型"}</span>
          ${
            needsSecondValue
              ? `<input
                  type="text"
                  data-filter-field="valueTo"
                  data-filter-scope="${escapeAttr(scope)}"
                  data-index="${index}"
                  value="${escapeAttr(filter.valueTo)}"
                  placeholder="例如：2026-04-30"
                />`
              : `<input value="${escapeAttr(getFilterFieldKind(filter.field, availableFields))}" readonly />`
          }
        </label>
        <button class="icon-button" data-remove-row="${scope === "having" ? "havingFilters" : "filters"}" data-index="${index}">删除</button>
      </div>
    `;
  }

  function renderFilterConfigSelect(config) {
    return `
      <label class="field">
        <span>${escapeHtml(config.label)}</span>
        <select data-filter-config="${escapeAttr(config.dataField)}" data-filter-scope="${escapeAttr(config.scope || "where")}">
          <option value="and" ${config.value === "and" ? "selected" : ""}>AND</option>
          <option value="or" ${config.value === "or" ? "selected" : ""}>OR</option>
        </select>
      </label>
    `;
  }

  function getFilterFieldKind(fieldId, availableFields) {
    return (availableFields || []).find((field) => field.id === fieldId)?.kind || getFieldById(fieldId)?.kind || "";
  }

  function renderSortControls() {
    const sortOptions = getSortOptions();
    dom.sortFieldOptions.innerHTML = sortOptions
      .map((option) => `<option value="${escapeAttr(option.label)}"></option>`)
      .join("");
    dom.sortFieldInput.value = getSortDisplayValue(state.sort.field);
    dom.sortDirectionSelect.value = state.sort.dir;
    dom.limitInput.value = state.limit;
    dom.offsetInput.value = state.offset;
    dom.sqlDialectSelect.value = normalizeSqlDialect(state.sqlDialect);
    dom.sqlStrictModeInput.checked = Boolean(state.sqlStrictMode);
  }

  function renderPreview() {
    const manualResult = renderSQL({
      schema: state.schema,
      baseTable: state.baseTable,
      joins: state.joins,
      template: state.template,
      dimensions: state.selectedDimensions,
      metrics: state.metrics,
      filters: state.filters,
      filterConditionOperator: state.filterConditionOperator,
      filterGroupOperator: state.filterGroupOperator,
      havingFilters: state.havingFilters,
      havingConditionOperator: state.havingConditionOperator,
      havingGroupOperator: state.havingGroupOperator,
      sort: state.sort,
      limit: state.limit,
      offset: state.offset,
      sqlDialect: state.sqlDialect,
      sqlStrictMode: state.sqlStrictMode,
    });
    const aiResult = getRenderableAiResult();

    if (aiResult) {
      setSqlEditorValue(aiResult.sql, `ai:${aiResult.generatedAt || aiResult.title || ""}`);
      dom.querySummary.innerHTML = buildPreviewMeta([
        aiResult.modelName || buildModelLabel(getActiveModel()) || "未选择模型",
        `AI · ${describeProvider(aiResult.llmProvider || state.llmConfig.provider)} · ${aiResult.llmModel || state.llmConfig.model}`,
        aiResult.title || "AI SQL 结果",
        aiResult.assumptions?.length
          ? `假设：${shortenText(aiResult.assumptions.join("；"), 96)}`
          : "无额外假设",
      ]);
      renderSqlStatus(buildAiStatusMessages(aiResult));
      dom.aiResultStatus.textContent = `当前显示 AI 生成结果 · ${describeProvider(aiResult.llmProvider || state.llmConfig.provider)} · ${aiResult.llmModel || state.llmConfig.model}`;
      dom.aiResultStatus.className = "status-chip";
      return;
    }

    setSqlEditorValue(manualResult.sql, buildManualSqlSourceKey(manualResult.sql));
    dom.querySummary.innerHTML = buildPreviewMeta([
      buildModelLabel(getActiveModel()) || "未选择模型",
      `${shortenText(state.baseTable || "未选择基表", 42)} · ${manualResult.resolvedJoins.length} Join`,
      `${templateTitle(state.template)} · ${describeSelectedDimensions()} · ${state.metrics.length} 指标`,
      `${describeSqlDialect(state.sqlDialect)}${state.sqlStrictMode ? " · 严格" : ""}`,
    ]);

    renderSqlStatus(manualResult.messages);
    dom.aiResultStatus.textContent = state.aiLoading ? "AI 生成中..." : "当前显示手动生成结果";
    dom.aiResultStatus.className = state.aiLoading ? "status-chip" : "status-chip muted";
  }

  function setSqlEditorValue(sql, sourceKey) {
    const nextSource = String(sourceKey || "");
    if (state.sqlDraftSource !== nextSource) {
      state.sqlDraft = sql;
      state.sqlDraftSource = nextSource;
    }
    if (dom.sqlOutput.value !== state.sqlDraft) {
      dom.sqlOutput.value = state.sqlDraft;
    }
  }

  function buildManualSqlSourceKey(sql) {
    return `manual:${hashText(sql)}`;
  }

  function hashText(text) {
    let hash = 0;
    const value = String(text || "");
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash.toString(16);
  }

  function renderSavedQueries() {
    if (!state.savedQueries.length) {
      dom.savedQueriesList.className = "saved-list empty-state";
      dom.savedQueriesList.textContent = "保存后的查询模板会显示在这里。";
      renderTopSavedQueriesMenu();
      return;
    }

    dom.savedQueriesList.className = "saved-list";
    dom.savedQueriesList.innerHTML = renderSavedQueryTree({ includeActions: true });
    renderTopSavedQueriesMenu();
  }

  function renderTopSavedQueriesMenu() {
    if (!dom.topSavedQueriesMenu) {
      return;
    }
    dom.topSavedQueriesMenu.innerHTML = state.savedQueries.length
      ? renderSavedQueryTree({ compact: true })
      : `<div class="template-menu-empty">还没有保存的模版</div>`;
  }

  function renderSavedQueryTree(options = {}) {
    const tree = buildSavedQueryTree(state.savedQueries);
    return `
      <div class="template-tree ${options.compact ? "compact" : ""}">
        ${renderSavedQueryTreeNodes(tree.children, options)}
      </div>
    `;
  }

  function renderSavedQueryTreeNodes(nodes, options, depth = 0) {
    return nodes
      .map((node) => {
        if (node.type === "folder") {
          return `
            <details class="template-folder" open>
              <summary style="--depth:${depth}">
                <span class="folder-caret">▾</span>
                <span>${escapeHtml(node.name)}</span>
              </summary>
              ${renderSavedQueryTreeNodes(node.children, options, depth + 1)}
            </details>
          `;
        }
        const item = node.query;
        return `
          <div class="template-leaf ${options.compact ? "compact" : ""}" style="--depth:${depth}">
            <button class="template-load" data-load-query="${escapeAttr(item.name)}" title="${escapeAttr(item.name)}">
              <strong>${escapeHtml(getQueryDisplayName(item.name))}</strong>
              ${options.compact ? "" : `<span>${escapeHtml(describeSavedQuery(item.spec))}</span>`}
            </button>
            ${
              options.includeActions
                ? `<button class="template-delete" data-delete-query="${escapeAttr(item.name)}">删除</button>`
                : ""
            }
          </div>
        `;
      })
      .join("");
  }

  function buildSavedQueryTree(queries) {
    const root = { children: [] };
    const folderMap = new Map();
    const sortedQueries = [...queries].sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));

    sortedQueries.forEach((query) => {
      const parts = splitQueryPath(query.name);
      const folderParts = parts.length > 1 ? parts.slice(0, -1) : ["未分组"];
      let current = root;
      let path = "";

      folderParts.forEach((part) => {
        path = path ? `${path}/${part}` : part;
        if (!folderMap.has(path)) {
          const folder = { type: "folder", name: part, children: [] };
          folderMap.set(path, folder);
          current.children.push(folder);
        }
        current = folderMap.get(path);
      });

      current.children.push({ type: "query", name: parts[parts.length - 1], query });
    });

    return root;
  }

  function splitQueryPath(name) {
    return String(name || "")
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function getQueryDisplayName(name) {
    const parts = splitQueryPath(name);
    return parts[parts.length - 1] || name || "未命名模版";
  }

  function renderSqlStatus(messages) {
    dom.sqlStatus.innerHTML = messages
      .map(
        (message) => `
          <div class="status-item ${escapeAttr(message.level)}">${escapeHtml(message.text)}</div>
        `
      )
      .join("");
  }

  function pushSqlStatus(level, text) {
    if (!dom.sqlStatus) {
      return;
    }
    const current = Array.from(dom.sqlStatus.querySelectorAll(".status-item")).map((node) => ({
      level: ["error", "warning", "success"].find((level) => node.classList.contains(level)) || "info",
      text: node.textContent || "",
    }));
    current.unshift({ level, text });
    renderSqlStatus(current.slice(0, 4));
  }

  function exportQuerySpec() {
    return {
      activeModelId: state.activeModelId,
      baseTable: state.baseTable,
      joins: clone(state.joins),
      template: state.template,
      dimensions: clone(state.selectedDimensions),
      metrics: clone(state.metrics),
      filters: clone(state.filters),
      filterConditionOperator: state.filterConditionOperator,
      filterGroupOperator: state.filterGroupOperator,
      havingFilters: clone(state.havingFilters),
      havingConditionOperator: state.havingConditionOperator,
      havingGroupOperator: state.havingGroupOperator,
      sort: clone(state.sort),
      limit: state.limit,
      offset: state.offset,
      sqlDialect: state.sqlDialect,
      sqlStrictMode: state.sqlStrictMode,
    };
  }

  function buildSchemaSummaryForAi() {
    return {
      tables: (state.schema.tables || []).map((table) => ({
        name: table.name,
        columns: (table.columns || []).map((column) => ({
          name: column.name,
          type: column.type || "",
          kind: column.kind || "",
          comment: column.comment || "",
          partition: Boolean(column.partition),
        })),
      })),
    };
  }

  function getActiveDictionaryEntries() {
    return state.dictionaryEntries.filter((item) => item.activeModelId === state.activeModelId);
  }

  async function handleSaveDictionaryEntry() {
    const term = dom.dictTermInput.value.trim();
    const fieldMatch = findFieldMatch(dom.dictFieldInput.value);
    const description = dom.dictDescriptionInput.value.trim();
    if (!state.activeModelId) {
      pushSqlStatus("error", "请先选择模型，再保存字段字典。");
      return;
    }
    if (!term || !fieldMatch) {
      pushSqlStatus("error", "请输入业务词，并选择一个 DDL 中存在的字段。");
      return;
    }
    const id = `${state.activeModelId}:${term}:${fieldMatch.id}`;
    const entry = {
      id,
      activeModelId: state.activeModelId,
      term,
      field: fieldMatch.id,
      description,
      updatedAt: new Date().toISOString(),
    };
    state.dictionaryEntries = state.dictionaryEntries.filter((item) => item.id !== id);
    state.dictionaryEntries.unshift(entry);
    const ok = await persistDictionary();
    if (!ok) {
      return;
    }
    dom.dictTermInput.value = "";
    dom.dictFieldInput.value = "";
    dom.dictDescriptionInput.value = "";
    renderDictionary();
    pushSqlStatus("info", `字段字典已保存：${term} -> ${fieldMatch.id}`);
  }

  function renderDictionaryFieldOptions() {
    dom.dictFieldOptions.innerHTML = renderOptionValues(
      getFieldSuggestionLabels(dom.dictFieldInput.value, getAvailableFields())
    );
  }

  function renderDictionary() {
    renderDictionaryFieldOptions();
    const entries = getActiveDictionaryEntries();
    if (!entries.length) {
      dom.dictionaryList.className = "saved-list empty-state";
      dom.dictionaryList.textContent = "当前模型还没有配置业务字段字典。";
      return;
    }
    dom.dictionaryList.className = "saved-list";
    dom.dictionaryList.innerHTML = entries
      .map(
        (entry) => `
          <article class="saved-query-card">
            <div>
              <strong>${escapeHtml(entry.term)}</strong>
              <p>${escapeHtml(entry.field)}${entry.description ? ` · ${escapeHtml(entry.description)}` : ""}</p>
            </div>
            <button class="icon-button" data-delete-dict-entry="${escapeAttr(entry.id)}">删除</button>
          </article>
        `
      )
      .join("");
  }

  function importQuerySpec(spec) {
    if (!spec?.activeModelId || !state.models.some((model) => model.id === spec.activeModelId)) {
      pushSqlStatus("error", "该查询模板关联的模型不存在，无法载入。");
      return false;
    }

    state.activeModelId = spec.activeModelId;
    state.aiResult = null;
    state.aiLoading = false;
    loadActiveModelSchema({ resetBuilder: true, quiet: true });

    state.baseTable = spec.baseTable || "";
    state.joins = clone(spec.joins || []);
    state.template = spec.template || "detail";
    state.selectedDimensions = clone(spec.dimensions || []);
    state.metrics = clone(spec.metrics || []);
    state.filters = clone(spec.filters || []);
    state.filterConditionOperator = normalizeLogicalOperator(spec.filterConditionOperator);
    state.filterGroupOperator = normalizeLogicalOperator(spec.filterGroupOperator);
    state.havingFilters = clone(spec.havingFilters || []);
    state.havingConditionOperator = normalizeLogicalOperator(spec.havingConditionOperator);
    state.havingGroupOperator = normalizeLogicalOperator(spec.havingGroupOperator);
    state.sort = clone(spec.sort || { field: "", dir: "desc" });
    state.limit = String(spec.limit || "100");
    state.offset = String(spec.offset || "");
    state.sqlDialect = normalizeSqlDialect(spec.sqlDialect);
    state.sqlStrictMode = typeof spec.sqlStrictMode === "boolean" ? spec.sqlStrictMode : true;
    reconcileState();
    void persistModels();
    return true;
  }

  function getResolvedJoins() {
    const availableTables = new Set();
    const resolved = [];

    if (state.baseTable) {
      availableTables.add(state.baseTable);
    }

    state.joins.forEach((join) => {
      const validConditions = getValidJoinConditions(join);
      if (
        !join.leftTable ||
        !join.rightTable ||
        !validConditions.length ||
        !availableTables.has(join.leftTable) ||
        availableTables.has(join.rightTable)
      ) {
        return;
      }

      resolved.push({ ...join, conditions: validConditions });
      availableTables.add(join.rightTable);
    });

    return resolved;
  }

  function getAvailableTables() {
    if (!state.baseTable) {
      return [];
    }
    return [state.baseTable, ...getResolvedJoins().map((join) => join.rightTable)];
  }

  function getAvailableFields() {
    return getAvailableTables().flatMap((tableName) =>
      getColumnsForTable(tableName).map((column) => ({
        ...column,
        table: tableName,
        id: `${tableName}.${column.name}`,
      }))
    );
  }

  function getHavingFields() {
    const dimensionFields = state.selectedDimensions
      .map((fieldId) => getFieldById(fieldId))
      .filter(Boolean);
    const metricFields = state.metrics
      .filter((metric) => metric.field)
      .map((metric) => {
        const sourceField = getFieldById(metric.field);
        const alias = metricAlias(metric, sourceField);
        return {
          name: alias,
          type: "METRIC",
          kind: "number",
          table: "__metrics__",
          id: `metric:${alias}`,
          metric,
          comment: sourceField ? `${metric.func.toUpperCase()}(${sourceField.name})` : alias,
        };
      })
      .filter((field) => field.name);
    return [...dimensionFields, ...metricFields];
  }

  function getFieldDisplayValue(fieldId) {
    const field = getFieldById(fieldId);
    return field ? getFieldOptionLabel(field) : fieldId || "";
  }

  function getFieldOptionLabel(field, fields) {
    if (!field) {
      return "";
    }

    const availableFields = fields || getAvailableFields();
    const sameNameCount = availableFields.filter((item) => item.name === field.name).length;
    return sameNameCount > 1 ? `${field.name}（${getShortTableName(field.table)}）` : field.name;
  }

  function getShortTableName(tableName) {
    return String(tableName || "").split(".").pop() || tableName || "";
  }

  function getFieldSuggestionLabels(query, fields) {
    const availableFields = fields || getAvailableFields();
    const normalized = normalizeFieldSearchText(query);
    const source = normalized
      ? availableFields
          .map((field, index) => ({
            field,
            index,
            score: getFieldSuggestionScore(field, normalized, availableFields),
          }))
          .filter((item) => item.score < 99)
          .sort((left, right) => left.score - right.score || left.index - right.index)
          .map((item) => item.field)
      : availableFields.slice(0, 30);

    return uniqueValues(
      source
        .slice(0, normalized ? 80 : 30)
        .map((field) => getFieldOptionLabel(field, availableFields))
    );
  }

  function getFieldSuggestionScore(field, normalized, availableFields) {
    const name = field.name.toLowerCase();
    const label = getFieldOptionLabel(field, availableFields).toLowerCase();
    const comment = String(field.comment || "").toLowerCase();
    const type = String(field.type || "").toLowerCase();
    const table = String(field.table || "").toLowerCase();
    const fullName = `${field.table}.${field.name}`.toLowerCase();

    if (name === normalized) {
      return 0;
    }
    if (label === normalized) {
      return 1;
    }
    if (name.startsWith(normalized)) {
      return 2;
    }
    if (label.startsWith(normalized)) {
      return 3;
    }
    if (name.includes(normalized)) {
      return 4;
    }
    if (comment.includes(normalized)) {
      return 5;
    }
    if (fullName.includes(normalized) || table.includes(normalized)) {
      return 6;
    }
    if (type.includes(normalized)) {
      return 7;
    }
    return 99;
  }

  function updateFieldSearchOptions(input, fields) {
    if (!input?.list) {
      return;
    }
    input.list.innerHTML = renderOptionValues(getFieldSuggestionLabels(input.value, fields));
  }

  function renderOptionValues(values) {
    return values
      .map((value) => `<option value="${escapeAttr(value)}"></option>`)
      .join("");
  }

  function uniqueValues(values) {
    return Array.from(new Set(values));
  }

  function normalizeFieldSearchText(raw) {
    return String(raw || "")
      .trim()
      .replace(/（[^）]+）$/u, "")
      .replace(/\([^)]+\)$/u, "")
      .trim()
      .toLowerCase();
  }

  function getSortOptions() {
    if (state.template === "detail") {
      const availableFields = getAvailableFields();
      return availableFields.map((field) => ({
        value: field.id,
        label: getFieldOptionLabel(field, availableFields),
      }));
    }

    const metrics = state.metrics
      .filter((metric) => metric.field)
      .map((metric) => ({
        value: `metric:${metricAlias(metric)}`,
        label: metricAlias(metric),
      }));

    const dimensions = state.selectedDimensions.map((fieldId) => {
      const field = getFieldById(fieldId);
      return {
        value: fieldId,
        label: field ? getFieldOptionLabel(field) : fieldId,
      };
    });

    return [...dimensions, ...metrics];
  }

  function getJoinLeftTableOptions(index) {
    const tables = [state.baseTable];
    state.joins.slice(0, index).forEach((join) => {
      if (join.rightTable) {
        tables.push(join.rightTable);
      }
    });
    return Array.from(new Set(tables.filter(Boolean)));
  }

  function getJoinRightTableOptions(index) {
    const unavailable = new Set(getJoinLeftTableOptions(index));
    const current = state.joins[index];
    if (current?.rightTable) {
      unavailable.delete(current.rightTable);
    }
    return state.schema.tables
      .map((table) => table.name)
      .filter((name) => !unavailable.has(name) || name === current?.rightTable);
  }

  function getTableByName(name) {
    return state.schema.tables.find((table) => table.name === name);
  }

  function getColumnsForTable(name) {
    return getTableByName(name)?.columns || [];
  }

  function hasColumn(tableName, columnName) {
    return getColumnsForTable(tableName).some((column) => column.name === columnName);
  }

  function getJoinConditions(join) {
    if (Array.isArray(join?.conditions) && join.conditions.length) {
      return join.conditions.map((condition, index) => ({
        leftField: String(condition?.leftField || "").trim(),
        rightField: String(condition?.rightField || "").trim(),
        groupId: normalizeGroupId(condition?.groupId || (index === 0 ? "1" : "1")),
      }));
    }

    return [
      {
        leftField: String(join?.leftField || "").trim(),
        rightField: String(join?.rightField || "").trim(),
        groupId: "1",
      },
    ];
  }

  function normalizeJoinConfig(join) {
    const normalized = {
      joinType: ["inner", "left", "right"].includes(join?.joinType) ? join.joinType : "left",
      conditionOperator: ["and", "or"].includes(join?.conditionOperator)
        ? join.conditionOperator
        : "and",
      conditionGroupOperator: ["and", "or"].includes(join?.conditionGroupOperator)
        ? join.conditionGroupOperator
        : "and",
      leftTable: String(join?.leftTable || state.baseTable || "").trim(),
      rightTable: String(join?.rightTable || "").trim(),
      conditions: getJoinConditions(join),
    };
    if (!normalized.conditions.length) {
      normalized.conditions = [{ leftField: "", rightField: "" }];
    }
    syncLegacyJoinFields(normalized);
    return normalized;
  }

  function getValidJoinConditions(join) {
    if (!join?.leftTable || !join?.rightTable) {
      return [];
    }
    return getJoinConditions(join).filter(
      (condition) =>
        condition.leftField &&
        condition.rightField &&
        hasColumn(join.leftTable, condition.leftField) &&
        hasColumn(join.rightTable, condition.rightField)
    );
  }

  function syncLegacyJoinFields(join) {
    const [firstCondition] = getJoinConditions(join);
    join.leftField = firstCondition?.leftField || "";
    join.rightField = firstCondition?.rightField || "";
  }

  function buildJoinOnClause(join, conditions) {
    return buildJoinOnClauseWithContext(join, conditions, null);
  }

  function buildJoinOnClauseWithContext(join, conditions, context) {
    const innerOperator = normalizeLogicalOperator(join?.conditionOperator).toUpperCase();
    const groupOperator = normalizeLogicalOperator(join?.conditionGroupOperator).toUpperCase();
    const groups = groupConditions(conditions);
    return groups
      .map((group) => {
        const clause = group.items
          .map(
            (condition) =>
              `${formatTableColumn(join.leftTable, condition.leftField, context, true)} = ${formatTableColumn(
                join.rightTable,
                condition.rightField,
                context,
                true
              )}`
          )
          .join(` ${innerOperator} `);
        return groups.length > 1 || group.items.length > 1 ? `(${clause})` : clause;
      })
      .join(` ${groupOperator} `);
  }

  function getFieldById(fieldId) {
    if (!fieldId || !fieldId.includes(".")) {
      return null;
    }
    const [table, ...rest] = fieldId.split(".");
    const columnName = rest.join(".");
    const column = getColumnsForTable(table).find((item) => item.name === columnName);
    if (!column) {
      return null;
    }
    return { ...column, table, id: fieldId };
  }

  function createDefaultJoin() {
    return {
      joinType: "left",
      conditionOperator: "and",
      conditionGroupOperator: "and",
      leftTable: state.baseTable,
      rightTable: "",
      conditions: [{ leftField: "", rightField: "", groupId: "1" }],
    };
  }

  function createDefaultMetric() {
    return {
      field: "",
      func: "sum",
      alias: "",
    };
  }

  function createDefaultFilter(groupId) {
    return {
      field: "",
      operator: "=",
      value: "",
      valueTo: "",
      groupId: normalizeGroupId(groupId),
    };
  }

  function normalizeLogicalOperator(value) {
    return value === "or" ? "or" : "and";
  }

  function normalizeSqlDialect(value) {
    return SQL_DIALECTS.includes(value) ? value : EMPTY_STATE.sqlDialect;
  }

  function describeSqlDialect(value) {
    const dialect = normalizeSqlDialect(value);
    if (dialect === "hive") {
      return "Hive / Spark";
    }
    if (dialect === "mysql") {
      return "MySQL";
    }
    if (dialect === "presto") {
      return "Presto / Trino";
    }
    return "通用 SQL";
  }

  function normalizeGroupId(value) {
    const text = String(value || "1").trim();
    return text || "1";
  }

  function groupConditions(items) {
    const groups = [];
    const byId = new Map();
    items.forEach((item) => {
      const groupId = normalizeGroupId(item.groupId);
      if (!byId.has(groupId)) {
        const group = { id: groupId, items: [] };
        byId.set(groupId, group);
        groups.push(group);
      }
      byId.get(groupId).items.push({ ...item, groupId });
    });
    return groups;
  }

  function groupIndexedConditions(items) {
    const groups = [];
    const byId = new Map();
    (items || []).forEach((item, index) => {
      const groupId = normalizeGroupId(item.groupId);
      if (!byId.has(groupId)) {
        const group = { id: groupId, items: [] };
        byId.set(groupId, group);
        groups.push(group);
      }
      byId.get(groupId).items.push({ item, index });
    });
    return groups;
  }

  function getLastFilterGroupId() {
    return normalizeGroupId(state.filters[state.filters.length - 1]?.groupId);
  }

  function createNextFilterGroupId() {
    return createNextGroupId(state.filters);
  }

  function getLastHavingGroupId() {
    return normalizeGroupId(state.havingFilters[state.havingFilters.length - 1]?.groupId);
  }

  function createNextHavingGroupId() {
    return createNextGroupId(state.havingFilters);
  }

  function getLastJoinGroupId(join) {
    const conditions = getJoinConditions(join);
    return normalizeGroupId(conditions[conditions.length - 1]?.groupId);
  }

  function createNextJoinGroupId(join) {
    return createNextGroupId(getJoinConditions(join));
  }

  function createNextGroupId(items) {
    const used = new Set((items || []).map((item) => normalizeGroupId(item.groupId)));
    let index = used.size + 1;
    while (used.has(String(index))) {
      index += 1;
    }
    return String(index);
  }

  function defaultMetricAlias(metric, resolvedField) {
    if (!metric.field) {
      return "";
    }
    const field = resolvedField || getFieldById(metric.field);
    if (!field) {
      return "";
    }
    if (metric.func === "count") {
      return `count_${field.name}`;
    }
    if (metric.func === "count_distinct") {
      return `count_distinct_${field.name}`;
    }
    return `${metric.func}_${field.name}`;
  }

  function metricAlias(metric, resolvedField) {
    return metric.alias?.trim() || defaultMetricAlias(metric, resolvedField);
  }

  function previewMetric(metric) {
    if (!metric.field) {
      return "";
    }
    const field = getFieldById(metric.field);
    if (!field) {
      return "";
    }
    return `${metric.func.toUpperCase()}(${formatQueryColumn(field)})`;
  }

  function buildJoinPreview(join) {
    if (!join.leftTable || !join.rightTable) {
      return "";
    }
    const conditions = getJoinConditions(join).filter((condition) => condition.leftField && condition.rightField);
    if (!conditions.length) {
      return "";
    }
    return `${join.joinType.toUpperCase()} JOIN ${join.rightTable} ON ${buildJoinOnClause(join, conditions)}`;
  }

  function describeSavedQuery(spec) {
    const modelLabel = getModelLabelById(spec.activeModelId);
    return `模型：${modelLabel} · 模板：${templateTitle(spec.template)} · 基表：${spec.baseTable || "未设置"}`;
  }

  function templateTitle(key) {
    return TEMPLATE_META[key]?.title || key || "未命名模板";
  }

  function getModelLabelById(id) {
    const model = state.models.find((item) => item.id === id);
    return model ? buildModelLabel(model) : "模型不存在";
  }

  function describeProvider(provider) {
    return provider === "codex_cli" ? "Codex 登录态" : "OpenAI / 兼容接口";
  }

  function describeSelectedDimensions() {
    return state.selectedDimensions.length ? `${state.selectedDimensions.length} 个字段` : "全部字段";
  }

  function buildSummaryCards(items) {
    return items
      .map(
        (item) => `
          <article class="summary-card">
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.body)}</p>
          </article>
        `
      )
      .join("");
  }

  function buildPreviewMeta(items) {
    return items
      .filter(Boolean)
      .map((item) => `<span class="preview-meta-item">${escapeHtml(item)}</span>`)
      .join("");
  }

  function getRenderableAiResult() {
    if (!state.aiResult) {
      return null;
    }

    if (state.aiResult.activeModelId && state.aiResult.activeModelId !== state.activeModelId) {
      return null;
    }

    return state.aiResult;
  }

  function buildAiStatusMessages(result) {
    const messages = [
      {
        level: "info",
        text: `AI 已根据当前模型和一句话描述生成 SQL。`,
      },
    ];

    if (result.summary) {
      messages.push({
        level: "info",
        text: `说明：${shortenText(result.summary, 140)}`,
      });
    }

    (result.assumptions || []).slice(0, 2).forEach((item) => {
      messages.push({
        level: "info",
        text: `假设：${shortenText(item, 140)}`,
      });
    });

    return messages;
  }

  function shortenText(value, maxLength) {
    const text = String(value || "").trim();
    if (!text || text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
  }

  function renderSelectField(config) {
    const { label, value, dataField, index, options, type, scope } = config;
    const attribute =
      type === "join"
        ? "data-join-field"
        : type === "metric"
          ? "data-metric-field"
          : "data-filter-field";

    return `
      <label class="field">
        <span>${escapeHtml(label)}</span>
        <select ${attribute}="${escapeAttr(dataField)}" data-index="${index}" ${
          type === "filter" ? `data-filter-scope="${escapeAttr(scope || "where")}"` : ""
        }>
          <option value="">请选择</option>
          ${options
            .map(
              (option) => `
                <option value="${escapeAttr(option.value)}" ${
                  option.value === value ? "selected" : ""
                }>${escapeHtml(option.label)}</option>
              `
            )
            .join("")}
        </select>
      </label>
    `;
  }

  function renderSearchInputField(config) {
    const { label, value, dataField, index, options, type, listId, placeholder, quickFields, selectedFieldId, scope } = config;
    const attribute =
      type === "join"
        ? "data-join-field"
        : type === "metric"
          ? "data-metric-field"
          : "data-filter-field";

    return `
      <label class="field">
        <span>${escapeHtml(label)}</span>
        <input
          type="text"
          list="${escapeAttr(listId)}"
          ${attribute}="${escapeAttr(dataField)}"
          data-index="${index}"
          ${type === "filter" ? `data-filter-scope="${escapeAttr(scope || "where")}"` : ""}
          value="${escapeAttr(value)}"
          placeholder="${escapeAttr(placeholder || "输入后选择")}"
        />
        <datalist id="${escapeAttr(listId)}">
          ${options
            .map((option) => `<option value="${escapeAttr(option)}"></option>`)
            .join("")}
        </datalist>
        ${quickFields ? renderQuickFieldTags({
          fields: quickFields,
          selectedFieldId,
          mode: "filter",
          index,
          scope,
        }) : ""}
      </label>
    `;
  }

  function renderJoinConditionInputField(config) {
    const { label, value, dataField, index, conditionIndex, options, listId, placeholder, tableName } = config;
    const fields = getColumnsForTable(tableName).map((column) => ({
      ...column,
      table: tableName,
      id: column.name,
    }));
    return `
      <label class="field">
        <span>${escapeHtml(label)}</span>
        <input
          type="text"
          list="${escapeAttr(listId)}"
          data-join-condition-field="${escapeAttr(dataField)}"
          data-index="${index}"
          data-condition-index="${conditionIndex}"
          value="${escapeAttr(value)}"
          placeholder="${escapeAttr(placeholder || "输入后选择")}"
        />
        <datalist id="${escapeAttr(listId)}">
          ${options
            .map((option) => `<option value="${escapeAttr(option)}"></option>`)
            .join("")}
        </datalist>
        ${renderQuickFieldTags({
          fields,
          selectedFieldId: value,
          mode: "join",
          index,
          conditionIndex,
          dataField,
        })}
      </label>
    `;
  }

  function renderQuickFieldTags(config) {
    const fields = (config.fields || []).slice(0, 40);
    if (!fields.length) {
      return "";
    }
    return `
      <div class="quick-field-tags">
        ${fields.map((field) => renderQuickFieldTag(field, config)).join("")}
      </div>
    `;
  }

  function renderQuickFieldTag(field, config) {
    const fieldId = config.mode === "filter" ? field.id : field.name;
    const selected = config.selectedFieldId === fieldId;
    const attrs =
      config.mode === "filter"
        ? `data-pick-filter-field data-filter-scope="${escapeAttr(config.scope || "where")}" data-index="${config.index}" data-field="${escapeAttr(field.id)}"`
        : `data-pick-join-condition-field="${escapeAttr(config.dataField)}" data-index="${config.index}" data-condition-index="${config.conditionIndex}" data-field="${escapeAttr(field.name)}"`;
    return `
      <button
        type="button"
        class="quick-field-tag ${selected ? "selected" : ""}"
        ${attrs}
        title="${escapeAttr(field.comment || field.name)}"
      >
        <span>${escapeHtml(field.name)}</span>
        <code>${escapeHtml(field.type || "")}</code>
      </button>
    `;
  }

  function renderSQL(spec) {
    const messages = [];
    const schemaTables = spec.schema?.tables || [];

    if (!schemaTables.length) {
      return {
        sql: "-- 请先选择一个模型。",
        resolvedJoins: [],
        messages: [{ level: "info", text: "当前还没有可用模型。" }],
      };
    }

    if (!spec.baseTable) {
      return {
        sql: "-- 请先选择基表。",
        resolvedJoins: [],
        messages: [{ level: "error", text: "基表不能为空。" }],
      };
    }

    const resolvedJoins = resolveJoinsFromSpec(spec);
    const sqlContext = createSqlRenderContext(spec, resolvedJoins);
    const availableFields = collectFieldsFromSpec(spec, resolvedJoins);
    const fieldMap = new Map(availableFields.map((field) => [field.id, field]));
    const selectParts = [];
    const groupByParts = [];

    const dimensions = (spec.dimensions || []).filter((fieldId) => fieldMap.has(fieldId));
    const metrics = (spec.metrics || []).filter((metric) => fieldMap.has(metric.field));

    if (spec.template === "detail") {
      if (dimensions.length) {
        dimensions.forEach((fieldId) => {
          const field = fieldMap.get(fieldId);
          selectParts.push(formatQueryColumn(field, sqlContext));
        });
      } else {
        selectParts.push("*");
        messages.push({
          level: "info",
          text: "未指定输出字段，默认查询全部字段（SELECT *）。",
        });
      }
    } else {
      dimensions.forEach((fieldId) => {
        const field = fieldMap.get(fieldId);
        selectParts.push(formatQueryColumn(field, sqlContext));
        groupByParts.push(formatQueryColumn(field, sqlContext));
      });

      if (!metrics.length) {
        messages.push({
          level: "error",
          text: "聚合查询和 Top N 至少需要一个指标。",
        });
      }

      metrics.forEach((metric) => {
        const field = fieldMap.get(metric.field);
        const alias = metricAlias(metric, field);
        selectParts.push(
          `${toMetricExpression(metric.func, field, sqlContext)} AS ${formatAlias(alias, sqlContext)}`
        );
      });
    }

    const whereClause = renderWhereClause(spec.filters || [], fieldMap, {
      conditionOperator: spec.filterConditionOperator,
      groupOperator: spec.filterGroupOperator,
      context: sqlContext,
      messages,
    });
    const havingFieldMap = buildHavingFieldMap(spec, fieldMap, metrics);
    const havingClause = renderWhereClause(spec.havingFilters || [], havingFieldMap, {
      conditionOperator: spec.havingConditionOperator,
      groupOperator: spec.havingGroupOperator,
      context: sqlContext,
      messages,
    });
    if (havingClause && spec.template === "detail") {
      messages.push({
        level: "warning",
        text: "明细查询不支持 HAVING，已忽略 HAVING 条件。",
      });
    }

    const lines = [];
    lines.push("SELECT");
    lines.push(selectParts.map((part) => `  ${part}`).join(",\n") || "  -- 请先选择字段或指标");
    lines.push(`FROM ${formatTableReference(spec.baseTable, sqlContext)}`);

    resolvedJoins.forEach((join) => {
      lines.push(
        `${join.joinType.toUpperCase()} JOIN ${formatTableReference(
          join.rightTable,
          sqlContext
        )} ON ${buildJoinOnClauseWithContext(join, join.conditions, sqlContext)}`
      );
    });

    if (whereClause) {
      lines.push("WHERE");
      lines.push(`  ${whereClause}`);
    }

    if (groupByParts.length) {
      lines.push("GROUP BY");
      lines.push(groupByParts.map((part) => `  ${part}`).join(",\n"));
    }

    if (havingClause && spec.template !== "detail") {
      lines.push("HAVING");
      lines.push(`  ${havingClause}`);
    }

    const sortClause = renderSortClause(spec.sort, fieldMap, metrics, sqlContext);
    if (sortClause) {
      lines.push(`ORDER BY ${sortClause}`);
    } else if (spec.template === "topn" && metrics.length) {
      const fallbackAlias = metricAlias(metrics[0], fieldMap.get(metrics[0].field));
      lines.push(`ORDER BY ${formatAlias(fallbackAlias, sqlContext)} DESC`);
      messages.push({
        level: "info",
        text: `Top N 默认按 ${fallbackAlias} 倒序排序。`,
      });
    }

    const numericLimit = Number(spec.limit);
    if (Number.isInteger(numericLimit) && numericLimit > 0) {
      lines.push(`LIMIT ${numericLimit}`);
    } else if (spec.template === "topn") {
      lines.push("LIMIT 10");
      messages.push({
        level: "info",
        text: "Top N 默认 LIMIT 10。",
      });
    }

    const numericOffset = Number(spec.offset);
    if (String(spec.offset || "").trim() && Number.isInteger(numericOffset) && numericOffset >= 0) {
      lines.push(`OFFSET ${numericOffset}`);
    } else if (String(spec.offset || "").trim()) {
      messages.push({
        level: "warning",
        text: "OFFSET 只支持大于等于 0 的整数，已忽略。",
      });
    }

    if (!resolvedJoins.length && (spec.joins || []).length) {
      messages.push({
        level: "info",
        text: "部分 Join 配置不完整，已在生成 SQL 时忽略。",
      });
    }

    if (!sqlContext.strict && resolvedJoins.length && hasAmbiguousColumnNames(availableFields)) {
      messages.push({
        level: "warning",
        text: "当前关闭严格模式，且多表查询存在同名字段，部分字段可能在数据库中产生歧义。",
      });
    }

    if (!messages.length) {
      messages.push({
        level: "info",
        text: "SQL 已根据当前配置生成。",
      });
    }

    return {
      sql: `${lines.join("\n")};`,
      resolvedJoins,
      messages,
    };
  }

  function resolveJoinsFromSpec(spec) {
    const tablesByName = new Map((spec.schema?.tables || []).map((table) => [table.name, table]));
    const available = new Set(spec.baseTable ? [spec.baseTable] : []);
    const resolved = [];

    (spec.joins || []).forEach((join) => {
      const validConditions = getSpecValidJoinConditions(join, tablesByName);
      if (
        !join.leftTable ||
        !join.rightTable ||
        !validConditions.length ||
        !available.has(join.leftTable) ||
        available.has(join.rightTable)
      ) {
        return;
      }

      const leftTable = tablesByName.get(join.leftTable);
      const rightTable = tablesByName.get(join.rightTable);
      if (!leftTable || !rightTable) {
        return;
      }

      resolved.push({ ...join, conditions: validConditions });
      available.add(join.rightTable);
    });

    return resolved;
  }

  function getSpecValidJoinConditions(join, tablesByName) {
    if (!join?.leftTable || !join?.rightTable) {
      return [];
    }
    const leftTable = tablesByName.get(join.leftTable);
    const rightTable = tablesByName.get(join.rightTable);
    if (!leftTable || !rightTable) {
      return [];
    }
    return getJoinConditions(join).filter(
      (condition) =>
        condition.leftField &&
        condition.rightField &&
        leftTable.columns.some((column) => column.name === condition.leftField) &&
        rightTable.columns.some((column) => column.name === condition.rightField)
    );
  }

  function collectFieldsFromSpec(spec, resolvedJoins) {
    const selectedTables = [spec.baseTable, ...resolvedJoins.map((join) => join.rightTable)].filter(Boolean);
    const tablesByName = new Map((spec.schema?.tables || []).map((table) => [table.name, table]));

    return selectedTables.flatMap((tableName) =>
      (tablesByName.get(tableName)?.columns || []).map((column) => ({
        ...column,
        table: tableName,
        id: `${tableName}.${column.name}`,
      }))
    );
  }

  function buildHavingFieldMap(spec, fieldMap, metrics) {
    const havingFields = [];
    (spec.dimensions || []).forEach((fieldId) => {
      if (fieldMap.has(fieldId)) {
        havingFields.push(fieldMap.get(fieldId));
      }
    });
    metrics.forEach((metric) => {
      const sourceField = fieldMap.get(metric.field);
      const alias = metricAlias(metric, sourceField);
      if (!alias) {
        return;
      }
      havingFields.push({
        name: alias,
        type: "METRIC",
        kind: "number",
        table: "__metrics__",
        id: `metric:${alias}`,
      });
    });
    return new Map(havingFields.map((field) => [field.id, field]));
  }

  function createSqlRenderContext(spec, resolvedJoins) {
    const dialect = normalizeSqlDialect(spec.sqlDialect);
    const strict = spec.sqlStrictMode !== false;
    const tables = [spec.baseTable, ...resolvedJoins.map((join) => join.rightTable)].filter(Boolean);
    const tableAliases = new Map();
    tables.forEach((tableName, index) => {
      if (!tableAliases.has(tableName)) {
        tableAliases.set(tableName, `t${index}`);
      }
    });
    return { dialect, strict, tableAliases };
  }

  function toMetricExpression(func, field, context) {
    const column = formatQueryColumn(field, context);
    if (func === "count") {
      return `COUNT(${column})`;
    }
    if (func === "count_distinct") {
      return `COUNT(DISTINCT ${column})`;
    }
    return `${func.toUpperCase()}(${column})`;
  }

  function renderSortClause(sort, fieldMap, metrics, context) {
    if (!sort?.field) {
      return "";
    }
    const direction = sort.dir === "asc" ? "ASC" : "DESC";

    if (sort.field.startsWith("metric:")) {
      return `${formatAlias(sort.field.replace("metric:", ""), context)} ${direction}`;
    }

    if (fieldMap.has(sort.field)) {
      const field = fieldMap.get(sort.field);
      return `${formatQueryColumn(field, context)} ${direction}`;
    }

    const matchingMetric = metrics.find(
      (metric) => metricAlias(metric, fieldMap.get(metric.field)) === sort.field
    );
    if (matchingMetric) {
      return `${formatAlias(
        metricAlias(matchingMetric, fieldMap.get(matchingMetric.field)),
        context
      )} ${direction}`;
    }

    return "";
  }

  function renderWhereClause(filters, fieldMap, options) {
    const innerOperator = normalizeLogicalOperator(options?.conditionOperator).toUpperCase();
    const groupOperator = normalizeLogicalOperator(options?.groupOperator).toUpperCase();
    const validFilters = (filters || [])
      .map((filter) => ({
        ...filter,
        groupId: normalizeGroupId(filter.groupId),
      }))
      .filter((filter) => fieldMap.has(filter.field));

    const groupedFilters = groupConditions(validFilters);
    const groups = groupedFilters
      .map((group) => {
        const clauses = group.items
          .map((filter) => renderFilterClause(fieldMap.get(filter.field), filter, options))
          .filter(Boolean);
        if (!clauses.length) {
          return "";
        }
        const clause = clauses.join(` ${innerOperator} `);
        return groupedFilters.length > 1 || clauses.length > 1 ? `(${clause})` : clause;
      })
      .filter(Boolean);

    return groups.join(` ${groupOperator} `);
  }

  function renderFilterClause(field, filter, options) {
    const column = formatQueryColumn(field, options?.context);
    const operator = filter.operator;

    if (operator === "is_null") {
      return `${column} IS NULL`;
    }

    if (operator === "is_not_null") {
      return `${column} IS NOT NULL`;
    }

    if (operator === "between") {
      if (!filter.value || !filter.valueTo) {
        return "";
      }
      if (
        !validateFilterValue(field, filter.value, options) ||
        !validateFilterValue(field, filter.valueTo, options)
      ) {
        return "";
      }
      return `${column} BETWEEN ${formatValue(field, filter.value)} AND ${formatValue(field, filter.valueTo)}`;
    }

    if (operator === "in") {
      if (!filter.value) {
        return "";
      }
      const parts = String(filter.value)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .filter((value) => validateFilterValue(field, value, options))
        .map((value) => formatValue(field, value));
      if (!parts.length) {
        return "";
      }
      return `${column} IN (${parts.join(", ")})`;
    }

    if (!filter.value) {
      return "";
    }

    if (!validateFilterValue(field, filter.value, options)) {
      return "";
    }

    if (operator === "like") {
      return `${column} LIKE ${formatValue(field, filter.value)}`;
    }

    return `${column} ${operator} ${formatValue(field, filter.value)}`;
  }

  function validateFilterValue(field, value, options) {
    if (!field) {
      return false;
    }
    if (field.kind === "number" && !isNumericLiteral(value)) {
      options?.messages?.push({
        level: "warning",
        text: `字段 ${field.name} 是数值类型，过滤值「${shortenText(value, 32)}」不是合法数字，已忽略该条件。`,
      });
      return false;
    }
    if (field.kind === "boolean" && !/^(true|false|1|0)$/i.test(String(value).trim())) {
      options?.messages?.push({
        level: "warning",
        text: `字段 ${field.name} 是布尔类型，过滤值「${shortenText(value, 32)}」不是 true/false/1/0，已忽略该条件。`,
      });
      return false;
    }
    return true;
  }

  function isNumericLiteral(value) {
    return /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(String(value).trim());
  }

  function formatQueryColumn(field, context) {
    if (!field) {
      return "";
    }
    return formatTableColumn(field.table, field.name, context);
  }

  function formatTableColumn(tableName, columnName, context, forceTablePrefix = false) {
    if (tableName === "__metrics__") {
      return formatAlias(columnName, context);
    }
    if (!context) {
      return forceTablePrefix && tableName ? `${tableName}.${columnName}` : columnName;
    }
    if (!context.strict) {
      return forceTablePrefix && tableName ? `${tableName}.${columnName}` : columnName;
    }
    const alias = context.tableAliases?.get(tableName);
    const column = quoteIdentifier(columnName, context.dialect);
    return alias ? `${alias}.${column}` : column;
  }

  function formatTableReference(tableName, context) {
    const table = quoteMultipartIdentifier(tableName, context?.dialect);
    if (!context?.strict) {
      return table;
    }
    const alias = context.tableAliases?.get(tableName);
    return alias ? `${table} ${alias}` : table;
  }

  function formatAlias(alias, context) {
    const cleanAlias = String(alias || "").trim();
    if (!cleanAlias) {
      return "";
    }
    if (!context?.strict || /^[A-Za-z_][A-Za-z0-9_]*$/.test(cleanAlias)) {
      return cleanAlias;
    }
    return quoteIdentifier(cleanAlias, context.dialect);
  }

  function quoteMultipartIdentifier(value, dialect) {
    return String(value || "")
      .split(".")
      .map((part) => quoteIdentifier(part, dialect))
      .join(".");
  }

  function quoteIdentifier(value, dialect) {
    const text = String(value || "").trim();
    if (!text || normalizeSqlDialect(dialect) === "plain") {
      return text;
    }
    const quoteChar = normalizeSqlDialect(dialect) === "presto" ? '"' : "`";
    return `${quoteChar}${text.replaceAll(quoteChar, `${quoteChar}${quoteChar}`)}${quoteChar}`;
  }

  function hasAmbiguousColumnNames(fields) {
    const seen = new Set();
    return fields.some((field) => {
      const key = field.name.toLowerCase();
      if (seen.has(key)) {
        return true;
      }
      seen.add(key);
      return false;
    });
  }

  function formatValue(field, rawValue) {
    const value = String(rawValue).trim();
    if (field.kind === "number") {
      return value;
    }
    if (field.kind === "boolean") {
      return /^(true|1)$/i.test(value) ? "TRUE" : "FALSE";
    }
    return `'${value.replace(/'/g, "''")}'`;
  }

  function parseDDL(ddl) {
    if (!ddl.trim()) {
      return { tables: [] };
    }

    const cleaned = ddl
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/--.*$/gm, "")
      .trim();

    const statements = splitStatements(cleaned);
    const tables = statements.map(parseCreateTableStatement).filter(Boolean);
    return { tables };
  }

  function splitStatements(input) {
    const statements = [];
    let current = "";
    let depth = 0;
    let quote = "";

    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      const prev = input[index - 1];

      if ((char === "'" || char === '"' || char === "`") && prev !== "\\") {
        if (quote === char) {
          quote = "";
        } else if (!quote) {
          quote = char;
        }
      }

      if (!quote) {
        if (char === "(") {
          depth += 1;
        } else if (char === ")") {
          depth -= 1;
        } else if (char === ";" && depth === 0) {
          if (current.trim()) {
            statements.push(current.trim());
          }
          current = "";
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      statements.push(current.trim());
    }

    return statements;
  }

  function parseCreateTableStatement(statement) {
    if (!/^create\s+table/i.test(statement)) {
      return null;
    }

    const tableNameMatch = statement.match(
      /^create\s+table\s+(?:if\s+not\s+exists\s+)?([^\s(]+)/i
    );
    if (!tableNameMatch) {
      throw new Error(`无法解析表名：${statement.slice(0, 80)}...`);
    }

    const tableName = cleanIdentifier(tableNameMatch[1]);
    const startIndex = statement.indexOf("(");
    if (startIndex === -1) {
      throw new Error(`表 ${tableName} 没有识别到字段定义块。`);
    }

    let depth = 0;
    let endIndex = -1;
    let quote = "";
    for (let index = startIndex; index < statement.length; index += 1) {
      const char = statement[index];
      const prev = statement[index - 1];

      if ((char === "'" || char === '"' || char === "`") && prev !== "\\") {
        if (quote === char) {
          quote = "";
        } else if (!quote) {
          quote = char;
        }
      }

      if (!quote) {
        if (char === "(") {
          depth += 1;
        } else if (char === ")") {
          depth -= 1;
          if (depth === 0) {
            endIndex = index;
            break;
          }
        }
      }
    }

    if (endIndex === -1) {
      throw new Error(`表 ${tableName} 的字段定义块没有正常结束。`);
    }

    const body = statement.slice(startIndex + 1, endIndex);
    const columns = splitTopLevel(body, ",")
      .map(parseColumnDefinition)
      .filter(Boolean);
    const partitionColumns = parsePartitionColumns(statement, endIndex + 1);
    const existingColumnNames = new Set(columns.map((column) => column.name.toLowerCase()));
    partitionColumns.forEach((column) => {
      if (!existingColumnNames.has(column.name.toLowerCase())) {
        columns.push(column);
      }
    });

    return {
      name: tableName,
      columns,
    };
  }

  function parsePartitionColumns(statement, searchStartIndex) {
    const keywordIndex = findKeywordOutsideQuotes(statement, "partitioned", searchStartIndex);
    if (keywordIndex === -1) {
      return [];
    }

    const afterKeyword = statement.slice(keywordIndex);
    if (!/^partitioned\s+by\b/i.test(afterKeyword)) {
      return [];
    }

    const openParenIndex = statement.indexOf("(", keywordIndex);
    if (openParenIndex === -1) {
      return [];
    }

    const partitionBody = extractParenBody(statement, openParenIndex);
    if (!partitionBody) {
      return [];
    }

    return splitTopLevel(partitionBody, ",")
      .map(parseColumnDefinition)
      .filter(Boolean)
      .map((column) => ({ ...column, partition: true }));
  }

  function findKeywordOutsideQuotes(input, keyword, startIndex) {
    let quote = "";
    const lowerInput = input.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();

    for (let index = startIndex; index < input.length; index += 1) {
      const char = input[index];
      const prev = input[index - 1];

      if ((char === "'" || char === '"' || char === "`") && prev !== "\\") {
        if (quote === char) {
          quote = "";
        } else if (!quote) {
          quote = char;
        }
      }

      if (!quote && lowerInput.startsWith(lowerKeyword, index)) {
        const before = input[index - 1] || " ";
        const after = input[index + keyword.length] || " ";
        if (!/[A-Za-z0-9_]/.test(before) && !/[A-Za-z0-9_]/.test(after)) {
          return index;
        }
      }
    }

    return -1;
  }

  function extractParenBody(input, openParenIndex) {
    let depth = 0;
    let quote = "";

    for (let index = openParenIndex; index < input.length; index += 1) {
      const char = input[index];
      const prev = input[index - 1];

      if ((char === "'" || char === '"' || char === "`") && prev !== "\\") {
        if (quote === char) {
          quote = "";
        } else if (!quote) {
          quote = char;
        }
      }

      if (!quote) {
        if (char === "(") {
          depth += 1;
        } else if (char === ")") {
          depth -= 1;
          if (depth === 0) {
            return input.slice(openParenIndex + 1, index);
          }
        }
      }
    }

    return "";
  }

  function splitTopLevel(input, separator) {
    const parts = [];
    let current = "";
    let depth = 0;
    let angleDepth = 0;
    let quote = "";

    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      const prev = input[index - 1];

      if ((char === "'" || char === '"' || char === "`") && prev !== "\\") {
        if (quote === char) {
          quote = "";
        } else if (!quote) {
          quote = char;
        }
      }

      if (!quote) {
        if (char === "(") {
          depth += 1;
        } else if (char === ")") {
          depth -= 1;
        } else if (char === "<") {
          angleDepth += 1;
        } else if (char === ">") {
          angleDepth = Math.max(0, angleDepth - 1);
        } else if (char === separator && depth === 0 && angleDepth === 0) {
          parts.push(current.trim());
          current = "";
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }

  function parseColumnDefinition(fragment) {
    if (!fragment) {
      return null;
    }

    if (
      /^(primary|unique|constraint|key|index|foreign|partitioned|sort|dist|cluster)/i.test(
        fragment
      )
    ) {
      return null;
    }

    const nameMatch = fragment.match(/^([`"[\]\w.]+)/);
    if (!nameMatch) {
      return null;
    }

    const name = cleanIdentifier(nameMatch[1]);
    const remainder = fragment.slice(nameMatch[0].length).trim();
    const comment = extractColumnComment(remainder);
    const tokens = remainder.split(/\s+/);
    const typeTokens = [];
    const stopWords = new Set([
      "not",
      "null",
      "default",
      "primary",
      "unique",
      "references",
      "check",
      "comment",
      "collate",
      "generated",
      "constraint",
      "encode",
      "distkey",
      "sortkey",
    ]);

    for (const token of tokens) {
      const normalized = token.toLowerCase();
      if (stopWords.has(normalized)) {
        break;
      }
      typeTokens.push(token);
    }

    const type = typeTokens.join(" ") || "UNKNOWN";
    return {
      name,
      type,
      kind: inferKind(type),
      comment,
    };
  }

  function extractColumnComment(fragment) {
    const match = String(fragment || "").match(/\bcomment\s+('((?:\\'|''|[^'])*)'|"((?:\\"|""|[^"])*)")/i);
    const raw = match ? match[2] ?? match[3] ?? "" : "";
    return raw.replace(/''/g, "'").replace(/\\"/g, '"').replace(/""/g, '"').trim();
  }

  function cleanIdentifier(value) {
    return String(value)
      .split(".")
      .map((part) => part.replace(/^[`"\[]+|[`"\]]+$/g, ""))
      .join(".");
  }

  function inferKind(type) {
    const normalized = type.toLowerCase();
    if (/(int|decimal|numeric|float|double|real|bigint|smallint)/.test(normalized)) {
      return "number";
    }
    if (/(date|time|timestamp)/.test(normalized)) {
      return "date";
    }
    if (/bool/.test(normalized)) {
      return "boolean";
    }
    return "string";
  }

  function safeCountTables(ddl) {
    try {
      const schema = parseDDL(ddl);
      const tableCount = schema.tables.length;
      const columnCount = schema.tables.reduce((total, table) => total + table.columns.length, 0);
      return { tableCount, columnCount };
    } catch (_error) {
      return { tableCount: 0, columnCount: 0 };
    }
  }

  function makeModelId(env, tableName) {
    const base = `${String(env || "").trim()}-${String(tableName || "").trim()}`
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return `${base || "model"}-${Date.now()}`;
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    return response.json();
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    return response.json();
  }

  async function readErrorMessage(response) {
    try {
      const data = await response.json();
      return data.error || `HTTP ${response.status}`;
    } catch (_error) {
      return `HTTP ${response.status}`;
    }
  }

  function safeParseJson(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return fallback;
    }
  }

  function safeLocalStorageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_error) {
      return null;
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }

  const exported = {
    parseDDL,
    renderSQL,
    splitStatements,
    parseCreateTableStatement,
    parseColumnDefinition,
    parseSelectSqlAst,
    inferKind,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }

  if (typeof window !== "undefined") {
    window.SQLBuilder = exported;
    window.addEventListener("DOMContentLoaded", () => {
      init().catch((error) => {
        console.error(error);
      });
    });
  }
})();
