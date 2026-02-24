import { Router } from "express";
import { query } from "../db/index.js";
import { executeTest } from "../services/testRunner.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { suite_id } = req.query;
    let sql = "SELECT tr.*, ts.name as suite_name FROM test_runs tr JOIN test_suites ts ON ts.id = tr.test_suite_id ORDER BY tr.created_at DESC LIMIT 100";
    const params = [];
    if (suite_id) {
      sql = "SELECT tr.*, ts.name as suite_name FROM test_runs tr JOIN test_suites ts ON ts.id = tr.test_suite_id WHERE tr.test_suite_id = $1 ORDER BY tr.created_at DESC LIMIT 100";
      params.push(suite_id);
    }
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Test runs GET error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      "SELECT tr.*, ts.name as suite_name FROM test_runs tr JOIN test_suites ts ON ts.id = tr.test_suite_id WHERE tr.id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Test run not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Test run GET error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { suite_id, entity_id } = req.body;
    if (!suite_id || !entity_id) {
      return res.status(400).json({ error: "suite_id and entity_id required" });
    }

    const suiteRes = await query(
      "SELECT * FROM test_suites WHERE id = $1",
      [suite_id]
    );
    if (suiteRes.rows.length === 0) {
      return res.status(404).json({ error: "Test suite not found" });
    }

    const configRes = await query("SELECT key, value FROM configs");
    const config = Object.fromEntries(configRes.rows.map((r) => [r.key, r.value]));

    const insertRes = await query(
      `INSERT INTO test_runs (test_suite_id, entity_id, status) VALUES ($1, $2, 'running') RETURNING *`,
      [suite_id, entity_id]
    );
    const run = insertRes.rows[0];
    res.status(202).json(run);

    executeTest(run.id, suiteRes.rows[0], entity_id, config).catch((err) => {
      console.error("Background test execution error:", err);
    });
  } catch (err) {
    console.error("Test run POST error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
