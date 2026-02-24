import { useState } from "react";

const TYPE_ICONS = {
  fetch: "↓",
  calculation: "=",
  assertion: "✓",
};

function DataTable({ data }) {
  if (Array.isArray(data)) {
    if (data.length === 0) return <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Empty</span>;

    const firstItem = data[0];
    if (typeof firstItem !== "object" || firstItem === null) {
      return (
        <div style={{ fontSize: "12px", color: "var(--text)" }}>
          {data.map((item, i) => (
            <span key={i}>
              {String(item)}
              {i < data.length - 1 ? ", " : ""}
            </span>
          ))}
        </div>
      );
    }

    const keys = Object.keys(firstItem);
    return (
      <table style={{
        width: "100%",
        fontSize: "12px",
        borderCollapse: "collapse",
        marginTop: "0.25rem",
      }}>
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k} style={{
                textAlign: "left",
                padding: "0.2rem 0.5rem",
                borderBottom: "1px solid var(--border)",
                color: "var(--text-muted)",
                fontWeight: 500,
                fontSize: "11px",
              }}>
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {keys.map((k) => (
                <td key={k} style={{
                  padding: "0.2rem 0.5rem",
                  borderBottom: "1px solid var(--border)",
                }}>
                  {formatValue(row[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (typeof data === "object" && data !== null) {
    return (
      <div style={{ fontSize: "12px" }}>
        {Object.entries(data).map(([key, val]) => (
          <div key={key} style={{
            display: "flex",
            gap: "0.5rem",
            padding: "0.15rem 0",
            borderBottom: "1px solid rgba(255,255,255,0.03)",
          }}>
            <span style={{ color: "var(--text-muted)", minWidth: "100px", flexShrink: 0 }}>{key}:</span>
            <span style={{ color: "var(--text)" }}>{formatValue(val)}</span>
          </div>
        ))}
      </div>
    );
  }

  return <span style={{ fontSize: "12px" }}>{formatValue(data)}</span>;
}

function formatValue(val) {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function AssertionResults({ data, onFeedback }) {
  if (!Array.isArray(data)) return <DataTable data={data} />;

  return (
    <div>
      {data.map((r, i) => {
        const passed = r.pass;
        return (
          <div key={i} style={{
            padding: "0.5rem 0.6rem",
            borderBottom: "1px solid var(--border)",
            background: passed ? "rgba(63, 185, 80, 0.04)" : "rgba(248, 81, 73, 0.06)",
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "13px",
            }}>
              <span style={{ fontWeight: 500 }}>{r.label}</span>
              <span style={{
                padding: "0.1rem 0.4rem",
                borderRadius: 3,
                fontSize: "11px",
                fontWeight: 600,
                background: passed ? "var(--success)" : "var(--error)",
                color: "#fff",
              }}>
                {passed ? "MATCH" : "MISMATCH"}
              </span>
            </div>
            <div style={{
              display: "flex",
              gap: "1.5rem",
              fontSize: "12px",
              marginTop: "0.3rem",
              color: "var(--text-muted)",
            }}>
              <span>Expected: <strong style={{ color: "var(--text)" }}>{formatValue(r.expected)}</strong></span>
              <span>Bubble says: <strong style={{ color: passed ? "var(--text)" : "var(--error)" }}>{formatValue(r.received)}</strong></span>
            </div>
            {!passed && onFeedback && (
              <MismatchFeedback label={r.label} onFeedback={onFeedback} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MismatchFeedback({ label, onFeedback }) {
  const [mode, setMode] = useState(null);
  const [text, setText] = useState("");

  if (mode === "bubble_bug") {
    return (
      <div style={{
        marginTop: "0.4rem",
        padding: "0.35rem 0.5rem",
        background: "rgba(210, 153, 34, 0.1)",
        borderRadius: 3,
        fontSize: "12px",
        color: "var(--warn)",
      }}>
        Marked as a Bubble data issue for "{label}"
      </div>
    );
  }

  if (mode === "calc_wrong") {
    return (
      <div style={{ marginTop: "0.4rem" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Describe how "${label}" should actually be calculated...`}
          rows={2}
          style={{ width: "100%", fontSize: "12px", fontFamily: "inherit", resize: "vertical" }}
          autoFocus
        />
        <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.3rem" }}>
          <button
            className="btn"
            onClick={() => { onFeedback(text); setMode(null); setText(""); }}
            disabled={!text.trim()}
            style={{ fontSize: "11px", padding: "0.2rem 0.5rem" }}
          >
            Fix Calculation
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setMode(null)}
            style={{ fontSize: "11px", padding: "0.2rem 0.5rem" }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.4rem" }}>
      <button
        onClick={() => setMode("calc_wrong")}
        style={{
          background: "none",
          border: "1px solid var(--warn)",
          color: "var(--warn)",
          padding: "0.15rem 0.4rem",
          borderRadius: 3,
          cursor: "pointer",
          fontSize: "11px",
          fontFamily: "inherit",
        }}
      >
        Calculation is wrong
      </button>
      <button
        onClick={() => setMode("bubble_bug")}
        style={{
          background: "none",
          border: "1px solid var(--text-muted)",
          color: "var(--text-muted)",
          padding: "0.15rem 0.4rem",
          borderRadius: 3,
          cursor: "pointer",
          fontSize: "11px",
          fontFamily: "inherit",
        }}
      >
        Bubble value is wrong
      </button>
    </div>
  );
}

function StepCard({ step, defaultExpanded, onFeedback }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const icon = TYPE_ICONS[step.type] || "•";
  const isAssertion = step.type === "assertion";

  return (
    <div style={{
      borderBottom: "1px solid var(--border)",
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.5rem 0.75rem",
          cursor: "pointer",
          fontSize: "13px",
        }}
      >
        <span style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "rgba(88, 166, 255, 0.15)",
          color: "var(--accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          fontWeight: 600,
          flexShrink: 0,
        }}>
          {step.step}
        </span>
        <span style={{ flex: 1 }}>{step.title}</span>
        <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>
          {icon}
        </span>
        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
          {expanded ? "▼" : "▶"}
        </span>
      </div>
      {expanded && (
        <div style={{ padding: "0 0.75rem 0.5rem 2.75rem" }}>
          {isAssertion ? (
            <AssertionResults data={step.data} onFeedback={onFeedback} />
          ) : (
            <DataTable data={step.data} />
          )}
        </div>
      )}
    </div>
  );
}

export default function StepTrace({ traceSteps, onFeedback }) {
  if (!traceSteps || traceSteps.length === 0) return null;

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 4,
      overflow: "hidden",
      marginTop: "1rem",
    }}>
      <div style={{
        padding: "0.5rem 0.75rem",
        borderBottom: "1px solid var(--border)",
        fontSize: "12px",
        color: "var(--text-muted)",
        fontWeight: 500,
      }}>
        Step-by-Step Trace
      </div>
      {traceSteps.map((step, i) => (
        <StepCard
          key={i}
          step={step}
          defaultExpanded={step.type === "assertion"}
          onFeedback={onFeedback}
        />
      ))}
    </div>
  );
}
