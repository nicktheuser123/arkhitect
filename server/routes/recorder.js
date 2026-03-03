import { Router } from "express";
import {
  startRecording,
  getSession,
  onComplete,
  stopRecording,
  cleanupSession,
} from "../services/recorder.js";
import {
  bootstrap,
  getTree,
  getJson,
  searchJson,
  searchJsonJq,
} from "../services/buildprint.js";
import {
  locateEntryPoints,
  identifyDeepReads,
  generateFlowAndTests,
} from "../services/llm.js";

const router = Router();

async function loadConfigs(supabase) {
  const { data, error } = await supabase
    .from("configs")
    .select("key, value")
    .in("key", [
      "llm_api_base", "llm_api_key", "llm_model",
      "buildprint_mcp_url", "buildprint_app_id",
    ]);
  if (error) return null;
  const cfg = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  if (!cfg.llm_api_base || !cfg.llm_api_key || !cfg.llm_model) return null;
  return cfg;
}

router.post("/start", async (req, res) => {
  try {
    const { suiteId } = req.body;
    if (!suiteId) {
      return res.status(400).json({ error: "suiteId is required" });
    }

    const { data: suite, error: sErr } = await req.supabase
      .from("test_suites")
      .select("bubble_app_url")
      .eq("id", suiteId)
      .single();

    if (sErr) throw sErr;
    if (!suite?.bubble_app_url) {
      return res.status(400).json({ error: "No Bubble App URL configured for this suite. Set it in the suite settings." });
    }

    const { sessionId } = startRecording(suite.bubble_app_url);
    res.json({ sessionId });
  } catch (err) {
    console.error("Recorder start error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/:sessionId/events", (req, res) => {
  const { sessionId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (session) => {
    const payload = { type: session.status };
    if (session.error) payload.message = session.error;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    res.end();
  };

  const registered = onComplete(sessionId, sendEvent);
  if (!registered) {
    res.write(`data: ${JSON.stringify({ type: "error", message: "Session not found" })}\n\n`);
    res.end();
    return;
  }

  req.on("close", () => {});
});

router.post("/:sessionId/stop", (req, res) => {
  const { sessionId } = req.params;
  const stopped = stopRecording(sessionId);
  if (!stopped) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json({ ok: true });
});

router.post("/:sessionId/analyze", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { suiteId } = req.body;

    if (!suiteId) {
      return res.status(400).json({ error: "suiteId is required" });
    }

    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    if (session.status !== "completed") {
      return res.status(400).json({ error: `Session is not completed (status: ${session.status})` });
    }
    if (!session.code || !session.code.trim()) {
      return res.status(400).json({ error: "No code was recorded. Try recording again." });
    }

    const cfg = await loadConfigs(req.supabase);
    if (!cfg) {
      return res.status(400).json({ error: "LLM not configured. Set API Base, Key, and Model in Setup." });
    }
    if (!cfg.buildprint_mcp_url || !cfg.buildprint_app_id) {
      return res.status(400).json({ error: "Buildprint MCP not configured. Set MCP URL and App ID in Setup." });
    }

    const playwrightCode = session.code;
    const mcpUrl = cfg.buildprint_mcp_url;
    const appId = cfg.buildprint_app_id;

    // ---- Phase 1: Bootstrap ----
    const { guidelines, summary, liveVersionId } = await bootstrap(mcpUrl, appId);
    const version = "live";

    // ---- Phase 2: Locate entry points ----
    const phase2 = await locateEntryPoints(
      cfg.llm_api_base, cfg.llm_api_key, cfg.llm_model,
      playwrightCode, summary, guidelines
    );

    const phase2McpResults = { trees: "", dataTypeSchemas: {}, searchResults: [] };

    const phase2Promises = [];

    if (phase2.pages && phase2.pages.length > 0) {
      phase2Promises.push(
        getTree(mcpUrl, appId, version, phase2.pages)
          .then((t) => { phase2McpResults.trees = t; })
          .catch((e) => { console.error("getTree error:", e.message); })
      );
    }

    if (phase2.dataTypes && phase2.dataTypes.length > 0) {
      const dtPaths = phase2.dataTypes.map((dt) => `/user_types/${dt}`);
      phase2Promises.push(
        getJson(mcpUrl, appId, version, dtPaths, 5)
          .then((r) => { phase2McpResults.dataTypeSchemas = r; })
          .catch((e) => { console.error("getJson dataTypes error:", e.message); })
      );
    }

    if (phase2.textSearches && phase2.textSearches.length > 0) {
      for (const query of phase2.textSearches) {
        phase2Promises.push(
          searchJson(mcpUrl, appId, version, query, { mode: "text" })
            .then((r) => { phase2McpResults.searchResults.push({ query, ...r }); })
            .catch((e) => { console.error("searchJson text error:", e.message); })
        );
      }
    }

    if (phase2.jqSearches && phase2.jqSearches.length > 0) {
      for (const jq of phase2.jqSearches) {
        phase2Promises.push(
          searchJsonJq(mcpUrl, appId, version, jq.template, jq.args || {})
            .then((r) => { phase2McpResults.searchResults.push({ template: jq.template, ...r }); })
            .catch((e) => { console.error("searchJsonJq error:", e.message); })
        );
      }
    }

    await Promise.all(phase2Promises);

    // ---- Phase 3: Deep-read calculation logic ----
    const phase3 = await identifyDeepReads(
      cfg.llm_api_base, cfg.llm_api_key, cfg.llm_model,
      playwrightCode, phase2McpResults
    );

    const phase3McpResults = { workflows: {}, optionSets: {}, searchResults: [] };
    const phase3Promises = [];

    if (phase3.workflowPaths && phase3.workflowPaths.length > 0) {
      const depth = Math.min(phase3.deepReadDepth || 15, 20);
      phase3Promises.push(
        getJson(mcpUrl, appId, version, phase3.workflowPaths, depth)
          .then((r) => { phase3McpResults.workflows = r; })
          .catch((e) => { console.error("getJson workflows error:", e.message); })
      );
    }

    if (phase3.optionSetPaths && phase3.optionSetPaths.length > 0) {
      phase3Promises.push(
        getJson(mcpUrl, appId, version, phase3.optionSetPaths, 5)
          .then((r) => { phase3McpResults.optionSets = r; })
          .catch((e) => { console.error("getJson optionSets error:", e.message); })
      );
    }

    if (phase3.additionalSearches && phase3.additionalSearches.length > 0) {
      for (const query of phase3.additionalSearches) {
        phase3Promises.push(
          searchJson(mcpUrl, appId, version, query, { mode: "text" })
            .then((r) => { phase3McpResults.searchResults.push({ query, ...r }); })
            .catch((e) => { console.error("searchJson phase3 error:", e.message); })
        );
      }
    }

    if (phase3.jqSearches && phase3.jqSearches.length > 0) {
      for (const jq of phase3.jqSearches) {
        phase3Promises.push(
          searchJsonJq(mcpUrl, appId, version, jq.template, jq.args || {})
            .then((r) => { phase3McpResults.searchResults.push({ template: jq.template, ...r }); })
            .catch((e) => { console.error("searchJsonJq phase3 error:", e.message); })
        );
      }
    }

    await Promise.all(phase3Promises);

    // ---- Phase 4: Generate flow + test cases ----
    const allMcpContext = {
      guidelines,
      summary,
      trees: phase2McpResults.trees,
      dataTypeSchemas: phase2McpResults.dataTypeSchemas,
      workflows: phase3McpResults.workflows,
      optionSets: phase3McpResults.optionSets,
      searchResults: [
        ...phase2McpResults.searchResults,
        ...phase3McpResults.searchResults,
      ],
    };

    const phase4 = await generateFlowAndTests(
      cfg.llm_api_base, cfg.llm_api_key, cfg.llm_model,
      playwrightCode, allMcpContext
    );

    // ---- Save results as chat messages ----
    const mcpMetadata = {
      playwrightCode,
      mcpContext: allMcpContext,
      testCases: phase4.testCases || [],
      businessLogic: phase4.businessLogic || [],
    };

    await req.supabase
      .from("test_suites")
      .update({ calculator_code: "", updated_at: new Date().toISOString() })
      .eq("id", suiteId);

    const { error: amErr } = await req.supabase
      .from("chat_messages")
      .insert({
        test_suite_id: suiteId,
        role: "assistant",
        content: phase4.chatMessage || phase4.flowDescription || "Analysis complete.",
        mode: "edit",
        metadata: mcpMetadata,
      });
    if (amErr) throw amErr;

    const { data: allMessages, error: msgErr } = await req.supabase
      .from("chat_messages")
      .select("id, role, content, mode, metadata, created_at")
      .eq("test_suite_id", suiteId)
      .order("created_at", { ascending: true });
    if (msgErr) throw msgErr;

    cleanupSession(sessionId);

    res.json({ messages: allMessages || [] });
  } catch (err) {
    console.error("Recorder analyze error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
