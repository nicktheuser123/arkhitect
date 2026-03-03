import { useState, useEffect, useRef, useCallback } from "react";
import {
  startRecording,
  subscribeRecordingEvents,
  stopRecordingSession,
  analyzeRecording,
} from "../../api";

const STATES = {
  IDLE: "idle",
  RECORDING: "recording",
  COMPLETED: "completed",
  ANALYZING: "analyzing",
  ERROR: "error",
};

export default function RecordFlow({ suiteId, bubbleAppUrl, onAnalyzed, onError }) {
  const [state, setState] = useState(STATES.IDLE);
  const [sessionId, setSessionId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const eventSourceRef = useRef(null);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setState(STATES.IDLE);
    setSessionId(null);
    setErrorMsg("");
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, [suiteId]);

  const handleStart = useCallback(async () => {
    setErrorMsg("");
    onError?.("");
    try {
      const { sessionId: sid } = await startRecording(suiteId);
      setSessionId(sid);
      setState(STATES.RECORDING);

      const es = await subscribeRecordingEvents(sid);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "completed") {
            setState(STATES.COMPLETED);
          } else if (data.type === "error") {
            setState(STATES.ERROR);
            setErrorMsg(data.message || "Recording failed");
          }
        } catch {}
        es.close();
        eventSourceRef.current = null;
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        if (state !== STATES.COMPLETED && state !== STATES.ERROR) {
          setState(STATES.ERROR);
          setErrorMsg("Connection to recording session lost.");
        }
      };
    } catch (e) {
      setState(STATES.ERROR);
      setErrorMsg(e.message);
    }
  }, [suiteId, onError]);

  const handleStop = useCallback(async () => {
    if (!sessionId) return;
    try {
      await stopRecordingSession(sessionId);
    } catch {}
  }, [sessionId]);

  const handleAnalyze = useCallback(async () => {
    if (!sessionId || !suiteId) return;
    setState(STATES.ANALYZING);
    setErrorMsg("");
    onError?.("");
    try {
      const result = await analyzeRecording(sessionId, suiteId);
      onAnalyzed?.(result.messages || []);
      setState(STATES.IDLE);
      setSessionId(null);
    } catch (e) {
      setState(STATES.ERROR);
      setErrorMsg(e.message);
      onError?.(e.message);
    }
  }, [sessionId, suiteId, onAnalyzed, onError]);

  const handleReset = useCallback(() => {
    setState(STATES.IDLE);
    setSessionId(null);
    setErrorMsg("");
  }, []);

  const disabled = !bubbleAppUrl;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: "0.75rem",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: state === STATES.IDLE && !errorMsg ? 0 : "0.5rem",
        }}
      >
        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>
          Record Flow
        </span>

        {state === STATES.IDLE && (
          <button
            className="btn"
            onClick={handleStart}
            disabled={disabled}
            style={{ fontSize: "12px", padding: "0.25rem 0.6rem" }}
            title={disabled ? "Set a Bubble App URL on this suite first" : "Start recording"}
          >
            Record
          </button>
        )}
      </div>

      {disabled && state === STATES.IDLE && (
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "0.35rem" }}>
          Set a Bubble App URL when creating the suite to enable recording.
        </div>
      )}

      {state === STATES.RECORDING && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#f85149",
              animation: "pulse 1.5s ease-in-out infinite",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "13px", flex: 1 }}>
            Recording... Interact with your Bubble app, then close the browser.
          </span>
          <button
            className="btn btn-secondary"
            onClick={handleStop}
            style={{ fontSize: "11px", padding: "0.2rem 0.5rem", flexShrink: 0 }}
          >
            Stop
          </button>
        </div>
      )}

      {state === STATES.COMPLETED && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ fontSize: "13px", color: "var(--success)" }}>
            Recording complete.
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className="btn"
              onClick={handleAnalyze}
              style={{ fontSize: "12px", flex: 1 }}
            >
              Analyze Flow
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleReset}
              style={{ fontSize: "12px" }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {state === STATES.ANALYZING && (
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          Analyzing recording with Buildprint MCP...
        </div>
      )}

      {state === STATES.ERROR && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ fontSize: "12px", color: "var(--error)" }}>
            {errorMsg}
          </div>
          <button
            className="btn btn-secondary"
            onClick={handleReset}
            style={{ fontSize: "12px", alignSelf: "flex-start" }}
          >
            Try Again
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
