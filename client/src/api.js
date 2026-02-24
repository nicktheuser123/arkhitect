const API = "/api";

export async function getConfig() {
  const r = await fetch(`${API}/config`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function saveConfig(config) {
  const items = Object.entries(config).map(([key, value]) => ({ key, value }));
  const r = await fetch(`${API}/config/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getTestSuites() {
  const r = await fetch(`${API}/test-suites`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getTestSuite(id) {
  const r = await fetch(`${API}/test-suites/${id}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createTestSuite(data) {
  const r = await fetch(`${API}/test-suites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updateTestSuite(id, data) {
  const r = await fetch(`${API}/test-suites/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deleteTestSuite(id) {
  const r = await fetch(`${API}/test-suites/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function runTest(suiteId, entityId) {
  const r = await fetch(`${API}/test-runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suite_id: suiteId, entity_id: entityId }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getTestRuns(suiteId) {
  const url = suiteId ? `${API}/test-runs?suite_id=${suiteId}` : `${API}/test-runs`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getTestRun(id) {
  const r = await fetch(`${API}/test-runs/${id}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function executeCode(code, entityId) {
  const r = await fetch(`${API}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, entity_id: entityId }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function generateCode(prompt) {
  const r = await fetch(`${API}/ai/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function editCode(code, instruction) {
  const r = await fetch(`${API}/ai/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, instruction }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function refineCode(code, corrections) {
  const r = await fetch(`${API}/ai/refine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, corrections }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getCodeVersions(suiteId) {
  const r = await fetch(`${API}/test-suites/${suiteId}/versions`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function restoreCodeVersion(suiteId, versionId) {
  const r = await fetch(`${API}/test-suites/${suiteId}/versions/${versionId}/restore`, {
    method: "POST",
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
