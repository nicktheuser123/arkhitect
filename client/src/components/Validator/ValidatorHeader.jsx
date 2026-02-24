import { useState } from "react";
import { getTestSuites, createTestSuite } from "../../api";

export default function ValidatorHeader({
  selectedSuite,
  setSelectedSuite,
  entityId,
  setEntityId,
  suites,
  setSuites,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [newSuiteName, setNewSuiteName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    if (!newSuiteName.trim()) {
      setError("Enter a suite name.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const suite = await createTestSuite({ name: newSuiteName.trim() });
      const refreshed = await getTestSuites();
      setSuites(refreshed);
      setSelectedSuite(suite.id);
      setNewSuiteName("");
      setModalOpen(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "1rem",
        alignItems: "flex-end",
        marginBottom: "1.5rem",
      }}
    >
      <div className="form-group" style={{ minWidth: 180, marginBottom: 0 }}>
        <label>Test Suite</label>
        <select
          value={selectedSuite}
          onChange={(e) => setSelectedSuite(e.target.value)}
        >
          <option value="">Select suite…</option>
          {suites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group" style={{ minWidth: 280, marginBottom: 0 }}>
        <label>Entity ID (Order ID)</label>
        <input
          type="text"
          placeholder="e.g. 1771672992747x483733468340289540"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
        />
      </div>
      <button
        className="btn btn-secondary"
        onClick={() => setModalOpen(true)}
        style={{ height: "fit-content", marginBottom: 0 }}
      >
        Add Suite +
      </button>

      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => !creating && setModalOpen(false)}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "1.5rem",
              minWidth: 320,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1rem" }}>
              New Test Suite
            </h3>
            <div className="form-group">
              <label>Suite name</label>
              <input
                type="text"
                placeholder="e.g. Order Validation"
                value={newSuiteName}
                onChange={(e) => setNewSuiteName(e.target.value)}
              />
            </div>
            {error && (
              <p style={{ color: "var(--error)", fontSize: 13, marginBottom: "1rem" }}>
                {error}
              </p>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn" onClick={handleAdd} disabled={creating}>
                {creating ? "Creating…" : "Create"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setModalOpen(false)}
                disabled={creating}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
