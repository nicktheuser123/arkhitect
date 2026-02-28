import { useState, useEffect, useRef } from "react";
import { getChatMessages, sendChatMessage } from "../../api";
import AssumptionChecklist from "./AssumptionChecklist";

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPanel({
  suiteId,
  hasCode,
  testContext,
  onResult,
  onError,
  assumptions = [],
  confirmedSet = new Set(),
  confirmedAssumptions = [],
  onConfirm,
  onCorrection,
  onConfirmAll,
  refining = false,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("edit");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!suiteId) {
      setMessages([]);
      return;
    }
    getChatMessages(suiteId)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [suiteId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !suiteId) return;

    setSending(true);
    setInput("");
    onError?.("");

    try {
      const result = await sendChatMessage(suiteId, {
        mode,
        content: text,
        testContext: testContext || {},
        confirmedAssumptions: confirmedAssumptions || [],
      });

      setMessages(result.messages || []);

      if (mode === "edit" && result.assumptions != null) {
        onResult?.({ assumptions: result.assumptions, hasCode: result.hasCode });
      }
    } catch (e) {
      onError?.(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: "0.5rem 0.75rem",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>
          {hasCode ? "Edit Test" : "Describe Your Test"}
        </span>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button
            onClick={() => setMode("edit")}
            style={{
              padding: "0.2rem 0.5rem",
              fontSize: "11px",
              border: "1px solid var(--border)",
              borderRadius: 3,
              background: mode === "edit" ? "var(--accent)" : "transparent",
              color: mode === "edit" ? "#fff" : "var(--text-muted)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Edit
          </button>
          <button
            onClick={() => setMode("ask")}
            style={{
              padding: "0.2rem 0.5rem",
              fontSize: "11px",
              border: "1px solid var(--border)",
              borderRadius: 3,
              background: mode === "ask" ? "var(--accent)" : "transparent",
              color: mode === "ask" ? "#fff" : "var(--text-muted)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Ask
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          minHeight: 120,
        }}
        className="scrollbar-overlay"
      >
        {messages.length === 0 && (
          <div
            style={{
              color: "var(--text-muted)",
              fontSize: "12px",
              padding: "1rem",
              textAlign: "center",
            }}
          >
            {mode === "edit"
              ? hasCode
                ? 'Describe what to change, e.g. "Add discount validation with a 50% cap"'
                : 'Describe the test to create, e.g. "Validate order totals including ticket counts"'
              : 'Ask a question about the test, e.g. "How is ticket count calculated?"'}
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "90%",
              padding: "0.4rem 0.6rem",
              borderRadius: 6,
              background: m.role === "user" ? "rgba(88, 166, 255, 0.15)" : "rgba(255,255,255,0.05)",
              border: "1px solid var(--border)",
              fontSize: "13px",
            }}
          >
            <div
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {m.content}
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "var(--text-muted)",
                marginTop: "0.2rem",
              }}
            >
              {formatTime(m.created_at)} · {m.mode}
            </div>
          </div>
        ))}
      </div>

      {assumptions?.length > 0 && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <AssumptionChecklist
            assumptions={assumptions}
            confirmedSet={confirmedSet}
            onConfirm={onConfirm}
            onCorrection={onCorrection}
            onConfirmAll={onConfirmAll}
            refining={refining}
            embedded
          />
        </div>
      )}

      <div style={{ padding: "0.5rem", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === "edit"
              ? hasCode
                ? 'Describe what to change...'
                : 'Describe the test to create...'
              : 'Ask a question about the test...'
          }
          rows={2}
          style={{
            width: "100%",
            resize: "none",
            fontSize: "13px",
            fontFamily: "inherit",
            minHeight: "48px",
          }}
          disabled={sending}
        />
        <button
          className="btn"
          onClick={handleSend}
          disabled={sending || !input.trim()}
          style={{ width: "100%", marginTop: "0.5rem", fontSize: "13px" }}
        >
          {sending ? "..." : mode === "edit" ? (hasCode ? "Edit Test" : "Generate Test") : "Ask"}
        </button>
      </div>
    </div>
  );
}
