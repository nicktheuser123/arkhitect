import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from("configs")
      .select("key, value")
      .order("key");
    if (error) throw error;
    const config = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
    res.json(config);
  } catch (err) {
    console.error("Config GET error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/", async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) {
      return res.status(400).json({ error: "key is required" });
    }
    const { error } = await req.supabase
      .from("configs")
      .upsert(
        { key, value: value ?? "", updated_at: new Date().toISOString() },
        { onConflict: "key,user_id" }
      );
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error("Config PUT error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/batch", async (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "body must be array of {key, value}" });
    }
    const rows = items
      .filter((i) => i.key)
      .map((i) => ({ key: i.key, value: i.value ?? "", updated_at: new Date().toISOString() }));

    if (rows.length > 0) {
      const { error } = await req.supabase
        .from("configs")
        .upsert(rows, { onConflict: "key,user_id" });
      if (error) throw error;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Config batch error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
