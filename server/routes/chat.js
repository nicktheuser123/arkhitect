import { Router } from "express";
import {
  generateTestCode,
  editTestCode,
  askAboutTest,
} from "../services/llm.js";

const router = Router();

const MAX_HISTORY_MESSAGES = 20;

async function loadLLMConfig(supabase) {
  const { data, error } = await supabase
    .from("configs")
    .select("key, value")
    .in("key", ["llm_api_base", "llm_api_key", "llm_model"]);
  if (error) return null;
  const cfg = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  if (!cfg.llm_api_base || !cfg.llm_api_key || !cfg.llm_model) return null;
  return cfg;
}

async function loadChatHistory(supabase, suiteId) {
  const { data } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("test_suite_id", suiteId)
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY_MESSAGES);
  return (data || []).reverse();
}

router.get("/:suiteId", async (req, res) => {
  try {
    const { suiteId } = req.params;
    const { data, error } = await req.supabase
      .from("chat_messages")
      .select("id, role, content, mode, metadata, created_at")
      .eq("test_suite_id", suiteId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error("Chat GET error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/:suiteId/send", async (req, res) => {
  try {
    const { suiteId } = req.params;
    const { mode, content, testContext, confirmedAssumptions = [] } = req.body;

    if (!content || !mode) {
      return res.status(400).json({ error: "content and mode are required" });
    }
    if (mode !== "edit" && mode !== "ask") {
      return res.status(400).json({ error: "mode must be 'edit' or 'ask'" });
    }

    const cfg = await loadLLMConfig(req.supabase);
    if (!cfg) {
      return res.status(400).json({ error: "LLM not configured. Set API Base, Key, and Model in Setup." });
    }

    const { data: suite, error: sErr } = await req.supabase
      .from("test_suites")
      .select("calculator_code")
      .eq("id", suiteId)
      .single();
    if (sErr) throw sErr;
    const code = suite?.calculator_code || "";

    const history = await loadChatHistory(req.supabase, suiteId);
    const historyContext = history.length > 0
      ? "\n\nPrevious conversation:\n" + history.map(m => `${m.role}: ${m.content}`).join("\n")
      : "";

    let assistantContent = "";
    let assumptions = null;
    let hasCode = !!code.trim();

    if (mode === "edit") {
      let result;
      const instructionWithHistory = content + historyContext;
      if (code.trim()) {
        result = await editTestCode(cfg.llm_api_base, cfg.llm_api_key, cfg.llm_model, code, instructionWithHistory, confirmedAssumptions);
      } else {
        result = await generateTestCode(cfg.llm_api_base, cfg.llm_api_key, cfg.llm_model, instructionWithHistory);
      }
      assumptions = result.assumptions || [];
      assistantContent = result.changeDescription || "I've updated the test code.";
      if (assumptions.length > 0) {
        assistantContent += " Please review the assumptions below.";
      }

      if (result.code) {
        const codeChanged = result.code !== code;
        const { error: uErr } = await req.supabase
          .from("test_suites")
          .update({ calculator_code: result.code, updated_at: new Date().toISOString() })
          .eq("id", suiteId);
        if (uErr) throw uErr;
        hasCode = true;

        if (codeChanged) {
          const { data: maxRow } = await req.supabase
            .from("code_versions")
            .select("version_number")
            .eq("test_suite_id", suiteId)
            .order("version_number", { ascending: false })
            .limit(1)
            .maybeSingle();

          await req.supabase
            .from("code_versions")
            .insert({
              test_suite_id: suiteId,
              calculator_code: result.code,
              change_description: result.changeDescription || "Chat edit",
              version_number: (maxRow?.version_number ?? 0) + 1,
              created_by: "ai",
            });
        }
      }
    } else {
      const questionWithHistory = content + historyContext;
      const result = await askAboutTest(
        cfg.llm_api_base, cfg.llm_api_key, cfg.llm_model,
        code, questionWithHistory, testContext || {}
      );
      assistantContent = result.answer;
    }

    const { error: umErr } = await req.supabase
      .from("chat_messages")
      .insert({ test_suite_id: suiteId, role: "user", content, mode });
    if (umErr) throw umErr;

    const { error: amErr } = await req.supabase
      .from("chat_messages")
      .insert({
        test_suite_id: suiteId,
        role: "assistant",
        content: assistantContent,
        mode,
        metadata: mode === "edit" && assumptions && assumptions.length > 0
          ? { changeDescription: assistantContent }
          : null,
      });
    if (amErr) throw amErr;

    const { data: allMessages, error: aErr } = await req.supabase
      .from("chat_messages")
      .select("id, role, content, mode, metadata, created_at")
      .eq("test_suite_id", suiteId)
      .order("created_at", { ascending: true });
    if (aErr) throw aErr;

    res.json({
      messages: allMessages || [],
      assumptions: assumptions ?? undefined,
      hasCode,
    });
  } catch (err) {
    console.error("Chat send error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
