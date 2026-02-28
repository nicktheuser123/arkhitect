import { useState } from "react";

const CATEGORY_LABELS = {
  data_source: "Data Sources",
  calculation: "Calculations",
  assertion: "Assertions",
};

const CATEGORY_ORDER = ["data_source", "calculation", "assertion"];

const CONFIDENCE_COLORS = {
  high: "#3fb950",
  medium: "#d29922",
  low: "#f85149",
};

function AssumptionCard({ assumption, confirmed, onConfirm, onEdit, editing, editText, onEditTextChange, onSubmitEdit, onCancelEdit }) {
  const dotColor = CONFIDENCE_COLORS[assumption.confidence] || CONFIDENCE_COLORS.medium;

  return (
    <div style={{
      padding: "0.6rem 0.75rem",
      borderBottom: "1px solid var(--border)",
      background: confirmed ? "rgba(63, 185, 80, 0.05)" : "transparent",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
            marginTop: 5,
          }}
          title={`Confidence: ${assumption.confidence}`}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "13px",
            lineHeight: 1.5,
            color: confirmed ? "var(--text-muted)" : "var(--text)",
            textDecoration: confirmed ? "none" : "none",
          }}>
            {assumption.description}
          </div>
          {assumption.editHint && !confirmed && (
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "0.2rem", fontStyle: "italic" }}>
              {assumption.editHint}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0 }}>
          {!confirmed && !editing && (
            <>
              <button
                onClick={onConfirm}
                style={{
                  background: "none",
                  border: "1px solid var(--success)",
                  color: "var(--success)",
                  padding: "0.15rem 0.4rem",
                  borderRadius: 3,
                  cursor: "pointer",
                  fontSize: "11px",
                  fontFamily: "inherit",
                }}
                title="Confirm this assumption is correct"
              >
                Correct
              </button>
              <button
                onClick={onEdit}
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
                title="Edit this assumption"
              >
                Fix
              </button>
            </>
          )}
          {confirmed && (
            <span style={{ color: "var(--success)", fontSize: "14px" }} title="Confirmed">
              ✓
            </span>
          )}
        </div>
      </div>

      {editing && (
        <div style={{ marginTop: "0.5rem", marginLeft: "1rem" }}>
          <textarea
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            placeholder="Describe the correction in plain English..."
            rows={2}
            style={{
              width: "100%",
              fontSize: "12px",
              fontFamily: "inherit",
              resize: "vertical",
            }}
            autoFocus
          />
          <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.35rem" }}>
            <button
              className="btn"
              onClick={onSubmitEdit}
              disabled={!editText.trim()}
              style={{ fontSize: "11px", padding: "0.2rem 0.5rem" }}
            >
              Apply Correction
            </button>
            <button
              className="btn btn-secondary"
              onClick={onCancelEdit}
              style={{ fontSize: "11px", padding: "0.2rem 0.5rem" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssumptionChecklist({
  assumptions,
  confirmedSet,
  onConfirm,
  onCorrection,
  onConfirmAll,
  refining,
  embedded = false,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editTexts, setEditTexts] = useState({});

  if (!assumptions || assumptions.length === 0) return null;

  const grouped = {};
  for (const a of assumptions) {
    const cat = a.category || "calculation";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(a);
  }

  const allConfirmed = assumptions.every((a) => confirmedSet.has(a.id));
  const confirmedCount = assumptions.filter((a) => confirmedSet.has(a.id)).length;

  const handleStartEdit = (id) => {
    setEditingId(id);
    setEditTexts((prev) => ({ ...prev, [id]: prev[id] || "" }));
  };

  const handleSubmitEdit = (assumptionId) => {
    const text = (editTexts[assumptionId] || "").trim();
    if (!text) return;
    setEditingId(null);
    onCorrection(assumptionId, text);
  };

  const containerStyle = embedded
    ? {
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }
    : {
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      };

  return (
    <div style={containerStyle}>
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
          Review Assumptions
          {refining && <span style={{ color: "var(--accent)", marginLeft: "0.5rem" }}>(updating...)</span>}
        </span>
        <span style={{ fontSize: "11px" }}>
          {confirmedCount}/{assumptions.length} confirmed
        </span>
      </div>

      <div
        className="scrollbar-overlay"
        style={{
          flex: 1,
          overflowY: "auto",
          minHeight: 0,
          ...(embedded && { maxHeight: 180 }),
        }}
      >
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          return (
            <div key={cat}>
              <div style={{
                padding: "0.4rem 0.75rem",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                background: "rgba(255,255,255,0.02)",
                borderBottom: "1px solid var(--border)",
              }}>
                {CATEGORY_LABELS[cat] || cat}
              </div>
              {items.map((a) => (
                <AssumptionCard
                  key={a.id}
                  assumption={a}
                  confirmed={confirmedSet.has(a.id)}
                  onConfirm={() => onConfirm(a.id)}
                  onEdit={() => handleStartEdit(a.id)}
                  editing={editingId === a.id}
                  editText={editTexts[a.id] || ""}
                  onEditTextChange={(val) => setEditTexts((prev) => ({ ...prev, [a.id]: val }))}
                  onSubmitEdit={() => handleSubmitEdit(a.id)}
                  onCancelEdit={() => setEditingId(null)}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div style={{
        padding: "0.5rem 0.75rem",
        borderTop: "1px solid var(--border)",
        display: "flex",
        gap: "0.5rem",
      }}>
        <button
          className="btn"
          onClick={onConfirmAll}
          disabled={!allConfirmed || refining}
          style={{
            flex: 1,
            fontSize: "13px",
            background: allConfirmed ? "var(--success)" : undefined,
            opacity: allConfirmed ? 1 : 0.5,
          }}
        >
          {allConfirmed ? "Save Test" : `Confirm all ${assumptions.length} assumptions to save`}
        </button>
      </div>
    </div>
  );
}
