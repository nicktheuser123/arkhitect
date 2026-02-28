import { Router } from "express";
import { executeTest } from "../services/testRunner.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { suite_id } = req.query;
    let query = req.supabase
      .from("test_runs")
      .select("*, test_suites(name)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (suite_id) {
      query = query.eq("test_suite_id", suite_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []).map(({ test_suites: ts, ...rest }) => ({
      ...rest,
      suite_name: ts?.name,
    }));
    res.json(rows);
  } catch (err) {
    console.error("Test runs GET error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await req.supabase
      .from("test_runs")
      .select("*, test_suites(name)")
      .eq("id", id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Test run not found" });

    const { test_suites: ts, ...rest } = data;
    res.json({ ...rest, suite_name: ts?.name });
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

    const { data: suite, error: sErr } = await req.supabase
      .from("test_suites")
      .select("*")
      .eq("id", suite_id)
      .single();
    if (sErr || !suite) {
      return res.status(404).json({ error: "Test suite not found" });
    }

    const { data: cfgRows } = await req.supabase
      .from("configs")
      .select("key, value");
    const config = Object.fromEntries((cfgRows || []).map((r) => [r.key, r.value]));

    const { data: run, error: rErr } = await req.supabase
      .from("test_runs")
      .insert({ test_suite_id: suite_id, entity_id, status: "running" })
      .select()
      .single();
    if (rErr) throw rErr;
    res.status(202).json(run);

    executeTest(run.id, suite, entity_id, config).catch((err) => {
      console.error("Background test execution error:", err);
    });
  } catch (err) {
    console.error("Test run POST error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
