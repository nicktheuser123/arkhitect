import { supabase } from "./lib/supabase";

const API = "/api";

async function authFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${session.access_token}`,
  };

  const r = await fetch(url, { ...options, headers });

  if (r.status === 401) {
    await supabase.auth.signOut();
    throw new Error("Session expired");
  }
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getConfig() {
  return authFetch(`${API}/config`);
}

export async function saveConfig(config) {
  const items = Object.entries(config).map(([key, value]) => ({ key, value }));
  return authFetch(`${API}/config/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items),
  });
}

export async function getTestSuites() {
  return authFetch(`${API}/test-suites`);
}

export async function getTestSuite(id) {
  return authFetch(`${API}/test-suites/${id}`);
}

export async function createTestSuite(data) {
  return authFetch(`${API}/test-suites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateTestSuite(id, data) {
  return authFetch(`${API}/test-suites/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteTestSuite(id) {
  return authFetch(`${API}/test-suites/${id}`, { method: "DELETE" });
}

export async function runTest(suiteId, entityId) {
  return authFetch(`${API}/test-runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suite_id: suiteId, entity_id: entityId }),
  });
}

export async function getTestRuns(suiteId) {
  const url = suiteId ? `${API}/test-runs?suite_id=${suiteId}` : `${API}/test-runs`;
  return authFetch(url);
}

export async function getTestRun(id) {
  return authFetch(`${API}/test-runs/${id}`);
}

export async function generateCode(prompt) {
  return authFetch(`${API}/ai/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
}

export async function editCode(suiteId, instruction) {
  return authFetch(`${API}/ai/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suiteId, instruction }),
  });
}

export async function refineCode(suiteId, corrections) {
  return authFetch(`${API}/ai/refine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suiteId, corrections }),
  });
}

export async function confirmTestSuite(suiteId, assumptions) {
  return authFetch(`${API}/test-suites/${suiteId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assumptions, change_description: "Confirmed assumptions and saved" }),
  });
}

export async function getCodeVersions(suiteId) {
  return authFetch(`${API}/test-suites/${suiteId}/versions`);
}

export async function restoreCodeVersion(suiteId, versionId) {
  return authFetch(`${API}/test-suites/${suiteId}/versions/${versionId}/restore`, {
    method: "POST",
  });
}

export async function getChatMessages(suiteId) {
  return authFetch(`${API}/chat/${suiteId}`);
}

export async function sendChatMessage(suiteId, { mode, content, testContext, confirmedAssumptions }) {
  return authFetch(`${API}/chat/${suiteId}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, content, testContext, confirmedAssumptions }),
  });
}
