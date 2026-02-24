import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import {
  getConfig,
  getTestSuite,
  updateTestSuite,
  executeCode,
  launchCursorAgent,
} from "../../api";

export default function TestEditor({
  selectedSuite,
  entityId,
  suites,
}) {
  const [suite, setSuite] = useState(null);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [execOutput, setExecOutput] = useState(null);
  const [chatPrompt, setChatPrompt] = useState("");
  const [cursorStatus, setCursorStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedSuite) {
      setSuite(null);
      setCode("");
      return;
    }
    getTestSuite(selectedSuite)
      .then((s) => {
        setSuite(s);
        setCode(s.calculator_code || "// Calculator logic\n");
      })
      .catch(setError);
  }, [selectedSuite]);

  const handleSave = async () => {
    if (!selectedSuite) return;
    setSaving(true);
    setError("");
    try {
      await updateTestSuite(selectedSuite, { calculator_code: code });
      setSuite((s) => (s ? { ...s, calculator_code: code } : null));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setExecOutput(null);
    setError("");
    try {
      const result = await executeCode(code, entityId.trim() || undefined);
      setExecOutput(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const handleCursorPrompt = async () => {
    if (!chatPrompt.trim()) return;
    setCursorStatus("Launching Cursor agent…");
    setError("");
    try {
      const config = await getConfig();
      const agent = await launchCursorAgent(chatPrompt, config.cursor_github_repo);
      setCursorStatus(
        `Agent launched: ${agent.id}. Check Cursor dashboard for results.`
      );
    } catch (e) {
      setError(e.message);
      setCursorStatus("");
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: "1rem", fontSize: "1.25rem", fontWeight: 500 }}>
        Test Editor
      </h2>

      {error && (
        <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "1rem" }}>
          {error}
        </p>
      )}

      {selectedSuite && (
        <>
          <div
            style={{
              display: "flex",
              gap: "1rem",
              marginBottom: "1rem",
              alignItems: "flex-end",
            }}
          >
            <button className="btn btn-secondary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn" onClick={handleRun} disabled={running}>
              {running ? "Running…" : "Run Code"}
            </button>
          </div>

          <div style={{ border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
            <Editor
              height="400px"
              language="javascript"
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
              }}
            />
          </div>

          <div style={{ marginTop: "1.5rem" }}>
            <label>Cursor AI (prompt to update code)</label>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
              <input
                type="text"
                placeholder="e.g. Add validation for zero order value"
                value={chatPrompt}
                onChange={(e) => setChatPrompt(e.target.value)}
              />
              <button className="btn btn-secondary" onClick={handleCursorPrompt}>
                Send
              </button>
            </div>
            {cursorStatus && (
              <p style={{ marginTop: "0.5rem", color: "var(--text-muted)", fontSize: 12 }}>
                {cursorStatus}
              </p>
            )}
          </div>

          {execOutput && (
            <div style={{ marginTop: "1.5rem" }}>
              <label>Execution output</label>
              <pre className="log-output">
                {execOutput.stdout || "(no stdout)"}
                {execOutput.stderr ? `\n\n--- stderr ---\n${execOutput.stderr}` : ""}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
