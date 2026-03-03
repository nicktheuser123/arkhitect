import { useState, useEffect } from "react";
import { getConfig, saveConfig, listBuildprintApps } from "../api";

export default function Setup() {
  const [config, setConfig] = useState({
    bubble_api_base: "",
    bubble_api_token: "",
    llm_api_base: "",
    llm_api_key: "",
    llm_model: "",
    buildprint_mcp_url: "",
    buildprint_app_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [bpApps, setBpApps] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);

  useEffect(() => {
    getConfig()
      .then((serverConfig) => setConfig((prev) => ({ ...prev, ...serverConfig })))
      .catch((e) => setMessage(e.message));
  }, []);

  useEffect(() => {
    if (config.buildprint_mcp_url) {
      fetchBpApps(config.buildprint_mcp_url);
    } else {
      setBpApps([]);
    }
  }, [config.buildprint_mcp_url]);

  const fetchBpApps = async (mcpUrl) => {
    if (!mcpUrl) return;
    setLoadingApps(true);
    try {
      const apps = await listBuildprintApps(mcpUrl);
      setBpApps(apps || []);
    } catch {
      setBpApps([]);
    } finally {
      setLoadingApps(false);
    }
  };

  const handleChange = (key, value) => {
    setConfig((c) => ({ ...c, [key]: value }));
  };

  const handleMcpUrlBlur = () => {
    if (config.buildprint_mcp_url) {
      fetchBpApps(config.buildprint_mcp_url);
    }
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

      <h3 style={{ marginTop: "2rem", marginBottom: "1rem", fontSize: "1rem", fontWeight: 500, color: "var(--text-muted)" }}>
        Buildprint MCP (for App Context)
      </h3>

      <div className="form-group">
        <label>Buildprint MCP URL</label>
        <input
          type="url"
          placeholder="https://mcp.buildprint.ai/bp_..."
          value={config.buildprint_mcp_url || ""}
          onChange={(e) => handleChange("buildprint_mcp_url", e.target.value)}
          onBlur={handleMcpUrlBlur}
        />
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          The MCP server URL with your access token
        </span>
      </div>

      <div className="form-group">
        <label>Buildprint App</label>
        {bpApps.length > 0 ? (
          <select
            value={config.buildprint_app_id || ""}
            onChange={(e) => handleChange("buildprint_app_id", e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="">Select an app...</option>
            {bpApps.map((app) => (
              <option key={app.appId} value={app.appId}>
                {app.name} ({app.appId})
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            placeholder={loadingApps ? "Loading apps..." : "Enter MCP URL first, or type app ID"}
            value={config.buildprint_app_id || ""}
            onChange={(e) => handleChange("buildprint_app_id", e.target.value)}
            disabled={loadingApps}
          />
        )}
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          {loadingApps ? "Fetching available apps..." : "The Bubble app to analyze"}
        </span>
      </div>

      <button className="btn" onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>

      {message && (
        <p style={{ marginTop: "1rem", color: "var(--text-muted)", fontSize: "13px" }}>
          {message}
        </p>
      )}
    </section>
  );
}
