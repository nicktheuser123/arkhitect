import { useState } from "react";

export default function PromptPanel({ onGenerate, generating, hasCode }) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = () => {
    const text = prompt.trim();
    if (!text || generating) return;
    onGenerate(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 4,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "0.5rem 0.75rem",
        borderBottom: "1px solid var(--border)",
        fontSize: "12px",
        color: "var(--text-muted)",
        fontWeight: 500,
      }}>
        {hasCode ? "Edit Test" : "Describe Your Test"}
      </div>

      <div style={{ padding: "0.5rem" }}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            hasCode
              ? 'Describe what to change, e.g. "Add discount validation with a 50% cap"'
              : 'Describe the test to create, e.g. "Validate order totals including ticket counts, gross amount, processing fees, and discounts"'
          }
          rows={3}
          style={{
            width: "100%",
            resize: "vertical",
            fontSize: "13px",
            fontFamily: "inherit",
            minHeight: "60px",
          }}
          disabled={generating}
        />
        <button
          className="btn"
          onClick={handleSubmit}
          disabled={generating || !prompt.trim()}
          style={{ width: "100%", marginTop: "0.5rem", fontSize: "13px" }}
        >
          {generating
            ? "Generating..."
            : hasCode
              ? "Edit Test"
              : "Generate Test"}
        </button>
      </div>
    </div>
  );
}
