import axios from "axios";

export function createBubbleClient(baseURL, token) {
  const client = axios.create({
    baseURL: baseURL || process.env.BUBBLE_API_BASE,
    headers: {
      Authorization: `Bearer ${token || process.env.BUBBLE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  async function getThing(type, id) {
    const res = await client.get(`/${type}/${id}`);
    return res.data.response;
  }

  async function searchThings(type, constraints, limit = 100) {
    const all = [];
    let cursor = 0;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams();
      if (constraints && constraints.length > 0) {
        params.set("constraints", JSON.stringify(constraints));
      }
      params.set("cursor", String(cursor));
      params.set("limit", String(limit));

      const res = await client.get(`/${type}?${params.toString()}`);
      const data = res.data.response;
      const results = data.results || [];
      all.push(...results);

      const remaining = data.remaining ?? 0;
      hasMore = remaining > 0 && results.length > 0;
      cursor += results.length;
    }

    return all;
  }

  return { getThing, searchThings };
}
