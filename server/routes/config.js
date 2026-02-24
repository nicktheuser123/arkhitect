import { Router } from "express";
import { query } from "../db/index.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const result = await query(
      "SELECT key, value FROM configs ORDER BY key"
    );
    const config = Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
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
    await query(
      `INSERT INTO configs (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value ?? ""]
    );
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
    for (const { key, value } of items) {
      if (key) {
        await query(
          `INSERT INTO configs (key, value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, value ?? ""]
        );
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Config batch error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
