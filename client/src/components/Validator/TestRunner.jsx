import { useState, useEffect, useRef, useCallback } from "react";
import {
  runTest,
  getTestRun,
  getTestRuns,
} from "../../api";
import StepTrace from "./StepTrace";

const POLL_INTERVAL = 1500;

export default function TestRunner({ selectedSuite, entityId, suites, onFeedback, onDisplayRunChange }) {
  const [running, setRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState(null);
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState("");
  const [logsExpanded, setLogsExpanded] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (!selectedSuite) return;
    getTestRuns(selectedSuite).then(setRuns).catch(() => {});
  }, [selectedSuite]);

  const handleRun = useCallback(async () => {
    if (!selectedSuite || !entityId.trim()) {
      setError("Select a test suite and enter Entity ID (Order ID) above.");
      return;
    }
    setError("");
    setRunning(true);
    if (pollRef.current) clearInterval(pollRef.current);
    try {
      const run = await runTest(selectedSuite, entityId.trim());
      setCurrentRun(run);
      pollRef.current = setInterval(async () => {
        try {
          const updated = await getTestRun(run.id);
          setCurrentRun(updated);
          if (updated.status !== "running" && updated.status !== "pending") {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setRunning(false);
            getTestRuns(selectedSuite).then(setRuns).catch(() => {});
          }
        } catch (_) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setRunning(false);
        }
      }, POLL_INTERVAL);
    } catch (e) {
      setError(e.message);
      setRunning(false);
    }
  }, [selectedSuite, entityId]);

  const displayRun = currentRun || (runs[0] ? runs[0] : null);
  const results = displayRun?.expected_vs_received || [];

  useEffect(() => {
    onDisplayRunChange?.(displayRun);
  }, [displayRun, onDisplayRunChange]);
  const traceSteps = displayRun?.trace_steps || [];
  const suiteName = suites?.find((s) => s.id === selectedSuite)?.name;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div style={{ padding: "0.75rem", overflowX: "hidden", overflowY: "auto", flex: 1, minHeight: 0 }} className="scrollbar-overlay">
        <button
          className="btn"
          onClick={handleRun}
          disabled={running}
          style={{ width: "100%" }}
        >
          {running ? "Running..." : "Run Test"}
        </button>

        {error && (
          <p style={{ marginTop: "1rem", color: "var(--error)", fontSize: "13px" }}>
            {error}
          </p>
        )}

        {displayRun && (
          <div style={{ marginTop: "1rem" }}>
            <div className="summary">
              <span className={displayRun.passed_count > 0 ? "passed" : ""}>
                Passed: {displayRun.passed_count ?? 0}
              </span>
              <span className={displayRun.failed_count > 0 ? "failed" : ""}>
                Failed: {displayRun.failed_count ?? 0}
              </span>
              <span>Status: {displayRun.status}</span>
            </div>

            {(traceSteps.length > 0 || results.length > 0) && (
              <StepTrace
                traceSteps={traceSteps}
                assertions={results}
                suiteName={suiteName}
                onFeedback={onFeedback}
              />
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
                  <span>Raw Logs</span>
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
