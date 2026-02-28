import { Router } from "express";
import {
  generateTestCode,
  editTestCode,
  refineTestCode,
  askAboutTest,
} from "../services/llm.js";

const router = Router();

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

async function loadSuiteCode(supabase, suiteId) {
  const { data, error } = await supabase
    .from("test_suites")
    .select("calculator_code")
    .eq("id", suiteId)
    .single();
  if (error) throw error;
  return data?.calculator_code || "";
}

async function saveSuiteCode(supabase, suiteId, code) {
  const { error } = await supabase
    .from("test_suites")
    .update({ calculator_code: code, updated_at: new Date().toISOString() })
    .eq("id", suiteId);
  if (error) throw error;
}

router.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    const cfg = await loadLLMConfig(req.supabase);
    if (!cfg) return res.status(400).json({ error: "LLM not configured. Set API Base, Key, and Model in Setup." });

    const result = await generateTestCode(cfg.llm_api_base, cfg.llm_api_key, cfg.llm_model, prompt);
    res.json(result);
  } catch (err) {
    console.error("AI generate error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/edit", async (req, res) => {
  try {
    const { suiteId, instruction } = req.body;
    if (!suiteId || !instruction) {
      return res.status(400).json({ error: "suiteId and instruction are required" });
    }

    const cfg = await loadLLMConfig(req.supabase);
    if (!cfg) return res.status(400).json({ error: "LLM not configured. Set API Base, Key, and Model in Setup." });

    const code = await loadSuiteCode(req.supabase, suiteId);
    const result = await editTestCode(cfg.llm_api_base, cfg.llm_api_key, cfg.llm_model, code, instruction);

    if (result.code) {
      await saveSuiteCode(req.supabase, suiteId, result.code);
    }

    res.json({ assumptions: result.assumptions || [] });
  } catch (err) {
    console.error("AI edit error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/refine", async (req, res) => {
  try {
    const { suiteId, corrections } = req.body;
    if (!suiteId || !corrections || !corrections.length) {
      return res.status(400).json({ error: "suiteId and corrections are required" });
    }

    const cfg = await loadLLMConfig(req.supabase);
    if (!cfg) return res.status(400).json({ error: "LLM not configured. Set API Base, Key, and Model in Setup." });

    const code = await loadSuiteCode(req.supabase, suiteId);
    const result = await refineTestCode(cfg.llm_api_base, cfg.llm_api_key, cfg.llm_model, code, corrections);

    if (result.code) {
      await saveSuiteCode(req.supabase, suiteId, result.code);
    }

    res.json({ assumptions: result.assumptions || [] });
  } catch (err) {
    console.error("AI refine error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/ask", async (req, res) => {
  try {
    const { suiteId, question, testContext } = req.body;
    if (!question) return res.status(400).json({ error: "question is required" });

    const cfg = await loadLLMConfig(req.supabase);
    if (!cfg) return res.status(400).json({ error: "LLM not configured. Set API Base, Key, and Model in Setup." });

    const code = suiteId ? await loadSuiteCode(req.supabase, suiteId) : "";
    const result = await askAboutTest(
      cfg.llm_api_base, cfg.llm_api_key, cfg.llm_model,
      code, question, testContext || {}
    );
    res.json(result);
  } catch (err) {
    console.error("AI ask error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
