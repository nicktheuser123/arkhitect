import { useState, useRef, useEffect } from "react";
import { generateCode, editCode } from "../../api";

export default function ChatPanel({ code, messages, setMessages, onAIResponse, setError }) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt || sending) return;

    setInput("");
    setSending(true);
    setError("");
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);

    try {
      const hasCode = code && code.trim();
      let result;

      if (hasCode) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Editing test code..." }]);
        result = await editCode(code, prompt);
        setMessages((prev) => {
          const updated = prev.slice(0, -1);
          return [
            ...updated,
            {
              role: "assistant",
              content: result.changeDescription
                ? `Proposed changes:\n${result.changeDescription}`
                : "Code updated. Review the changes on the right.",
            },
          ];
        });
        onAIResponse(result, false);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Generating test code..." }]);
        result = await generateCode(prompt);
        setMessages((prev) => {
          const updated = prev.slice(0, -1);
          return [
            ...updated,
            { role: "assistant", content: "Test generated. Review the plan on the right and click Apply to save." },
          ];
        });
        onAIResponse(result, true);
      }
    } catch (e) {
      setError(e.message);
      setMessages((prev) => [
        ...prev.filter((m) => m.content !== "Generating test code..." && m.content !== "Editing test code..."),
        { role: "system", content: `Error: ${e.message}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      flex: 1,
      minHeight: 0,
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
        Chat
      </div>

      <div
        className="scrollbar-overlay"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          minHeight: 0,
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "2rem 0.5rem" }}>
            {code && code.trim()
              ? "Describe what you want to change in this test."
              : "Describe the test you want to create. For example: \"Create a test that validates order totals including promotions and processing fees\""}
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: 4,
              fontSize: "13px",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              ...(msg.role === "user"
                ? { background: "rgba(88, 166, 255, 0.1)", borderLeft: "2px solid var(--accent)" }
                : msg.role === "system"
                  ? { background: "rgba(63, 185, 80, 0.08)", color: "var(--text-muted)", fontStyle: "italic" }
                  : { background: "var(--bg)", borderLeft: "2px solid var(--border)" }),
            }}
          >
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{
        padding: "0.5rem",
        borderTop: "1px solid var(--border)",
        display: "flex",
        gap: "0.5rem",
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={code && code.trim() ? "Describe a change..." : "Describe the test to create..."}
          rows={2}
          style={{
            flex: 1,
            resize: "none",
            fontSize: "13px",
          }}
          disabled={sending}
        />
        <button
          className="btn"
          onClick={handleSend}
          disabled={sending || !input.trim()}
          style={{ alignSelf: "flex-end", fontSize: "13px", padding: "0.4rem 0.75rem" }}
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
