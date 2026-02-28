import { Router } from "express";

const router = Router();

router.get("/:id/versions", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await req.supabase
      .from("code_versions")
      .select("id, version_number, summary, change_description, created_by, created_at")
      .eq("test_suite_id", id)
      .order("version_number", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error("Code versions GET error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/versions/:vid", async (req, res) => {
  try {
    const { id, vid } = req.params;
    const { data, error } = await req.supabase
      .from("code_versions")
      .select("*")
      .eq("id", vid)
      .eq("test_suite_id", id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Version not found" });
    res.json(data);
  } catch (err) {
    console.error("Code version GET error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/versions/:vid/restore", async (req, res) => {
  try {
    const { id, vid } = req.params;

    const { data: version, error: vErr } = await req.supabase
      .from("code_versions")
      .select("*")
      .eq("id", vid)
      .eq("test_suite_id", id)
      .single();
    if (vErr || !version) {
      return res.status(404).json({ error: "Version not found" });
    }

    const { error: uErr } = await req.supabase
      .from("test_suites")
      .update({ calculator_code: version.calculator_code, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (uErr) throw uErr;

    const { data: maxRow } = await req.supabase
      .from("code_versions")
      .select("version_number")
      .eq("test_suite_id", id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (maxRow?.version_number ?? 0) + 1;

    const { error: iErr } = await req.supabase
      .from("code_versions")
      .insert({
        test_suite_id: id,
        calculator_code: version.calculator_code,
        summary: version.summary,
        change_description: `Restored from v${version.version_number}`,
        version_number: nextVersion,
        created_by: "user",
      });
    if (iErr) throw iErr;

    const { data: suite } = await req.supabase
      .from("test_suites")
      .select("*")
      .eq("id", id)
      .single();

    res.json({ ...suite, summary: version.summary });
  } catch (err) {
    console.error("Code version restore error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
