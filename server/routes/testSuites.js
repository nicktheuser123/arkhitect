import { Router } from "express";
import { query } from "../db/index.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const result = await query(
      "SELECT * FROM test_suites ORDER BY name"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Test suites GET error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT s.*,
        (SELECT summary FROM code_versions
         WHERE test_suite_id = s.id
         ORDER BY version_number DESC
         LIMIT 1) AS summary
       FROM test_suites s
       WHERE s.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Test suite not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Test suite GET error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, description, calculator_code, logic_md, run_order_tests, run_reporting_daily_tests } = req.body;
    const result = await query(
      `INSERT INTO test_suites (name, description, calculator_code, logic_md, run_order_tests, run_reporting_daily_tests)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name || "New Suite",
        description ?? "",
        calculator_code ?? "",
        logic_md ?? "",
        run_order_tests ?? true,
        run_reporting_daily_tests ?? true,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Test suite POST error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, description, calculator_code, logic_md,
      run_order_tests, run_reporting_daily_tests,
      created_by, change_description, summary, assumptions,
    } = req.body;

    if (calculator_code != null) {
      const current = await query("SELECT calculator_code FROM test_suites WHERE id = $1", [id]);
      if (current.rows.length > 0 && current.rows[0].calculator_code !== calculator_code) {
        const maxResult = await query(
          "SELECT COALESCE(MAX(version_number), 0) AS max_v FROM code_versions WHERE test_suite_id = $1",
          [id]
        );
        const nextVersion = maxResult.rows[0].max_v + 1;
        await query(
          `INSERT INTO code_versions (test_suite_id, calculator_code, summary, change_description, version_number, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, calculator_code, summary || null, change_description || null, nextVersion, created_by || "user"]
        );
      }
    }

    const result = await query(
      `UPDATE test_suites SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        calculator_code = COALESCE($4, calculator_code),
        logic_md = COALESCE($5, logic_md),
        run_order_tests = COALESCE($6, run_order_tests),
        run_reporting_daily_tests = COALESCE($7, run_reporting_daily_tests),
        assumptions = COALESCE($8, assumptions),
        updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, name, description, calculator_code, logic_md, run_order_tests, run_reporting_daily_tests,
       assumptions ? JSON.stringify(assumptions) : null]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Test suite not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Test suite PUT error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      "DELETE FROM test_suites WHERE id = $1 RETURNING id",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Test suite not found" });
    }
    res.json({ ok: true, id });
  } catch (err) {
    console.error("Test suite DELETE error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
