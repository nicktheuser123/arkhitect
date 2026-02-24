import { Router } from "express";
import { query } from "../db/index.js";
import {
  generateTestCode,
  editTestCode,
  summarizeTestCode,
} from "../services/llm.js";

const router = Router();

async function loadLLMConfig() {
  const result = await query(
    "SELECT key, value FROM configs WHERE key IN ('llm_api_base', 'llm_api_key', 'llm_model')"
  );
  const cfg = Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
  if (!cfg.llm_api_base || !cfg.llm_api_key || !cfg.llm_model) {
    return null;
  }
  return cfg;
}

router.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    const cfg = await loadLLMConfig();
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
    const { code, instruction } = req.body;
    if (!code || !instruction) return res.status(400).json({ error: "code and instruction are required" });

    const cfg = await loadLLMConfig();
    if (!cfg) return res.status(400).json({ error: "LLM not configured. Set API Base, Key, and Model in Setup." });

    const result = await editTestCode(cfg.llm_api_base, cfg.llm_api_key, cfg.llm_model, code, instruction);
    res.json(result);
  } catch (err) {
    console.error("AI edit error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/summarize", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "code is required" });

    const cfg = await loadLLMConfig();
    if (!cfg) return res.status(400).json({ error: "LLM not configured. Set API Base, Key, and Model in Setup." });

    const result = await summarizeTestCode(cfg.llm_api_base, cfg.llm_api_key, cfg.llm_model, code);
    res.json(result);
  } catch (err) {
    console.error("AI summarize error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
