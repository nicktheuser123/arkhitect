import { Router } from "express";
import {
  generateTestCode,
  editTestCode,
  askAboutTest,
} from "../services/llm.js";
import { loadLLMConfig } from "../services/configLoader.js";

const router = Router();

async function loadSuiteCode(supabase, suiteId) {
  const { data, error } = await supabase
    .from("test_suites")
    .select("calculator_code")
    .eq("id", suiteId)
    .single();
  if (error) throw error;
  return data?.calculator_code || "";
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
      const { error: uErr } = await req.supabase
        .from("test_suites")
        .update({ calculator_code: result.code, updated_at: new Date().toISOString() })
        .eq("id", suiteId);
      if (uErr) throw uErr;
    }

    res.json({ changeDescription: result.changeDescription });
  } catch (err) {
    console.error("AI edit error:", err);
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
