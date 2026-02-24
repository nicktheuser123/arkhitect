import { useState, useEffect } from "react";
import {
  runTest,
  getTestRun,
  getTestRuns,
} from "../../api";

const POLL_INTERVAL = 1500;

export default function TestRunner({ selectedSuite, entityId, suites }) {
  const [running, setRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState(null);
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState("");
  const [logsExpanded, setLogsExpanded] = useState(false);

  useEffect(() => {
    if (!selectedSuite) return;
    getTestRuns(selectedSuite).then(setRuns).catch(() => {});
  }, [selectedSuite]);

  const handleRun = async () => {
    if (!selectedSuite || !entityId.trim()) {
      setError("Select a test suite and enter Entity ID (Order ID) above.");
      return;
    }
    setError("");
    setRunning(true);
    try {
      const run = await runTest(selectedSuite, entityId.trim());
      setCurrentRun(run);
      const poll = setInterval(async () => {
        const updated = await getTestRun(run.id);
        setCurrentRun(updated);
        if (updated.status !== "running" && updated.status !== "pending") {
          clearInterval(poll);
          setRunning(false);
          getTestRuns(selectedSuite).then(setRuns).catch(() => {});
        }
      }, POLL_INTERVAL);
    } catch (e) {
      setError(e.message);
      setRunning(false);
    }
  };

  const displayRun = currentRun || (runs[0] ? runs[0] : null);
  const results = displayRun?.expected_vs_received || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div style={{ padding: "0.75rem", overflowX: "hidden", overflowY: "auto", flex: 1, minHeight: 0 }} className="scrollbar-overlay">
        <button
          className="btn"
          onClick={handleRun}
          disabled={running}
          style={{ width: "100%" }}
        >
          {running ? "Running…" : "Run Test"}
        </button>

        {error && (
          <p style={{ marginTop: "1rem", color: "var(--error)", fontSize: "13px" }}>
            {error}
          </p>
        )}

        {displayRun && (
          <div style={{ marginTop: "2rem" }}>
            <div className="summary">
              <span className={displayRun.passed_count > 0 ? "passed" : ""}>
                Passed: {displayRun.passed_count ?? 0}
              </span>
              <span className={displayRun.failed_count > 0 ? "failed" : ""}>
                Failed: {displayRun.failed_count ?? 0}
              </span>
              <span>Status: {displayRun.status}</span>
            </div>

          {results.length > 0 && (
            <table className="result-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Expected</th>
                  <th>Received</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.label}</td>
                    <td>{String(r.expected ?? "")}</td>
                    <td>{String(r.received ?? "")}</td>
                    <td className={r.pass ? "pass" : "fail"}>
                      {r.pass ? "PASS" : "FAIL"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {displayRun.logs && (
            <div style={{ marginTop: "1rem" }}>
              <div
                onClick={() => setLogsExpanded(!logsExpanded)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  padding: "0.35rem 0",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                  fontWeight: 500,
                }}
              >
                <span>Logs</span>
                <span style={{ fontSize: "10px" }}>
                  {logsExpanded ? "▼" : "▶"}
                </span>
              </div>
              {logsExpanded && (
                <pre className="log-output">{displayRun.logs}</pre>
              )}
            </div>
          )}

          {displayRun.error_message && displayRun.status === "error" && (
            <pre
              className="log-output"
              style={{ color: "var(--error)", marginTop: "1rem" }}
            >
              {displayRun.error_message}
            </pre>
          )}
          </div>
        )}
      </div>
    </div>
  );
}
