import { useState, useEffect } from "react";
import { getCodeVersions, restoreCodeVersion } from "../../api";

export default function VersionHistory({ suiteId, onRestore, onClose }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!suiteId) return;
    setLoading(true);
    getCodeVersions(suiteId)
      .then(setVersions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [suiteId]);

  const handleRestore = async (version) => {
    setRestoring(version.id);
    setError("");
    try {
      const suite = await restoreCodeVersion(suiteId, version.id);
      onRestore(suite);
    } catch (e) {
      setError(e.message);
    } finally {
      setRestoring(null);
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 4,
      marginBottom: "1rem",
      maxHeight: "300px",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
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
        <span>Version History</span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: "14px",
            fontFamily: "inherit",
          }}
        >
          x
        </button>
      </div>

      {error && (
        <p style={{ color: "var(--error)", fontSize: "12px", padding: "0.5rem 0.75rem", margin: 0 }}>
          {error}
        </p>
      )}

      <div className="scrollbar-overlay" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {loading ? (
          <div style={{ padding: "1rem 0.75rem", color: "var(--text-muted)", fontSize: "13px" }}>
            Loading...
          </div>
        ) : versions.length === 0 ? (
          <div style={{ padding: "1rem 0.75rem", color: "var(--text-muted)", fontSize: "13px" }}>
            No versions yet.
          </div>
        ) : (
          versions.map((v) => (
            <div
              key={v.id}
              style={{
                padding: "0.5rem 0.75rem",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "13px",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: "var(--accent)" }}>v{v.version_number}</span>
                <span style={{ color: "var(--text-muted)", margin: "0 0.5rem" }}>—</span>
                <span style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {v.change_description || "No description"}
                </span>
                <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem", fontSize: "11px" }}>
                  ({v.created_by}) {timeAgo(v.created_at)}
                </span>
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: "11px", padding: "0.2rem 0.5rem", marginLeft: "0.5rem", flexShrink: 0 }}
                onClick={() => handleRestore(v)}
                disabled={restoring === v.id}
              >
                {restoring === v.id ? "..." : "Restore"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
