import { useState } from "react";
import ReactMarkdown from "react-markdown";
import Editor from "@monaco-editor/react";

export default function PlanView({ summary, code, isPending }) {
  const [showCode, setShowCode] = useState(false);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "var(--surface)",
      border: `1px solid ${isPending ? "var(--warn)" : "var(--border)"}`,
      borderRadius: 4,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "0.5rem 0.75rem",
        borderBottom: "1px solid var(--border)",
        fontSize: "12px",
        color: "var(--text-muted)",
        fontWeight: 500,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span>
          Plan View
          {isPending && (
            <span style={{ color: "var(--warn)", marginLeft: "0.5rem" }}>(pending)</span>
          )}
        </span>
        <button
          onClick={() => setShowCode(!showCode)}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
            padding: "0.2rem 0.5rem",
            borderRadius: 3,
            cursor: "pointer",
            fontSize: "11px",
            fontFamily: "inherit",
          }}
        >
          {showCode ? "Hide Code" : "View Code"}
        </button>
      </div>

      <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }} className="scrollbar-overlay">
        {showCode ? (
          <Editor
            height="100%"
            language="javascript"
            theme="vs-dark"
            value={code || "// No code yet"}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "on",
            }}
          />
        ) : summary ? (
          <div style={{ padding: "0.75rem", overflowY: "auto", height: "100%" }} className="plan-view-content scrollbar-overlay">
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
        ) : (
          <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "2rem 0.75rem" }}>
            {code && code.trim()
              ? "Generating summary..."
              : "No test code yet. Use the chat to create one."}
          </div>
        )}
      </div>
    </div>
  );
}
