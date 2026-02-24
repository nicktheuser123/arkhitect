import ReactMarkdown from "react-markdown";

export default function DiffSummary({ changeDescription, newSummary, isNew, onApply, onReject }) {
  return (
    <div style={{
      background: "rgba(210, 153, 34, 0.08)",
      border: "1px solid var(--warn)",
      borderRadius: 4,
      padding: "0.75rem 1rem",
      marginBottom: "1rem",
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "0.5rem",
      }}>
        <span style={{ color: "var(--warn)", fontWeight: 500, fontSize: "13px" }}>
          {isNew ? "New test generated" : "Proposed changes"}
        </span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className="btn"
            onClick={onApply}
            style={{ fontSize: "12px", padding: "0.3rem 0.75rem", background: "var(--success)" }}
          >
            Apply
          </button>
          <button
            className="btn btn-secondary"
            onClick={onReject}
            style={{ fontSize: "12px", padding: "0.3rem 0.75rem" }}
          >
            Reject
          </button>
        </div>
      </div>

      {changeDescription && (
        <div style={{ fontSize: "13px", lineHeight: 1.5 }} className="plan-view-content">
          <ReactMarkdown>{changeDescription}</ReactMarkdown>
        </div>
      )}

      {isNew && newSummary && !changeDescription && (
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          Review the plan on the right, then click Apply to save.
        </div>
      )}
    </div>
  );
}
