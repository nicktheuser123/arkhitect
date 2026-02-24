import axios from "axios";

export async function executeCode(sourceCode, stdin = "", languageId = 63, apiKey) {
  const base = process.env.JUDGE0_BASE_URL || "https://ce.judge0.com";
  const token = apiKey || process.env.JUDGE0_API_KEY || "";
  const url = `${base}/submissions?base64_encoded=false&wait=true`;
  const headers = {
    "Content-Type": "application/json",
    ...(token && { "X-Auth-Token": token }),
  };

  const res = await axios.post(
    url,
    {
      source_code: sourceCode,
      stdin: stdin,
      language_id: languageId,
    },
    { headers, timeout: 60000 }
  );

  return {
    stdout: res.data.stdout || "",
    stderr: res.data.stderr || "",
    compile_output: res.data.compile_output || "",
    status: res.data.status?.description || "Unknown",
    time: res.data.time,
    memory: res.data.memory,
  };
}
