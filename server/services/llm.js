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
  console.log("__TRACE__" + JSON.stringify({ step: 1, title: "Fetched Order", type: "fetch", data: { "Ticket Count": order["Ticket Count"], "Gross Amount": order["Gross Amount"] } }));
  const addOns = await Promise.all((order["Add Ons"] || []).map(id => getThing("GP_AddOn", id)));
  console.log("__TRACE__" + JSON.stringify({ step: 2, title: "Fetched " + addOns.length + " Add Ons", type: "fetch", data: addOns.map(a => ({ Type: a["OS AddOnType"], Qty: a.Quantity, Price: a.Price })) }));
  let ticketCount = 0, grossAmount = 0;
  addOns.forEach(addOn => {
    if (addOn["OS AddOnType"] !== "Ticket") return;
    ticketCount += addOn.Quantity || 0;
    grossAmount += (ticketType.Price || 0) * (addOn.Quantity || 0);
  });
  console.log("__TRACE__" + JSON.stringify({ step: 3, title: "Calculated Ticket Count", type: "calculation", data: { formula: "Sum of Quantity where Type = Ticket", value: ticketCount } }));
  console.log("__TRACE__" + JSON.stringify({ step: 4, title: "Calculated Gross Amount", type: "calculation", data: { formula: "Sum of (Price × Quantity) for tickets", value: grossAmount.toFixed(2) } }));
  const results = [
    { label: "Ticket Count", expected: ticketCount, received: order["Ticket Count"], pass: ticketCount === order["Ticket Count"] },
    { label: "Gross Amount", expected: grossAmount.toFixed(2), received: Number(order["Gross Amount"]).toFixed(2), pass: Math.abs(grossAmount - order["Gross Amount"]) < 0.01 },
  ];
  console.log("__TRACE__" + JSON.stringify({ step: 5, title: "Assertions", type: "assertion", data: results }));
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log("__ARKHITECT_RESULT__" + JSON.stringify({ results, passed, failed }));
`;

const TRACE_INSTRUCTIONS = `
IMPORTANT — Trace logging:
You MUST insert console.log("__TRACE__" + JSON.stringify({...})) calls between every logical step.
Each trace entry has: { step: <number>, title: <string>, type: <"fetch"|"calculation"|"assertion">, data: <object|array> }
- After every data fetch, emit a "fetch" trace showing the key fields retrieved.
- After every calculation, emit a "calculation" trace showing the formula description and computed value.
- Before the final __ARKHITECT_RESULT__, emit an "assertion" trace with the results array.
This lets non-technical users see the math step-by-step with real numbers.
`;

const ASSUMPTIONS_INSTRUCTIONS = `
IMPORTANT — Assumptions:
In addition to code, you MUST return an "assumptions" array listing every assumption you made.
Each assumption is an object with:
- "id": short unique string like "ds1", "calc1", "assert1"
- "category": one of "data_source", "calculation", "assertion"
- "description": plain-English description a non-coder can understand
- "confidence": "high" (very likely correct), "medium" (probably correct), or "low" (guessing)
- "editHint": (optional) a question to ask the user if confidence is not "high", e.g. "What is the processing fee percentage?"

Examples of good assumptions:
  { "id": "ds1", "category": "data_source", "description": "Order data comes from entity type 'GP_Order'", "confidence": "high" }
  { "id": "calc1", "category": "calculation", "description": "Ticket Count = sum of Quantity on Add Ons where AddOnType is 'Ticket'", "confidence": "medium", "editHint": "How is ticket count calculated?" }
  { "id": "calc2", "category": "calculation", "description": "Processing Fee = Gross Amount × 3.5%", "confidence": "low", "editHint": "What is the processing fee percentage or formula?" }
  { "id": "assert1", "category": "assertion", "description": "Gross Amount compared with $0.01 tolerance", "confidence": "high" }
`;

const GENERATE_SYSTEM_PROMPT = `You are a test code generator for Arkhitect, a Bubble.io validation platform.
You write JavaScript test code that fetches data from a Bubble.io app, computes expected values, and compares them against actual Bubble field values.

${BUBBLE_HELPERS_DOCS}
${TRACE_INSTRUCTIONS}
${EXAMPLE_SNIPPET}

Rules:
- Write ONLY the test body (no function wrapper, no imports — helpers are pre-injected).
- Use async/await freely (code runs inside an async IIFE).
- Always end with the __ARKHITECT_RESULT__ output.
- Handle null/undefined fields gracefully with defaults.
- Use helper: const money = (n) => Number(n || 0).toFixed(2); for monetary comparisons.
- Use tolerance-based comparison for numbers: Math.abs(a - b) < 0.01.
- Include __TRACE__ logging between every step as described above.

${ASSUMPTIONS_INSTRUCTIONS}

Respond with a JSON object (no markdown fences):
{
  "code": "...the full test code with __TRACE__ logging...",
  "assumptions": [ ...array of assumption objects... ]
}`;

const EDIT_SYSTEM_PROMPT = `You are a test code editor for Arkhitect, a Bubble.io validation platform.
You modify existing JavaScript test code based on user instructions.

${BUBBLE_HELPERS_DOCS}
${TRACE_INSTRUCTIONS}

Rules:
- Return the COMPLETE modified test code (not a diff/patch).
- Preserve existing logic unless the instruction says to change it.
- Keep the __ARKHITECT_RESULT__ output format.
- Keep __TRACE__ logging between every step. Update trace entries to reflect changes.
- Handle edge cases introduced by the change.

${ASSUMPTIONS_INSTRUCTIONS}

Respond with a JSON object (no markdown fences):
{
  "code": "...the complete modified test code...",
  "assumptions": [ ...updated array of assumption objects... ],
  "changeDescription": "...a concise list of what was changed..."
}`;

const REFINE_SYSTEM_PROMPT = `You are a test code editor for Arkhitect, a Bubble.io validation platform.
The user has reviewed the assumptions made by the AI and provided corrections.
You must update the test code to reflect the corrected assumptions.

${BUBBLE_HELPERS_DOCS}
${TRACE_INSTRUCTIONS}

Rules:
- Return the COMPLETE modified test code (not a diff/patch).
- Apply each correction precisely — the user is telling you what was WRONG in the previous version.
- Keep the __ARKHITECT_RESULT__ output format.
- Keep __TRACE__ logging between every step. Update trace entries to reflect changes.
- Handle edge cases introduced by corrections.

${ASSUMPTIONS_INSTRUCTIONS}

Respond with a JSON object (no markdown fences):
{
  "code": "...the complete corrected test code...",
  "assumptions": [ ...updated array of assumption objects reflecting corrections... ]
}`;

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

export async function refineTestCode(baseURL, apiKey, model, existingCode, corrections) {
  const correctionText = corrections
    .map(c => `- Assumption "${c.assumptionId}": ${c.correction}`)
    .join("\n");

  const raw = await chat(baseURL, apiKey, model, [
    { role: "system", content: REFINE_SYSTEM_PROMPT },
    { role: "user", content: `Current test code:\n\`\`\`javascript\n${existingCode}\n\`\`\`\n\nCorrections to apply:\n${correctionText}` },
  ], true);
  return parseJSON(raw);
}
