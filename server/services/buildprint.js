import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const CALL_TIMEOUT_MS = 30_000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_RESULT_CHARS = 500_000;

// ---------- jq cookbook templates ----------

export const JQ_BY_ACTION = `[.. | objects | select(.type? == $t) | { action_id: (.id // null), action_type: (.type // null) }]`;

export const JQ_BY_ELEMENT_WORKFLOWS = `. as $root | def workflow_rows: [((if ($root.pages | type) == "object" then $root.pages else {} end) | to_entries[]? | select(.value | type == "object") | .value as $page | (if ($page.workflows | type) == "object" then $page.workflows else {} end) | to_entries[]? | select(.value | type == "object") | { owner_scope: "page", owner_name: ($page.name // $page.display // $page.default_name // null), workflow: .value }), ((if ($root.element_definitions | type) == "object" then $root.element_definitions else {} end) | to_entries[]? | select(.value | type == "object") | .value as $reusable | (if ($reusable.workflows | type) == "object" then $reusable.workflows else {} end) | to_entries[]? | select(.value | type == "object") | { owner_scope: "reusable", owner_name: ($reusable.name // $reusable.display // $reusable.default_name // null), workflow: .value }), ((if ($root.api | type) == "object" then $root.api else {} end) | to_entries[]? | select(.value | type == "object") | { owner_scope: "api", owner_name: "api", workflow: .value })] | flatten; def dot($p): ($p | map(if type=="number" then tostring else . end) | join(".")); def ref_paths($wf): [(($wf.actions // {}) | paths(objects | select(.element_id? == $id)) | "actions." + dot(.)), (((($wf.properties // {}) | del(.element_id)) | paths(objects | select(.element_id? == $id))) | "properties." + dot(.))] | unique; workflow_rows | map(. as $row | ($row.workflow) as $wf | (ref_paths($wf)) as $refs | { workflow_id: ($wf.id // null), workflow_type: ($wf.type // null), owner_scope: $row.owner_scope, owner_name: $row.owner_name, triggered_by_element: (($wf.properties?.element_id? // null) == $id), uses_element: (($refs | length) > 0), reference_paths: $refs }) | map(select(.triggered_by_element or .uses_element))`;

export const JQ_WORKFLOW_TRIGGERS = `. as $root | def all_workflows: [((if ($root.pages | type) == "object" then $root.pages else {} end) | to_entries[]? | select(.value | type == "object") | .value as $page | (if ($page.workflows | type) == "object" then $page.workflows else {} end) | to_entries[]? | select(.value | type == "object") | { scope: "page", owner_name: $page.name, workflow_id: .value.id, workflow_name: (.value.properties.event_name // .value.name // null), workflow_type: .value.type, actions: (if (.value.actions | type) == "object" then .value.actions else {} end) }), ((if ($root.element_definitions | type) == "object" then $root.element_definitions else {} end) | to_entries[]? | select(.value | type == "object") | .value as $reusable | (if ($reusable.workflows | type) == "object" then $reusable.workflows else {} end) | to_entries[]? | select(.value | type == "object") | { scope: "reusable", owner_name: $reusable.name, workflow_id: .value.id, workflow_name: (.value.properties.event_name // .value.name // null), workflow_type: .value.type, actions: (if (.value.actions | type) == "object" then .value.actions else {} end) }), ((if ($root.api | type) == "object" then $root.api else {} end) | to_entries[]? | select(.value | type == "object") | .value as $wf | { scope: "api", owner_name: null, workflow_id: $wf.id, workflow_name: $wf.name, workflow_type: $wf.type, actions: (if ($wf.actions | type) == "object" then $wf.actions else {} end) }) ] | flatten; def matching_workflows($q): all_workflows | map(select((.workflow_id == $q) or (.workflow_name == $q))); def triggers_for($target_id): [all_workflows[] as $wf | ($wf.actions | to_entries[]? | .value) as $action | select((($action.type == "ScheduleAPIEvent" or $action.type == "ScheduleAPIEventOnList") and ($action.properties.api_event? == $target_id)) or ((($action.type == "ScheduleCustom" or $action.type == "TriggerCustomEvent" or $action.type == "TriggerCustomEventFromReusable" or $action.type == "TriggerCustomOnChange") and ($action.properties.custom_event? == $target_id)))) | { action_id: ($action.id // null), action_type: $action.type, source_workflow_id: $wf.workflow_id, source_workflow_name: $wf.workflow_name, source_workflow_type: $wf.workflow_type, source_scope: $wf.scope, source_owner: $wf.owner_name, target_workflow_id: $target_id }]; matching_workflows($query) | map(. as $target | (triggers_for($target.workflow_id)) as $triggers | { target: $target, trigger_count: ($triggers | length), triggers: $triggers })`;

export const JQ_WORKFLOW_OWNER = `. as $root | def page_workflows: (if ($root.pages|type)=="object" then $root.pages else {} end) | to_entries[]? | select(.value|type=="object") | .value as $page | (if ($page.workflows|type)=="object" then $page.workflows else {} end) | to_entries[]? | select(.value|type=="object") | .value as $wf | { workflow_id: ($wf.id // null), scope: "page", owner_name: ($page.name // $page.display // $page.default_name // null) }; def reusable_workflows: (if ($root.element_definitions|type)=="object" then $root.element_definitions else {} end) | to_entries[]? | select(.value|type=="object") | .value as $reusable | (if ($reusable.workflows|type)=="object" then $reusable.workflows else {} end) | to_entries[]? | select(.value|type=="object") | .value as $wf | { workflow_id: ($wf.id // null), scope: "reusable", owner_name: ($reusable.name // $reusable.display // $reusable.default_name // null) }; def api_workflows: (if ($root.api|type)=="object" then $root.api else {} end) | to_entries[]? | select(.value|type=="object") | .value as $wf | { workflow_id: ($wf.id // null), scope: "api", owner_name: "api" }; def all_workflows: [page_workflows, reusable_workflows, api_workflows] | flatten | map(select(.workflow_id != null)); ($workflow_ids // null) as $raw | (if $raw == null then [] elif ($raw|type)=="string" then [$raw] elif ($raw|type)=="array" then $raw else error("workflow_ids must be an array (or a single string)") end) as $ids | all_workflows as $all | ($ids | map(tostring) | unique) | map(. as $id | ($all | map(select(.workflow_id == $id)) | .[0]) as $match | if $match == null then { workflow_id: $id, found: false, scope: null, owner_name: null } else ($match + { found: true }) end)`;

export const JQ_BY_EVENT_TYPE = `def jp($p): '/' + ($p | map(if type=="number" then tostring else gsub('~';'~0')|gsub('/';'~1') end) | join('/')); [path(.. | objects | select(.type? == $t and .actions? != null))] | map({ path: jp(.) })`;

export const JQ_BY_ELEMENT_USAGE = `def jp($p): '/' + ($p | map(if type=="number" then tostring else gsub('~';'~0')|gsub('/';'~1') end) | join('/')); [path(.. | objects | select((.element_id? == $id) or (.properties?.element_id? == $id) or ((.type? == "GetElement") and (.properties?.element_id? == $id))))] | map({ path: jp(.), node_type: (try (getpath(.) | .type? // null) catch null), element_id: $id })`;

const JQ_TEMPLATES = {
  by_action: JQ_BY_ACTION,
  by_element_workflows: JQ_BY_ELEMENT_WORKFLOWS,
  workflow_triggers: JQ_WORKFLOW_TRIGGERS,
  workflow_owner: JQ_WORKFLOW_OWNER,
  by_event_type: JQ_BY_EVENT_TYPE,
  by_element_usage: JQ_BY_ELEMENT_USAGE,
};

// ---------- client pool & caching ----------

const clients = new Map();
const guidelinesCache = new Map();
const summaryCache = new Map();

function cacheKey(mcpUrl, appId, extra = "") {
  return `${mcpUrl}::${appId}::${extra}`;
}

function truncate(text) {
  if (typeof text !== "string") return text;
  if (text.length <= MAX_RESULT_CHARS) return text;
  return text.slice(0, MAX_RESULT_CHARS) + `\n...[truncated at ${MAX_RESULT_CHARS} chars]`;
}

async function createClient(mcpUrl) {
  if (clients.has(mcpUrl)) {
    const cached = clients.get(mcpUrl);
    try {
      await cached.ping();
      return cached;
    } catch {
      try { await cached.close(); } catch {}
      clients.delete(mcpUrl);
    }
  }

  const client = new Client({ name: "arkhitect", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
  await client.connect(transport);
  clients.set(mcpUrl, client);
  return client;
}

async function callTool(mcpUrl, toolName, args = {}) {
  const client = await createClient(mcpUrl);

  const result = await Promise.race([
    client.callTool({ name: toolName, arguments: args }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`MCP callTool "${toolName}" timed out after ${CALL_TIMEOUT_MS}ms`)), CALL_TIMEOUT_MS)
    ),
  ]);

  if (result.isError) {
    const msg = result.content?.map((c) => c.text || "").join("") || "Unknown MCP error";
    throw new Error(`MCP tool "${toolName}" error: ${msg}`);
  }

  const text = result.content?.map((c) => c.text || "").join("") || "";
  return truncate(text);
}

// ---------- bootstrap methods (Phase 1) ----------

export async function listApps(mcpUrl) {
  const raw = await callTool(mcpUrl, "list_apps", {});
  try {
    const parsed = JSON.parse(raw);
    return (parsed.projects || parsed || []).map((p) => ({
      name: p.projectName || p.name || p.bubbleAppName,
      appId: p.bubbleAppName || p.appId,
    }));
  } catch {
    return [];
  }
}

export async function getGuidelines(mcpUrl) {
  const key = cacheKey(mcpUrl, "", "guidelines");
  const cached = guidelinesCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  const raw = await callTool(mcpUrl, "get_guidelines", {
    paths: ["general", "exploring/app", "workflows", "expressions/dynamic"],
  });
  guidelinesCache.set(key, { data: raw, ts: Date.now() });
  return raw;
}

export async function listVersions(mcpUrl, appId) {
  const raw = await callTool(mcpUrl, "list_project_versions", { appId });
  try { return JSON.parse(raw); } catch { return raw; }
}

export async function syncApp(mcpUrl, appId, versionId) {
  const raw = await callTool(mcpUrl, "sync_app", { appId, versionId });
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = { status: raw }; }

  if (parsed.status === "in_progress" || parsed.status === "syncing") {
    const maxPolls = 30;
    for (let i = 0; i < maxPolls; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRaw = await callTool(mcpUrl, "get_sync_status", { appId });
      let status;
      try { status = JSON.parse(statusRaw); } catch { status = { status: statusRaw }; }
      if (status.status === "complete" || status.status === "synced" || status.status === "ready") {
        return status;
      }
      if (status.status === "error" || status.status === "failed") {
        throw new Error(`Sync failed: ${JSON.stringify(status)}`);
      }
    }
    throw new Error("Sync timed out after polling");
  }

  return parsed;
}

export async function getSummary(mcpUrl, appId, version = "live") {
  const key = cacheKey(mcpUrl, appId, `summary-${version}`);
  const cached = summaryCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  const raw = await callTool(mcpUrl, "get_summary", { appId, version });
  let data;
  try { data = JSON.parse(raw); } catch { data = raw; }
  summaryCache.set(key, { data, ts: Date.now() });
  return data;
}

export async function bootstrap(mcpUrl, appId) {
  guidelinesCache.clear();
  summaryCache.clear();

  const [guidelines, versions] = await Promise.all([
    getGuidelines(mcpUrl),
    listVersions(mcpUrl, appId),
  ]);

  let liveVersionId = null;
  if (Array.isArray(versions)) {
    const live = versions.find((v) => v.isLive || v.is_live || v.version === "live");
    liveVersionId = live?.id || live?.versionId || (versions[0]?.id ?? null);
  } else if (versions && typeof versions === "object") {
    liveVersionId = versions.liveVersionId || versions.id || null;
  }

  if (liveVersionId) {
    await syncApp(mcpUrl, appId, liveVersionId);
  }

  const summary = await getSummary(mcpUrl, appId, "live");
  return { guidelines, summary, liveVersionId };
}

// ---------- exploration methods (Phase 2 + 3) ----------

export async function getTree(mcpUrl, appId, version, targets, opts = {}) {
  const args = {
    appId,
    version,
    targets,
    include_types: opts.include_types ?? true,
    include_text: opts.include_text ?? true,
    include_workflows: opts.include_workflows ?? true,
    include_ids: opts.include_ids ?? true,
  };
  if (opts.include_properties != null) args.include_properties = opts.include_properties;
  return callTool(mcpUrl, "get_tree", args);
}

export async function getJson(mcpUrl, appId, version, paths, depth = 5) {
  const safeDepth = Math.min(depth, 20);
  const raw = await callTool(mcpUrl, "get_json", { appId, version, paths, depth: safeDepth });
  try { return JSON.parse(raw); } catch { return raw; }
}

export async function searchJson(mcpUrl, appId, version, query, opts = {}) {
  const args = { appId, version, query };

  if (opts.mode === "jq") {
    args.mode = "jq";
    if (opts.jqArgs) args.jqArgs = opts.jqArgs;
  } else if (opts.mode === "regex") {
    args.mode = "regex";
    args.where = "values";
  } else {
    args.mode = opts.mode || "text";
    if (args.mode === "text") args.where = "values";
  }

  if (opts.offset != null) args.offset = opts.offset;

  const raw = await callTool(mcpUrl, "search_json", args);
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { results: raw }; }

  if (parsed.hasMore && parsed.nextOffset != null) {
    const more = await searchJson(mcpUrl, appId, version, query, {
      ...opts,
      offset: parsed.nextOffset,
    });
    const combined = [].concat(parsed.results || [], more.results || []);
    return { results: combined };
  }

  return parsed;
}

export async function searchJsonJq(mcpUrl, appId, version, template, args = {}) {
  const jqQuery = JQ_TEMPLATES[template];
  if (!jqQuery) throw new Error(`Unknown jq template: ${template}`);

  const jqArgs = {};
  if (args.strings) jqArgs.strings = args.strings;
  if (args.json) jqArgs.json = args.json;

  return searchJson(mcpUrl, appId, version, jqQuery, { mode: "jq", jqArgs });
}

export async function fetchData(mcpUrl, appId, version, ids) {
  const raw = await callTool(mcpUrl, "fetch_data", { appId, version, ids });
  try { return JSON.parse(raw); } catch { return raw; }
}
