import { Router } from "express";
import { createCursorClient } from "../services/cursorAgent.js";

const router = Router();

router.post("/agent", async (req, res) => {
  try {
    const { prompt, repository, ref } = req.body;
    let apiKey = req.body.api_key || req.headers["x-cursor-api-key"];
    let repo = repository;
    if (!repo) {
      const { data } = await req.supabase
        .from("configs")
        .select("value")
        .eq("key", "cursor_github_repo")
        .maybeSingle();
      repo = data?.value;
    }
    if (!apiKey) {
      const { data } = await req.supabase
        .from("configs")
        .select("value")
        .eq("key", "cursor_api_key")
        .maybeSingle();
      apiKey = data?.value;
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
      const { data } = await req.supabase
        .from("configs")
        .select("value")
        .eq("key", "cursor_api_key")
        .maybeSingle();
      apiKey = data?.value;
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
      const { data } = await req.supabase
        .from("configs")
        .select("value")
        .eq("key", "cursor_api_key")
        .maybeSingle();
      apiKey = data?.value;
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
