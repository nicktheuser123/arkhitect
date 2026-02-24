import { Router } from "express";
import { query } from "../db/index.js";

const router = Router();

router.get("/:id/versions", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT id, version_number, summary, change_description, created_by, created_at
       FROM code_versions
       WHERE test_suite_id = $1
       ORDER BY version_number DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Code versions GET error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/versions/:vid", async (req, res) => {
  try {
    const { id, vid } = req.params;
    const result = await query(
      `SELECT * FROM code_versions WHERE id = $1 AND test_suite_id = $2`,
      [vid, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Version not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Code version GET error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/versions/:vid/restore", async (req, res) => {
  try {
    const { id, vid } = req.params;

    const versionResult = await query(
      `SELECT * FROM code_versions WHERE id = $1 AND test_suite_id = $2`,
      [vid, id]
    );
    if (versionResult.rows.length === 0) {
      return res.status(404).json({ error: "Version not found" });
    }
    const version = versionResult.rows[0];

    await query(
      `UPDATE test_suites SET calculator_code = $2, updated_at = NOW() WHERE id = $1`,
      [id, version.calculator_code]
    );

    const maxResult = await query(
      `SELECT COALESCE(MAX(version_number), 0) AS max_v FROM code_versions WHERE test_suite_id = $1`,
      [id]
    );
    const nextVersion = maxResult.rows[0].max_v + 1;

    await query(
      `INSERT INTO code_versions (test_suite_id, calculator_code, summary, change_description, version_number, created_by)
       VALUES ($1, $2, $3, $4, $5, 'user')`,
      [
        id,
        version.calculator_code,
        version.summary,
        `Restored from v${version.version_number}`,
        nextVersion,
      ]
    );

    const suiteResult = await query("SELECT * FROM test_suites WHERE id = $1", [id]);
    res.json({ ...suiteResult.rows[0], summary: version.summary });
  } catch (err) {
    console.error("Code version restore error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
