import { useState, useEffect } from "react";
import { getConfig, saveConfig } from "../api";

export default function Setup() {
  const [config, setConfig] = useState({
    bubble_api_base: "",
    bubble_api_token: "",
    llm_api_base: "",
    llm_api_key: "",
    llm_model: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getConfig()
      .then(setConfig)
      .catch((e) => setMessage(e.message));
  }, []);

  const handleChange = (key, value) => {
    setConfig((c) => ({ ...c, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await saveConfig(config);
      setMessage("Saved.");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h2 style={{ marginBottom: "1.5rem", fontSize: "1.25rem", fontWeight: 500 }}>
        Onboarding &amp; configuration
      </h2>

      <div className="form-group">
        <label>Bubble API Base URL</label>
        <input
          type="url"
          placeholder="https://your-app.bubbleapps.io/api/1.1/obj"
          value={config.bubble_api_base || ""}
          onChange={(e) => handleChange("bubble_api_base", e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Bubble API Token</label>
        <input
          type="password"
          placeholder="Your Bubble API token"
          value={config.bubble_api_token || ""}
          onChange={(e) => handleChange("bubble_api_token", e.target.value)}
        />
      </div>

      <h3 style={{ marginTop: "2rem", marginBottom: "1rem", fontSize: "1rem", fontWeight: 500, color: "var(--text-muted)" }}>
        LLM Configuration (for Test Builder AI)
      </h3>

      <div className="form-group">
        <label>LLM API Base URL</label>
        <input
          type="url"
          placeholder="https://api.openai.com/v1"
          value={config.llm_api_base || ""}
          onChange={(e) => handleChange("llm_api_base", e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>LLM API Key</label>
        <input
          type="password"
          placeholder="Your API key"
          value={config.llm_api_key || ""}
          onChange={(e) => handleChange("llm_api_key", e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>LLM Model</label>
        <input
          type="text"
          placeholder="gpt-4o"
          value={config.llm_model || ""}
          onChange={(e) => handleChange("llm_model", e.target.value)}
        />
      </div>

      <button className="btn" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>

      {message && (
        <p style={{ marginTop: "1rem", color: "var(--text-muted)", fontSize: "13px" }}>
          {message}
        </p>
      )}
    </section>
  );
}
