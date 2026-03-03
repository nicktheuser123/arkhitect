import { useState, useEffect, useRef } from "react";
import { getChatMessages, sendChatMessage } from "../../api";

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPanel({
  suiteId,
  hasCode,
  testContext,
  messages,
  setMessages,
  onResult,
  onError,
}) {
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

  const hasMcpContext = messages.some((m) => m.metadata?.mcpContext);
  const inConversation = !hasCode && messages.length > 0;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !suiteId) return;

    const sendMode = inConversation ? "ask" : mode;

    setSending(true);
    setInput("");
    onError?.("");

    try {
      const result = await sendChatMessage(suiteId, {
        mode: sendMode,
        content: text,
        testContext: testContext || {},
      });

      setMessages(result.messages || []);

      if (result.hasCode != null) {
        onResult?.({ hasCode: result.hasCode, messages: result.messages });
      }
    } catch (e) {
      onError?.(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleCreateTests = async () => {
    if (sending || !suiteId) return;

    setSending(true);
    onError?.("");

    try {
      const result = await sendChatMessage(suiteId, {
        mode: "create",
        content: "Create tests from the discussed flow",
        testContext: testContext || {},
      });

      setMessages(result.messages || []);
      onResult?.({ hasCode: result.hasCode ?? false, messages: result.messages });
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
          {inConversation ? "Flow Discussion" : hasCode ? "Edit Test" : "Describe Your Test"}
        </span>
        {!inConversation && <div style={{ display: "flex", gap: "0.25rem" }}>
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
        </div>}
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
                : 'Record a flow or describe the test to create'
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
              background: m.role === "user" ? "rgba(58, 175, 169, 0.15)" : "rgba(255,255,255,0.05)",
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

      <div style={{ padding: "0.5rem", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            inConversation
              ? "Reply to the assistant..."
              : mode === "edit"
                ? hasCode
                  ? "Describe what to change..."
                  : "Describe the test to create..."
                : "Ask a question about the test..."
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
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
          <button
            className="btn"
            onClick={handleSend}
            disabled={sending || !input.trim()}
            style={{ flex: 1, fontSize: "13px" }}
          >
            {sending
              ? "..."
              : inConversation
                ? "Send"
                : mode === "edit"
                  ? hasCode ? "Edit Test" : "Generate Test"
                  : "Ask"}
          </button>
          {(inConversation || (hasCode && hasMcpContext)) && (
            <button
              className="btn"
              onClick={handleCreateTests}
              disabled={sending}
              style={{ flex: 1, fontSize: "13px" }}
            >
              {sending ? "Creating..." : hasCode ? "Regenerate Tests" : "Create Tests"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
