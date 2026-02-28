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
  console.log("__TRACE__" + JSON.stringify({ step: 1, title: "Fetched Order", type: "fetch", entityType: "GP_Order", fields: ["Ticket Count", "Gross Amount"], data: { "Ticket Count": order["Ticket Count"], "Gross Amount": order["Gross Amount"] } }));
  const addOns = await Promise.all((order["Add Ons"] || []).map(id => getThing("GP_AddOn", id)));
  console.log("__TRACE__" + JSON.stringify({ step: 2, title: "Fetched Add Ons", type: "fetch", entityType: "GP_AddOn", count: addOns.length, fields: ["OS AddOnType", "Quantity", "Price"], data: addOns.map(a => ({ Type: a["OS AddOnType"], Qty: a.Quantity, Price: a.Price })) }));
  let ticketCount = 0, grossAmount = 0;
  addOns.forEach(addOn => {
    if (addOn["OS AddOnType"] !== "Ticket") return;
    ticketCount += addOn.Quantity || 0;
    grossAmount += (addOn.Price || 0) * (addOn.Quantity || 0);
  });
  console.log("__TRACE__" + JSON.stringify({ step: 3, title: "Calculated Ticket Count", type: "calculation", formula: "Sum of Quantity where Type = Ticket", value: ticketCount, data: { ticketAddOnCount: addOns.filter(a => a["OS AddOnType"] === "Ticket").length } }));
  console.log("__TRACE__" + JSON.stringify({ step: 4, title: "Calculated Gross Amount", type: "calculation", formula: "Sum of (Price × Quantity) for tickets", value: grossAmount.toFixed(2), data: { ticketCount, pricePerTicket: addOns.find(a => a["OS AddOnType"] === "Ticket")?.Price } }));
  const results = [
    { label: "Ticket Count", expected: ticketCount, received: order["Ticket Count"], pass: ticketCount === order["Ticket Count"] },
    { label: "Gross Amount", expected: grossAmount.toFixed(2), received: Number(order["Gross Amount"]).toFixed(2), pass: Math.abs(grossAmount - order["Gross Amount"]) < 0.01 },
  ];
  console.log("__TRACE__" + JSON.stringify({ step: 5, title: "Assertions", type: "assertion", comparison: "Expected vs Bubble GP_Order fields", data: results }));
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log("__ARKHITECT_RESULT__" + JSON.stringify({ results, passed, failed }));
`;

const TRACE_INSTRUCTIONS = `
IMPORTANT — Trace logging:
You MUST insert console.log("__TRACE__" + JSON.stringify({...})) calls between every logical step.

Every trace entry MUST have: { step: <number>, title: <string>, type: <"fetch"|"calculation"|"assertion">, data: <object|array> }

Strict schema per type — do NOT deviate from these field names:

FETCH (single record):
  { step, title, type: "fetch", entityType: "GP_Order", fields: ["Field A", "Field B"], data: { "Field A": value, "Field B": value } }
  - entityType: the exact Bubble data type name (e.g. "GP_Order", "GP_AddOn") — REQUIRED
  - fields: array of Bubble field names being used from this fetch — REQUIRED
  - data: object with the raw fetched values for those fields

FETCH (array of records):
  { step, title, type: "fetch", entityType: "GP_AddOn", count: N, fields: ["Field A", "Field B"], data: [ {...}, {...} ] }
  - count: the number of records fetched — REQUIRED for array fetches
  - data: array of objects, each containing the fields used from that record

CALCULATION:
  { step, title, type: "calculation", formula: "plain-English formula", value: <computed result>, data: { <supporting inputs used in the calculation> } }
  - formula: human-readable description of the calculation — REQUIRED
  - value: the computed scalar result — REQUIRED
  - data: object with the input values that fed into the formula (NOT a repeat of formula/value)

ASSERTION:
  { step, title, type: "assertion", comparison: "Expected vs Bubble <EntityType> <FieldName>", data: <results array> }
  - comparison: plain-English description of what is being compared, naming the Bubble entity and field — REQUIRED
  - data: the assertion results array (same format as the __ARKHITECT_RESULT__ results)
  - DO NOT use "matchingAgainst" — always use "comparison"
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

export async function editTestCode(baseURL, apiKey, model, existingCode, instruction, confirmedAssumptions = []) {
  let userContent = `Current test code:\n\`\`\`javascript\n${existingCode}\n\`\`\`\n\nInstruction: ${instruction}`;

  if (confirmedAssumptions && confirmedAssumptions.length > 0) {
    const descriptions = confirmedAssumptions
      .map((a) => (typeof a === "object" && a.description ? a.description : String(a)))
      .filter(Boolean);
    if (descriptions.length > 0) {
      userContent += `\n\nIMPORTANT: The user has already confirmed these assumptions. Do NOT include them in your "assumptions" array. Only return assumptions that are NEW or that have changed from the previous version:\n${descriptions.map((d) => `- ${d}`).join("\n")}`;
    }
  }

  const raw = await chat(baseURL, apiKey, model, [
    { role: "system", content: EDIT_SYSTEM_PROMPT },
    { role: "user", content: userContent },
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

const ASK_SYSTEM_PROMPT = `You are a helpful assistant for Arkhitect, a Bubble.io validation platform.
The user has test code that fetches data from Bubble, computes expected values, and compares them to actual values.
You answer questions about the test code, how values are calculated, why assertions might fail, or any related topic.
Do NOT modify code. Provide clear, plain-English explanations.`;

export async function askAboutTest(baseURL, apiKey, model, code, question, testContext = {}) {
  let contextBlock = `Current test code:\n\`\`\`javascript\n${code || "// No code yet"}\n\`\`\`\n\n`;
  if (testContext.entityId) {
    contextBlock += `Entity ID used in last run: ${testContext.entityId}\n\n`;
  }
  if (testContext.expectedVsReceived && testContext.expectedVsReceived.length > 0) {
    contextBlock += `Last test results (expected vs received):\n${JSON.stringify(testContext.expectedVsReceived, null, 2)}\n\n`;
  }
  if (testContext.traceSteps && testContext.traceSteps.length > 0) {
    contextBlock += `Step-by-step trace from last run:\n${JSON.stringify(testContext.traceSteps, null, 2)}\n\n`;
  }
  const userContent = contextBlock + `Question: ${question}`;

  const answer = await chat(baseURL, apiKey, model, [
    { role: "system", content: ASK_SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ], false);
  return { answer };
}
