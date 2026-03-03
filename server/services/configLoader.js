export async function loadLLMConfig(supabase) {
  const { data, error } = await supabase
    .from("configs")
    .select("key, value")
    .in("key", ["llm_api_base", "llm_api_key", "llm_model"]);
  if (error) return null;
  const cfg = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  if (!cfg.llm_api_base || !cfg.llm_api_key || !cfg.llm_model) return null;
  return cfg;
}
