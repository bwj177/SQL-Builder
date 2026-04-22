#!/usr/bin/env python3

import os
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
MODELS_PATH = DATA_DIR / "models.json"
QUERIES_PATH = DATA_DIR / "queries.json"
LLM_CONFIG_PATH = DATA_DIR / "llm_config.json"
SAMPLE_SCHEMA_PATH = ROOT / "schema" / "sample_schema.sql"
SQL_OUTPUT_SCHEMA_PATH = ROOT / "schema" / "sql_ai_result.schema.json"
ALLOWED_REASONING_EFFORTS = {"none", "low", "medium", "high", "xhigh"}
ALLOWED_LLM_PROVIDERS = {"openai_compatible", "codex_cli"}
SQL_RESULT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["title", "summary", "assumptions", "sql"],
    "properties": {
        "title": {"type": "string"},
        "summary": {"type": "string"},
        "assumptions": {
            "type": "array",
            "items": {"type": "string"},
        },
        "sql": {"type": "string"},
    },
}


def load_sample_ddl() -> str:
    if SAMPLE_SCHEMA_PATH.exists():
        return SAMPLE_SCHEMA_PATH.read_text(encoding="utf-8")
    return ""


SAMPLE_MODEL = {
    "id": "demo-ecommerce-model",
    "env": "demo",
    "tableName": "电商演示模型",
    "name": "demo / 电商演示模型",
    "ddl": load_sample_ddl(),
    "builtIn": True,
    "createdAt": "2026-04-20T00:00:00.000Z",
    "updatedAt": "",
}


def default_models_payload() -> dict:
    return {
        "activeModelId": SAMPLE_MODEL["id"],
        "models": [SAMPLE_MODEL],
    }


def default_queries_payload() -> dict:
    return {
        "savedQueries": [],
    }


def default_llm_config_payload() -> dict:
    return {
        "provider": "codex_cli",
        "baseUrl": "https://api.openai.com/v1",
        "model": "",
        "apiKeyEnv": "OPENAI_API_KEY",
        "reasoningEffort": "medium",
        "temperature": 0.1,
    }


def ensure_storage() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ensure_json_file(MODELS_PATH, default_models_payload(), normalize_models_payload)
    ensure_json_file(QUERIES_PATH, default_queries_payload(), normalize_queries_payload)
    ensure_json_file(LLM_CONFIG_PATH, default_llm_config_payload(), normalize_llm_config_payload)


def ensure_json_file(path: Path, default_payload: dict, normalizer) -> None:
    if not path.exists():
        write_json(path, default_payload)
        return

    try:
        current = read_json(path)
        normalizer(current)
    except Exception:
        write_json(path, default_payload)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile("w", encoding="utf-8", dir=str(path.parent), delete=False) as temp:
        json.dump(payload, temp, ensure_ascii=False, indent=2)
        temp.write("\n")
        temp_path = Path(temp.name)
    temp_path.replace(path)


def normalize_models_payload(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("models payload must be an object")

    raw_models = payload.get("models")
    if not isinstance(raw_models, list):
        raise ValueError("models must be a list")

    models = []
    for item in raw_models:
        if not isinstance(item, dict):
            continue
        model_id = str(item.get("id", "")).strip()
        env = normalize_model_env(item.get("env"), built_in=bool(item.get("builtIn", False)))
        table_name = normalize_model_table_name(item.get("tableName"), fallback=item.get("name"))
        name = compose_model_name(env, table_name)
        ddl = item.get("ddl", "")
        if not model_id or not env or not table_name or not isinstance(ddl, str):
            continue
        models.append(
            {
                "id": model_id,
                "env": env,
                "tableName": table_name,
                "name": name,
                "ddl": ddl,
                "builtIn": bool(item.get("builtIn", False)),
                "createdAt": str(item.get("createdAt", "")),
                "updatedAt": str(item.get("updatedAt", "")),
            }
        )

    if not models:
        raise ValueError("models must contain at least one valid model")

    active_model_id = str(payload.get("activeModelId", "")).strip()
    if active_model_id not in {item["id"] for item in models}:
        active_model_id = models[0]["id"]

    return {
        "activeModelId": active_model_id,
        "models": models,
    }


def normalize_model_env(value, built_in: bool = False) -> str:
    env = str(value or "").strip()
    if env:
        return env
    return "demo" if built_in else "default"


def normalize_model_table_name(value, fallback=None) -> str:
    table_name = str(value or "").strip()
    if table_name:
        return table_name
    fallback_name = str(fallback or "").strip()
    return fallback_name or "未命名模型"


def compose_model_name(env: str, table_name: str) -> str:
    return f"{env} / {table_name}"


def normalize_queries_payload(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("queries payload must be an object")

    raw_queries = payload.get("savedQueries")
    if not isinstance(raw_queries, list):
        raise ValueError("savedQueries must be a list")

    saved_queries = []
    for item in raw_queries:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        spec = item.get("spec")
        if not name or not isinstance(spec, dict):
            continue
        saved_queries.append(
            {
                "name": name,
                "savedAt": str(item.get("savedAt", "")),
                "spec": spec,
            }
        )

    return {"savedQueries": saved_queries}


def normalize_llm_config_payload(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("llm config payload must be an object")

    provider = str(payload.get("provider", "")).strip() or default_llm_config_payload()["provider"]
    base_url = normalize_base_url(payload.get("baseUrl"))
    model = str(payload.get("model", "")).strip()
    if provider == "openai_compatible" and not model:
        model = "gpt-5.4-mini"
    api_key_env = str(payload.get("apiKeyEnv", "")).strip() or default_llm_config_payload()["apiKeyEnv"]
    reasoning_effort = (
        str(payload.get("reasoningEffort", "")).strip().lower()
        or default_llm_config_payload()["reasoningEffort"]
    )

    if provider not in ALLOWED_LLM_PROVIDERS:
        raise ValueError("执行方式仅支持 codex_cli 或 openai_compatible。")

    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", api_key_env):
        raise ValueError("API Key 环境变量名称不合法。")

    if reasoning_effort not in ALLOWED_REASONING_EFFORTS:
        raise ValueError("推理强度仅支持 none / low / medium / high / xhigh。")

    try:
        temperature = float(payload.get("temperature", default_llm_config_payload()["temperature"]))
    except (TypeError, ValueError) as error:
        raise ValueError("温度必须是 0 到 2 之间的数字。") from error

    if not 0 <= temperature <= 2:
        raise ValueError("温度必须是 0 到 2 之间的数字。")

    return {
        "provider": provider,
        "baseUrl": base_url,
        "model": model,
        "apiKeyEnv": api_key_env,
        "reasoningEffort": reasoning_effort,
        "temperature": round(temperature, 2),
    }


def normalize_base_url(value) -> str:
    base_url = str(value or "").strip() or default_llm_config_payload()["baseUrl"]
    base_url = base_url.rstrip("/")

    for suffix in ("/responses", "/chat/completions"):
        if base_url.endswith(suffix):
            base_url = base_url[: -len(suffix)]

    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("接口地址必须是合法的 http/https 地址。")

    return base_url


def read_state() -> dict:
    ensure_storage()
    models_payload = normalize_models_payload(read_json(MODELS_PATH))
    queries_payload = normalize_queries_payload(read_json(QUERIES_PATH))
    llm_config_payload = normalize_llm_config_payload(read_json(LLM_CONFIG_PATH))
    return {
        "activeModelId": models_payload["activeModelId"],
        "models": models_payload["models"],
        "savedQueries": queries_payload["savedQueries"],
        "llmConfig": llm_config_payload,
        "codexLoginStatus": get_codex_login_status(),
    }


def read_models_payload() -> dict:
    ensure_storage()
    return normalize_models_payload(read_json(MODELS_PATH))


def read_llm_config_payload() -> dict:
    ensure_storage()
    return normalize_llm_config_payload(read_json(LLM_CONFIG_PATH))


def get_codex_login_status() -> dict:
    home_dir = os.environ.get("HOME", "").strip()
    auth_file = Path(home_dir) / ".codex" / "auth.json" if home_dir else None
    has_auth_file = bool(auth_file and auth_file.exists() and auth_file.stat().st_size > 2)

    try:
        completed = subprocess.run(
            ["codex", "login", "status"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
            cwd=str(ROOT),
            env=os.environ.copy(),
        )
        output = "\n".join([completed.stdout or "", completed.stderr or ""]).strip()
        ok = completed.returncode == 0 and re.search(r"logged in", output, re.IGNORECASE) is not None
        return {
            "configured": bool(has_auth_file and ok),
            "hasAuthFile": has_auth_file,
            "statusMessage": output or "codex login status returned empty output",
        }
    except Exception as error:  # pragma: no cover - defensive path
        return {
            "configured": False,
            "hasAuthFile": has_auth_file,
            "statusMessage": str(error),
        }


def build_sql_generation_payload(model_name: str, ddl: str, prompt: str, builder_spec: dict) -> str:
    builder_hints = []

    base_table = str(builder_spec.get("baseTable", "")).strip()
    if base_table:
        builder_hints.append(f"- 当前基表：{base_table}")

    template = str(builder_spec.get("template", "")).strip()
    if template:
        builder_hints.append(f"- 当前模板：{template}")

    joins = builder_spec.get("joins")
    if isinstance(joins, list) and joins:
        join_lines = []
        for item in joins:
            if not isinstance(item, dict):
                continue
            left_table = str(item.get("leftTable", "")).strip()
            right_table = str(item.get("rightTable", "")).strip()
            join_type = str(item.get("joinType", "left")).strip() or "left"
            condition_operator = str(item.get("conditionOperator", "and")).strip().lower()
            condition_operator = "OR" if condition_operator == "or" else "AND"
            conditions = item.get("conditions")
            if not isinstance(conditions, list) or not conditions:
                conditions = [
                    {
                        "leftField": item.get("leftField", ""),
                        "rightField": item.get("rightField", ""),
                    }
                ]
            condition_lines = []
            for condition in conditions:
                if not isinstance(condition, dict):
                    continue
                left_field = str(condition.get("leftField", "")).strip()
                right_field = str(condition.get("rightField", "")).strip()
                if left_field and right_field:
                    condition_lines.append(f"{left_table}.{left_field} = {right_table}.{right_field}")
            if left_table and right_table and condition_lines:
                join_lines.append(
                    f"  * {join_type.upper()} JOIN {right_table} ON {f' {condition_operator} '.join(condition_lines)}"
                )
        if join_lines:
            builder_hints.append("- 当前页面已配置的 Join：\n" + "\n".join(join_lines))

    builder_hint_text = "\n".join(builder_hints) if builder_hints else "- 当前没有额外的页面配置提示。"

    return (
        f"当前模型名称：{model_name}\n\n"
        "你将收到一个 SQL Builder 的模型 DDL 和用户的查询需求。\n"
        "请只使用 DDL 中真实存在的表和字段，输出一条可直接执行的 SELECT SQL。\n"
        "如果需求有歧义，请做最少假设，并把假设写入 assumptions。\n"
        "不要输出 Markdown，不要解释 JSON 结构之外的内容。\n\n"
        f"用户需求：\n{prompt.strip()}\n\n"
        f"当前页面提示：\n{builder_hint_text}\n\n"
        f"DDL：\n{ddl}"
    )


def parse_sql_result(raw_text: str, active_model_id: str, model_name: str, llm_config: dict) -> dict:
    if not raw_text:
        raise ValueError("模型返回为空，无法生成 SQL。")

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError as error:
        raise ValueError(f"模型返回不是合法 JSON：{error.msg}") from error

    title = str(parsed.get("title", "")).strip() or "AI SQL 结果"
    summary = str(parsed.get("summary", "")).strip()
    sql = str(parsed.get("sql", "")).strip()
    assumptions_raw = parsed.get("assumptions", [])
    assumptions = []

    if isinstance(assumptions_raw, list):
        assumptions = [str(item).strip() for item in assumptions_raw if str(item).strip()]

    if not sql:
        raise ValueError("模型没有返回 SQL。")

    if not re.match(r"(?is)^select\b", sql):
        raise ValueError("模型返回的不是 SELECT SQL，请调整提示词后重试。")

    if not sql.rstrip().endswith(";"):
        sql = f"{sql.rstrip()};"

    return {
        "title": title,
        "summary": summary,
        "assumptions": assumptions,
        "sql": sql,
        "activeModelId": active_model_id,
        "modelName": model_name,
        "llmModel": llm_config["model"],
        "llmProvider": llm_config["provider"],
        "reasoningEffort": llm_config["reasoningEffort"],
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def call_llm_for_sql(prompt: str, active_model_id: str, builder_spec: dict) -> dict:
    models_payload = read_models_payload()
    llm_config = read_llm_config_payload()
    model = next((item for item in models_payload["models"] if item["id"] == active_model_id), None)

    if not model:
        raise ValueError("当前模型不存在，请重新选择模型后再试。")

    ddl = str(model.get("ddl", "")).strip()
    if not ddl:
        raise ValueError("当前模型没有可用的 DDL。")

    if llm_config["provider"] == "codex_cli":
        return call_codex_cli_for_sql(
            prompt=prompt,
            active_model_id=active_model_id,
            model_name=model["name"],
            ddl=ddl,
            builder_spec=builder_spec,
            llm_config=llm_config,
        )

    return call_openai_compatible_for_sql(
        prompt=prompt,
        active_model_id=active_model_id,
        model_name=model["name"],
        ddl=ddl,
        builder_spec=builder_spec,
        llm_config=llm_config,
    )


def call_openai_compatible_for_sql(
    prompt: str,
    active_model_id: str,
    model_name: str,
    ddl: str,
    builder_spec: dict,
    llm_config: dict,
) -> dict:

    api_key = os.environ.get(llm_config["apiKeyEnv"], "").strip()
    if not api_key:
        raise ValueError(
            f"环境变量 {llm_config['apiKeyEnv']} 未设置。请先在启动服务的终端里 export 这个 API Key。"
        )

    request_body = {
        "model": llm_config["model"],
        "input": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "You are a strict SQL generation assistant. "
                            "Return a single JSON object matching the required schema. "
                            "Generate exactly one SELECT query. "
                            "Do not invent tables or columns not present in the provided DDL."
                        ),
                    }
                ],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": build_sql_generation_payload(
                            model_name=model_name,
                            ddl=ddl,
                            prompt=prompt,
                            builder_spec=builder_spec,
                        ),
                    }
                ],
            },
        ],
        "reasoning": {"effort": llm_config["reasoningEffort"]},
        "temperature": llm_config["temperature"],
        "tool_choice": "none",
        "text": {
            "format": {
                "type": "json_schema",
                "name": "sql_builder_result",
                "strict": True,
                "schema": SQL_RESULT_SCHEMA,
            }
        },
    }

    response_payload = post_json(
        url=f"{llm_config['baseUrl']}/responses",
        api_key=api_key,
        payload=request_body,
    )
    response_text = extract_output_text(response_payload)
    return parse_sql_result(
        raw_text=response_text,
        active_model_id=active_model_id,
        model_name=model_name,
        llm_config=llm_config,
    )


def call_codex_cli_for_sql(
    prompt: str,
    active_model_id: str,
    model_name: str,
    ddl: str,
    builder_spec: dict,
    llm_config: dict,
) -> dict:
    status = get_codex_login_status()
    if not status["configured"]:
        raise ValueError(f"Codex 未登录：{status['statusMessage']}")

    final_prompt = (
        "你是一个严格的 SQL 生成助手。\n"
        "返回结果必须是一个 JSON 对象，字段结构与给定 schema 完全一致。\n"
        "只生成一条 SELECT SQL。\n"
        "不能发明 DDL 中不存在的表或字段。\n\n"
        + build_sql_generation_payload(
            model_name=model_name,
            ddl=ddl,
            prompt=prompt,
            builder_spec=builder_spec,
        )
    )

    with NamedTemporaryFile("w", encoding="utf-8", delete=False) as output_file:
        output_path = Path(output_file.name)

    args = [
        "codex",
        "exec",
        "--json",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "--output-schema",
        str(SQL_OUTPUT_SCHEMA_PATH),
        "--output-last-message",
        str(output_path),
        final_prompt,
    ]

    if llm_config["model"]:
        args[6:6] = ["--model", llm_config["model"]]

    try:
        completed = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
            cwd=str(ROOT),
            env=os.environ.copy(),
        )

        if completed.returncode != 0:
            stderr = (completed.stderr or "").strip()
            stdout = (completed.stdout or "").strip().splitlines()
            detail = stderr or (stdout[-1] if stdout else "") or "unknown error"
            raise ValueError(f"codex exec 失败：{detail}")

        raw_text = output_path.read_text(encoding="utf-8").strip()
        return parse_sql_result(
            raw_text=raw_text,
            active_model_id=active_model_id,
            model_name=model_name,
            llm_config={
                **llm_config,
                "model": llm_config["model"] or "codex-default",
            },
        )
    finally:
        try:
            output_path.unlink(missing_ok=True)
        except Exception:
            pass


def post_json(url: str, api_key: str, payload: dict) -> dict:
    request = urllib.request.Request(
        url=url,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        data=json.dumps(payload).encode("utf-8"),
    )

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="ignore")
        try:
            payload = json.loads(detail)
            message = payload.get("error", {}).get("message") or payload.get("error") or detail
        except json.JSONDecodeError:
            message = detail or error.reason
        raise ValueError(f"模型接口返回错误：HTTP {error.code}，{message}") from error
    except urllib.error.URLError as error:
        raise ValueError(f"模型接口不可达：{error.reason}") from error


def extract_output_text(payload: dict) -> str:
    if isinstance(payload.get("output_text"), str) and payload["output_text"].strip():
        return payload["output_text"]

    output = payload.get("output")
    if not isinstance(output, list):
        return ""

    parts = []
    for item in output:
        if not isinstance(item, dict) or item.get("type") != "message":
            continue
        content = item.get("content")
        if not isinstance(content, list):
            continue
        for part in content:
            if isinstance(part, dict) and part.get("type") == "output_text":
                text = str(part.get("text", "")).strip()
                if text:
                    parts.append(text)

    return "\n".join(parts).strip()


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format: str, *args) -> None:
        sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/state":
            self.respond_json(HTTPStatus.OK, read_state())
            return
        if parsed.path == "/api/codex-login-status":
            self.respond_json(HTTPStatus.OK, get_codex_login_status())
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        try:
            payload = self.read_json_body()
            if parsed.path == "/api/models":
                normalized = normalize_models_payload(payload)
                write_json(MODELS_PATH, normalized)
                self.respond_json(HTTPStatus.OK, normalized)
                return
            if parsed.path == "/api/queries":
                normalized = normalize_queries_payload(payload)
                write_json(QUERIES_PATH, normalized)
                self.respond_json(HTTPStatus.OK, normalized)
                return
            if parsed.path == "/api/llm-config":
                normalized = normalize_llm_config_payload(payload)
                write_json(LLM_CONFIG_PATH, normalized)
                self.respond_json(HTTPStatus.OK, normalized)
                return
            if parsed.path == "/api/generate-sql":
                prompt = str(payload.get("prompt", "")).strip()
                active_model_id = str(payload.get("activeModelId", "")).strip()
                builder_spec = payload.get("builderSpec") if isinstance(payload.get("builderSpec"), dict) else {}

                if not prompt:
                    raise ValueError("请先输入一句话需求描述。")
                if not active_model_id:
                    raise ValueError("请先选择模型。")

                result = call_llm_for_sql(
                    prompt=prompt,
                    active_model_id=active_model_id,
                    builder_spec=builder_spec,
                )
                self.respond_json(HTTPStatus.OK, result)
                return
            self.respond_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
        except ValueError as error:
            self.respond_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except Exception as error:  # pragma: no cover - defensive path
            self.respond_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(error)})

    def read_json_body(self) -> dict:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as error:
            raise ValueError(f"invalid json body: {error.msg}") from error
        if not isinstance(payload, dict):
            raise ValueError("json body must be an object")
        return payload

    def respond_json(self, status: HTTPStatus, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    ensure_storage()
    port = 8000
    server = ThreadingHTTPServer(("127.0.0.1", port), AppHandler)
    print(f"Serving sql-builder-mvp on http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
