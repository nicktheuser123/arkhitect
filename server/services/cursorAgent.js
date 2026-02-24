import axios from "axios";

const CURSOR_API = "https://api.cursor.com/v0";

export function createCursorClient(apiKey) {
  const token = apiKey || process.env.CURSOR_API_KEY;

  if (!token) {
    throw new Error("Cursor API key not configured");
  }

  const auth = Buffer.from(`${token}:`).toString("base64");

  async function launchAgent({ prompt, repository, ref = "main", target = {} }) {
    const res = await axios.post(
      `${CURSOR_API}/agents`,
      {
        prompt: { text: prompt },
        source: { repository, ref },
        target: target,
      },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );
    return res.data;
  }

  async function getAgentStatus(agentId) {
    const res = await axios.get(`${CURSOR_API}/agents/${agentId}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    return res.data;
  }

  async function addFollowup(agentId, prompt) {
    const res = await axios.post(
      `${CURSOR_API}/agents/${agentId}/followup`,
      { prompt: { text: prompt } },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );
    return res.data;
  }

  return { launchAgent, getAgentStatus, addFollowup };
}
