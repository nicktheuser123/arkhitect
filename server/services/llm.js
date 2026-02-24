const BUBBLE_HELPERS_DOCS = `
Available helper functions (already injected at runtime):
- ENTITY_ID: string — the entity ID passed when running the test
- getThing(type: string, id: string): Promise<object> — fetch a single Bubble entity by type and ID
- searchThings(type: string, constraints: Array<{key, constraint_type, value}>, limit?: number): Promise<object[]> — search Bubble entities

Output format — the test MUST end with:
  const results = [ { label: "Field Name", expected: computedValue, received: bubbleValue, pass: boolean }, ... ];
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log("__ARKHITECT_RESULT__" + JSON.stringify({ results, passed, failed }));
`;

const EXAMPLE_SNIPPET = `
Example test (order validation, abbreviated):
  const order = await getThing("GP_Order", ENTITY_ID);
  const addOns = await Promise.all((order["Add Ons"] || []).map(id => getThing("GP_AddOn", id)));
  // ... compute expected values ...
  let ticketCount = 0, grossAmount = 0;
  addOns.forEach(addOn => {
    if (addOn["OS AddOnType"] !== "Ticket") return;
    ticketCount += addOn.Quantity || 0;
    grossAmount += (ticketType.Price || 0) * (addOn.Quantity || 0);
  });
  const results = [
    { label: "Ticket Count", expected: ticketCount, received: order["Ticket Count"], pass: ticketCount === order["Ticket Count"] },
    { label: "Gross Amount", expected: grossAmount.toFixed(2), received: Number(order["Gross Amount"]).toFixed(2), pass: Math.abs(grossAmount - order["Gross Amount"]) < 0.01 },
  ];
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log("__ARKHITECT_RESULT__" + JSON.stringify({ results, passed, failed }));
`;

const GENERATE_SYSTEM_PROMPT = `You are a test code generator for Arkhitect, a Bubble.io validation platform.
You write JavaScript test code that fetches data from a Bubble.io app, computes expected values, and compares them against actual Bubble field values.

${BUBBLE_HELPERS_DOCS}
${EXAMPLE_SNIPPET}

Rules:
- Write ONLY the test body (no function wrapper, no imports — helpers are pre-injected).
- Use async/await freely (code runs inside an async IIFE).
- Always end with the __ARKHITECT_RESULT__ output.
- Handle null/undefined fields gracefully with defaults.
- Use helper: const money = (n) => Number(n || 0).toFixed(2); for monetary comparisons.
- Use tolerance-based comparison for numbers: Math.abs(a - b) < 0.01.

Respond with a JSON object (no markdown fences):
{
  "code": "...the full test code...",
  "summary": "...a structured plain-English summary with sections: ## Data Sources, ## Calculation Logic, ## Assertions..."
}`;

const EDIT_SYSTEM_PROMPT = `You are a test code editor for Arkhitect, a Bubble.io validation platform.
You modify existing JavaScript test code based on user instructions.

${BUBBLE_HELPERS_DOCS}

Rules:
- Return the COMPLETE modified test code (not a diff/patch).
- Preserve existing logic unless the instruction says to change it.
- Keep the __ARKHITECT_RESULT__ output format.
- Handle edge cases introduced by the change.

Respond with a JSON object (no markdown fences):
{
  "code": "...the complete modified test code...",
  "summary": "...a structured plain-English summary of the full test with sections: ## Data Sources, ## Calculation Logic, ## Assertions...",
  "changeDescription": "...a concise list of what was changed, e.g. 'Added discount cap at 50% of ticket price'..."
}`;

const SUMMARIZE_SYSTEM_PROMPT = `You summarize JavaScript test code for Arkhitect, a Bubble.io validation platform.

Given test code, produce a structured plain-English summary. Use these sections:
## Data Sources
List each entity type fetched and how (by ID, by search, by reference).

## Calculation Logic
Describe the computation steps in plain English. Include conditionals, loops, and edge cases.
Use numbered steps and sub-bullets for branches.

## Assertions
List each check: what field is compared, what the expected value is based on, and the comparison method.

Respond with ONLY the summary text (markdown). No JSON wrapper, no code fences around the whole response.`;

const DIFF_SUMMARY_SYSTEM_PROMPT = `You compare two versions of JavaScript test code and describe what changed in plain English.

Be concise. List each change as a bullet point. Focus on logic changes, not formatting.
If a user instruction is provided, relate the changes back to it.

Respond with ONLY the change description text (markdown bullets). No JSON wrapper.`;

async function chat(baseURL, apiKey, model, messages, jsonMode = false) {
  const url = baseURL.replace(/\/+$/, "") + "/chat/completions";
  const body = {
    model,
    messages,
    temperature: 0.2,
  };
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

function parseJSON(raw) {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(cleaned);
}

export async function generateTestCode(baseURL, apiKey, model, description) {
  const raw = await chat(baseURL, apiKey, model, [
    { role: "system", content: GENERATE_SYSTEM_PROMPT },
    { role: "user", content: description },
  ], true);
  return parseJSON(raw);
}

export async function editTestCode(baseURL, apiKey, model, existingCode, instruction) {
  const raw = await chat(baseURL, apiKey, model, [
    { role: "system", content: EDIT_SYSTEM_PROMPT },
    { role: "user", content: `Current test code:\n\`\`\`javascript\n${existingCode}\n\`\`\`\n\nInstruction: ${instruction}` },
  ], true);
  return parseJSON(raw);
}

export async function summarizeTestCode(baseURL, apiKey, model, code) {
  const raw = await chat(baseURL, apiKey, model, [
    { role: "system", content: SUMMARIZE_SYSTEM_PROMPT },
    { role: "user", content: `\`\`\`javascript\n${code}\n\`\`\`` },
  ]);
  return { summary: raw.trim() };
}

export async function diffSummary(baseURL, apiKey, model, oldCode, newCode, instruction) {
  const raw = await chat(baseURL, apiKey, model, [
    { role: "system", content: DIFF_SUMMARY_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Previous code:\n\`\`\`javascript\n${oldCode}\n\`\`\`\n\nNew code:\n\`\`\`javascript\n${newCode}\n\`\`\`${instruction ? `\n\nUser instruction: ${instruction}` : ""}`,
    },
  ]);
  return { changeDescription: raw.trim() };
}
