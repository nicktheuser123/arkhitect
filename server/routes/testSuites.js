import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from("test_suites")
      .select("*")
      .order("name");
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error("Test suites GET error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: suite, error } = await req.supabase
      .from("test_suites")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    if (!suite) return res.status(404).json({ error: "Test suite not found" });

    const { data: versions } = await req.supabase
      .from("code_versions")
      .select("summary")
      .eq("test_suite_id", id)
      .order("version_number", { ascending: false })
      .limit(1);

    suite.summary = versions?.[0]?.summary ?? null;
    res.json(suite);
  } catch (err) {
    console.error("Test suite GET error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, description, calculator_code, logic_md, run_order_tests, run_reporting_daily_tests } = req.body;
    const { data, error } = await req.supabase
      .from("test_suites")
      .insert({
        name: name || "New Suite",
        description: description ?? "",
        calculator_code: calculator_code ?? "",
        logic_md: logic_md ?? "",
        run_order_tests: run_order_tests ?? true,
        run_reporting_daily_tests: run_reporting_daily_tests ?? true,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
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
      const { data: current } = await req.supabase
        .from("test_suites")
        .select("calculator_code")
        .eq("id", id)
        .single();

      if (current && current.calculator_code !== calculator_code) {
        const { data: maxRow } = await req.supabase
          .from("code_versions")
          .select("version_number")
          .eq("test_suite_id", id)
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextVersion = (maxRow?.version_number ?? 0) + 1;

        const { error: vErr } = await req.supabase
          .from("code_versions")
          .insert({
            test_suite_id: id,
            calculator_code,
            summary: summary || null,
            change_description: change_description || null,
            version_number: nextVersion,
            created_by: created_by || "user",
          });
        if (vErr) throw vErr;
      }
    }

    const updates = {};
    if (name != null) updates.name = name;
    if (description != null) updates.description = description;
    if (calculator_code != null) updates.calculator_code = calculator_code;
    if (logic_md != null) updates.logic_md = logic_md;
    if (run_order_tests != null) updates.run_order_tests = run_order_tests;
    if (run_reporting_daily_tests != null) updates.run_reporting_daily_tests = run_reporting_daily_tests;
    if (assumptions != null) updates.assumptions = assumptions;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await req.supabase
      .from("test_suites")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Test suite not found" });
    res.json(data);
  } catch (err) {
    console.error("Test suite PUT error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/confirm", async (req, res) => {
  try {
    const { id } = req.params;
    const { assumptions, change_description } = req.body;

    const { data: suite, error: sErr } = await req.supabase
      .from("test_suites")
      .select("calculator_code")
      .eq("id", id)
      .single();
    if (sErr) throw sErr;
    if (!suite) return res.status(404).json({ error: "Test suite not found" });

    const code = suite.calculator_code || "";
    if (code.trim()) {
      const { data: maxRow } = await req.supabase
        .from("code_versions")
        .select("version_number")
        .eq("test_suite_id", id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = (maxRow?.version_number ?? 0) + 1;

      const { error: vErr } = await req.supabase
        .from("code_versions")
        .insert({
          test_suite_id: id,
          calculator_code: code,
          change_description: change_description || "Confirmed assumptions and saved",
          version_number: nextVersion,
          created_by: "ai",
        });
      if (vErr) throw vErr;
    }

    const updates = { updated_at: new Date().toISOString() };
    if (assumptions != null) updates.assumptions = assumptions;

    const { data, error } = await req.supabase
      .from("test_suites")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Test suite confirm error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await req.supabase
      .from("test_suites")
      .delete()
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Test suite not found" });
    res.json({ ok: true, id: data.id });
  } catch (err) {
    console.error("Test suite DELETE error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
