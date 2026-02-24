import { Router } from "express";
import { createCursorClient } from "../services/cursorAgent.js";
import { query } from "../db/index.js";

const router = Router();

router.post("/agent", async (req, res) => {
  try {
    const { prompt, repository, ref } = req.body;
    let apiKey = req.body.api_key || req.headers["x-cursor-api-key"];
    let repo = repository;
    if (!repo) {
      const repoRes = await query("SELECT value FROM configs WHERE key = $1", ["cursor_github_repo"]);
      repo = repoRes.rows[0]?.value;
    }
    if (!apiKey) {
      const configRes = await query("SELECT value FROM configs WHERE key = $1", ["cursor_api_key"]);
      apiKey = configRes.rows[0]?.value;
    }
    if (!repo) {
      return res.status(400).json({ error: "GitHub repo URL required. Add it in Setup tab." });
    }
    const client = createCursorClient(apiKey);
    const agent = await client.launchAgent({
      prompt,
      repository: repo,
      ref: ref || "main",
    });
    res.json(agent);
  } catch (err) {
    console.error("Cursor agent launch error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/agent/:id", async (req, res) => {
  try {
    let apiKey = req.headers["x-cursor-api-key"];
    if (!apiKey) {
      const configRes = await query("SELECT value FROM configs WHERE key = $1", ["cursor_api_key"]);
      apiKey = configRes.rows[0]?.value;
    }
    const client = createCursorClient(apiKey);
    const agent = await client.getAgentStatus(req.params.id);
    res.json(agent);
  } catch (err) {
    console.error("Cursor agent status error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/agent/:id/followup", async (req, res) => {
  try {
    const { prompt } = req.body;
    let apiKey = req.headers["x-cursor-api-key"];
    if (!apiKey) {
      const configRes = await query("SELECT value FROM configs WHERE key = $1", ["cursor_api_key"]);
      apiKey = configRes.rows[0]?.value;
    }
    const client = createCursorClient(apiKey);
    const result = await client.addFollowup(req.params.id, prompt);
    res.json(result);
  } catch (err) {
    console.error("Cursor followup error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
