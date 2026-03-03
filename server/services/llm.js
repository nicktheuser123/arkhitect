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
  const results = [
    { label: "Ticket Count", expected: ticketCount, received: order["Ticket Count"], pass: ticketCount === order["Ticket Count"] },
    { label: "Gross Amount", expected: grossAmount.toFixed(2), received: Number(order["Gross Amount"]).toFixed(2), pass: Math.abs(grossAmount - order["Gross Amount"]) < 0.01 },
  ];
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

const BUBBLE_JSON_KNOWLEDGE = `
## Bubble App JSON Structure (for interpreting MCP results)

### Workflows
- Page workflows live at /pages/<pageId>/workflows.
- Reusable workflows live at /element_definitions/<reusableId>/workflows.
- Backend workflows live at /api.
- Each workflow has: id, type (e.g. PageLoaded, ButtonClicked, APIEvent, CustomEvent), name, properties (trigger config, conditions), actions (map keyed by action id).
- Workflow conditions are expressions under properties.condition.
- Custom events use CustomEvent type, referenced by ScheduleCustom or TriggerCustomEvent actions.

### Actions
- Actions live under workflows.<workflowId>.actions as a map keyed by action id.
- Each action: id, type (e.g. ChangeThing, SetCustomState, ScheduleAPIEvent, ScheduleAPIEventOnList), properties (config + argument expressions).
- ChangeThing actions have properties.changes map with field update expressions — these hold calculation formulas.
- ScheduleAPIEvent actions reference backend workflows via properties.api_event.
- Action order is by map key order (0, 1, 2...).

### Expressions
- JSON nodes with type and properties, chained via next field.
- Chain direction: datasource root (GetElement, CurrentUser, Search) -> Message nodes via next.
- Message nodes have a name describing an operation (equals, is_not_empty, get_group_data, etc.).
- Common types: GetElement (resolve element by element_id), CurrentUser, PageData, ArbitraryText (constant), OptionValue/OneOptionValue/AllOptionValue.
- Expression nodes appear in workflow conditions, action arguments, element properties.

### Data Types (user_types)
- Map keyed by type id. Each type has name/display, fields map.
- Field types: text, number, date, user, custom.<type>, list.text, list.custom.<type>.

### Option Sets
- Map keyed by option set id. Each has name/display, values map.
- Values have display, db_value, sort_factor.
- Referenced in expressions with option.<set_id> and option_value.
`;

const JQ_COOKBOOK_REFERENCE = `
## Available jq Search Templates
You can request these by template name. The server will execute them.
- "by_action" — find all uses of an action type. Args: { strings: { t: "ScheduleAPIEvent" } }
- "by_element_workflows" — find workflows triggered by or using a specific element. Args: { strings: { id: "<element_id>" } }
- "workflow_triggers" — find triggers for a workflow id or name. Args: { strings: { query: "<workflow_id_or_name>" } }
- "workflow_owner" — given workflow IDs, find page/reusable owner. Args: { json: { workflow_ids: ["id1","id2"] } }
- "by_event_type" — find workflows by event type. Args: { strings: { t: "PageLoaded" } }
- "by_element_usage" — find all references to an element id. Args: { strings: { id: "<element_id>" } }
`;

// ---------- LLM prompts ----------

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

Respond with a JSON object (no markdown fences):
{
  "code": "...the full test code with __TRACE__ logging..."
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

Respond with a JSON object (no markdown fences):
{
  "code": "...the complete modified test code...",
  "changeDescription": "...a concise list of what was changed..."
}`;

const ASK_SYSTEM_PROMPT = `You are a helpful assistant for Arkhitect, a Bubble.io validation platform.
The user has test code that fetches data from Bubble, computes expected values, and compares them to actual values.
You answer questions about the test code, how values are calculated, why assertions might fail, or any related topic.
Do NOT modify code. Provide clear, plain-English explanations.`;

const PHASE2_LOCATE_PROMPT = `You are an expert at analyzing Bubble.io applications. You are given:
1. A Playwright recording of user interactions in a Bubble app.
2. An app summary listing all pages, data types, option sets, and reusable elements.
3. Buildprint guidelines on how Bubble app JSON is structured.

${BUBBLE_JSON_KNOWLEDGE}
${JQ_COOKBOOK_REFERENCE}

Your task: Analyze the Playwright recording to identify which parts of the Bubble app were exercised, then tell the server what MCP data to fetch.

Respond with a JSON object (no markdown fences):
{
  "description": "Brief description of what the user did in the recording",
  "pages": ["page_name_1", "page_name_2"],
  "dataTypes": ["DataType1", "DataType2"],
  "textSearches": ["keyword1", "keyword2"],
  "jqSearches": [
    { "template": "by_action", "args": { "strings": { "t": "ScheduleAPIEvent" } } }
  ]
}

Rules:
- pages: list the page names the user visited (from the URLs in the Playwright code).
- dataTypes: list the Bubble data type names that are likely read or written during this flow.
- textSearches: keywords to search for in the app JSON (field names, labels, flow-related terms).
- jqSearches: structured searches using the cookbook templates listed above. Include searches that help identify which workflows fire and what data types are involved.
- Be specific: if the user interacted with an order page, search for order-related terms.
- Include at least one by_action search for ScheduleAPIEvent to find backend workflow triggers.`;

const PHASE3_DEEPREAD_PROMPT = `You are an expert at analyzing Bubble.io application logic. You are given:
1. The Playwright recording of user interactions.
2. Results from Phase 2 MCP exploration: page element trees (with workflow cross-references), data type schemas, and search results.

${BUBBLE_JSON_KNOWLEDGE}

Your task: Review the page trees and search results to identify which specific workflows and expressions contain the calculation logic you need to understand. Tell the server exactly what to deep-read.

Respond with a JSON object (no markdown fences):
{
  "workflowPaths": ["/api/workflow_id_1", "/pages/page_id/workflows/workflow_id_2"],
  "optionSetPaths": ["/option_sets/os_name"],
  "additionalSearches": ["keyword_for_missed_logic"],
  "jqSearches": [
    { "template": "workflow_triggers", "args": { "strings": { "query": "workflow_name" } } }
  ],
  "deepReadDepth": 15
}

Rules:
- workflowPaths: JSON pointer paths to workflows that contain business logic (calculations, data mutations). Look at the workflow cross-references in the page trees to find relevant workflow IDs.
- optionSetPaths: paths to option sets used in conditions or logic branching.
- additionalSearches: text searches for terms you haven't found yet (e.g. "discount", "processing fee").
- jqSearches: additional cookbook searches to trace workflow chains.
- deepReadDepth: recommended depth for get_json (10-20, higher for complex nested logic).
- Focus on workflows that contain ChangeThing actions with calculation expressions.`;

const PHASE4_GENERATE_PROMPT = `You are an expert at analyzing Bubble.io business logic and generating test specifications. You are given:
1. The Playwright recording of user interactions.
2. ALL MCP context from the Bubble app: guidelines, summary, page trees, data type schemas, workflow definitions, option sets, and search results.

${BUBBLE_JSON_KNOWLEDGE}

Your task: Synthesize all the context to produce:
1. A clear description of the business logic flow the user exercised.
2. Individual test cases for each verifiable field/calculation.
3. A formatted chat message for the user.

Respond with a JSON object (no markdown fences):
{
  "flowDescription": "User created an order with 3 ticket add-ons...",
  "businessLogic": [
    { "step": 1, "description": "Order Item subtotal = Price x Quantity (from workflow calculate_order_totals action 0)" }
  ],
  "testCases": [
    { "id": "tc1", "field": "Ticket Count", "entity": "GP_Order", "logic": "Sum of Quantity on Add Ons where Type = Ticket", "priority": "high" }
  ],
  "questions": ["Is the processing fee percentage 3.5% or configured per event?"],
  "chatMessage": "formatted message for the user summarizing the flow, business logic steps, test cases, and any questions"
}

Rules:
- Extract EXACT formulas from workflow expressions (ChangeThing action properties.changes).
- Each testCase should target a single verifiable field on a specific entity.
- The chatMessage should be conversational and easy to understand — include the flow description, each business logic step, each test case with its logic, and any open questions.
- priority: "high" for core calculations, "medium" for secondary fields, "low" for cosmetic/derived.
- questions: list anything you're uncertain about that the user could clarify.`;

const GENERATE_CODE_FROM_CONVERSATION_PROMPT = `You are a test code generator for Arkhitect, a Bubble.io validation platform.
You are given:
1. A full conversation between the user and AI about a business logic flow and test cases.
2. Bubble app context from MCP (data types, workflows, expressions, option sets).

Your task: Generate JavaScript test code that implements the agreed-upon test cases from the conversation.

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
- Implement ALL test cases discussed in the conversation.
- Use the exact field names and data types from the MCP context.

Respond with a JSON object (no markdown fences):
{
  "code": "...the full test code with __TRACE__ logging...",
  "changeDescription": "Generated test code from conversation: [brief summary of what's tested]"
}`;

// ---------- helpers ----------

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

  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfterHeader = res.headers.get("retry-after");
      let waitMs;
      if (retryAfterHeader) {
        waitMs = (parseFloat(retryAfterHeader) || 30) * 1000;
      } else {
        const text = await res.text();
        const match = text.match(/try again in ([\d.]+)s/i);
        waitMs = match ? parseFloat(match[1]) * 1000 + 1000 : (2 ** attempt) * 5000;
      }
      waitMs = Math.min(waitMs, 120_000);
      console.log(`LLM rate-limited (429). Retrying in ${(waitMs / 1000).toFixed(1)}s (attempt ${attempt + 1}/${MAX_RETRIES})...`);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }
}

function parseJSON(raw) {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(cleaned);
}

// ---------- existing functions (assumptions removed) ----------

export async function generateTestCode(baseURL, apiKey, model, description) {
  const raw = await chat(baseURL, apiKey, model, [
    { role: "system", content: GENERATE_SYSTEM_PROMPT },
    { role: "user", content: description },
  ], true);
  return parseJSON(raw);
}

export async function editTestCode(baseURL, apiKey, model, existingCode, instruction) {
  const userContent = `Current test code:\n\`\`\`javascript\n${existingCode}\n\`\`\`\n\nInstruction: ${instruction}`;

  const raw = await chat(baseURL, apiKey, model, [
    { role: "system", content: EDIT_SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ], true);
  return parseJSON(raw);
}

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

// ---------- 4-phase pipeline functions ----------

export async function locateEntryPoints(baseURL, apiKey, model, playwrightCode, summary, guidelines) {
  let userContent = `## Recorded User Flow (Playwright codegen output)\n\n\`\`\`javascript\n${playwrightCode}\n\`\`\`\n\n`;

  if (guidelines) {
    userContent += `## Buildprint Guidelines\n\n${guidelines}\n\n`;
  }
  if (summary) {
    const summaryStr = typeof summary === "string" ? summary : JSON.stringify(summary, null, 2);
    userContent += `## App Summary (data types, pages, option sets)\n\n\`\`\`json\n${summaryStr}\n\`\`\`\n\n`;
  }

  userContent += `Analyze the recording and identify which pages, data types, and workflows are relevant. Return the structured response.`;

  const raw = await chat(baseURL, apiKey, model, [
    { role: "system", content: PHASE2_LOCATE_PROMPT },
    { role: "user", content: userContent },
  ], true);
  return parseJSON(raw);
}

export async function identifyDeepReads(baseURL, apiKey, model, playwrightCode, phase2McpResults) {
  let userContent = `## Recorded User Flow\n\n\`\`\`javascript\n${playwrightCode}\n\`\`\`\n\n`;
  userContent += `## Phase 2 MCP Results\n\n`;

  if (phase2McpResults.trees) {
    userContent += `### Page Element Trees (with workflow cross-references)\n\n\`\`\`\n${phase2McpResults.trees}\n\`\`\`\n\n`;
  }
  if (phase2McpResults.dataTypeSchemas) {
    userContent += `### Data Type Schemas\n\n\`\`\`json\n${JSON.stringify(phase2McpResults.dataTypeSchemas, null, 2)}\n\`\`\`\n\n`;
  }
  if (phase2McpResults.searchResults) {
    userContent += `### Search Results\n\n\`\`\`json\n${JSON.stringify(phase2McpResults.searchResults, null, 2)}\n\`\`\`\n\n`;
  }

  userContent += `Review the trees and search results. Identify which specific workflows and expressions to deep-read for calculation logic.`;

  const raw = await chat(baseURL, apiKey, model, [
    { role: "system", content: PHASE3_DEEPREAD_PROMPT },
    { role: "user", content: userContent },
  ], true);
  return parseJSON(raw);
}

export async function generateFlowAndTests(baseURL, apiKey, model, playwrightCode, allMcpContext) {
  let userContent = `## Recorded User Flow\n\n\`\`\`javascript\n${playwrightCode}\n\`\`\`\n\n`;
  userContent += `## Complete Bubble App Context\n\n`;

  if (allMcpContext.guidelines) {
    userContent += `### Guidelines\n\n${allMcpContext.guidelines}\n\n`;
  }
  if (allMcpContext.summary) {
    const summaryStr = typeof allMcpContext.summary === "string" ? allMcpContext.summary : JSON.stringify(allMcpContext.summary, null, 2);
    userContent += `### App Summary\n\n\`\`\`json\n${summaryStr}\n\`\`\`\n\n`;
  }
  if (allMcpContext.trees) {
    userContent += `### Page Element Trees\n\n\`\`\`\n${allMcpContext.trees}\n\`\`\`\n\n`;
  }
  if (allMcpContext.dataTypeSchemas) {
    userContent += `### Data Type Schemas\n\n\`\`\`json\n${JSON.stringify(allMcpContext.dataTypeSchemas, null, 2)}\n\`\`\`\n\n`;
  }
  if (allMcpContext.workflows) {
    userContent += `### Workflow Definitions\n\n\`\`\`json\n${JSON.stringify(allMcpContext.workflows, null, 2)}\n\`\`\`\n\n`;
  }
  if (allMcpContext.optionSets) {
    userContent += `### Option Sets\n\n\`\`\`json\n${JSON.stringify(allMcpContext.optionSets, null, 2)}\n\`\`\`\n\n`;
  }
  if (allMcpContext.searchResults) {
    userContent += `### Search Results\n\n\`\`\`json\n${JSON.stringify(allMcpContext.searchResults, null, 2)}\n\`\`\`\n\n`;
  }

  userContent += `Synthesize all context to produce the business logic flow, test cases, and a chat message for the user.`;

  const raw = await chat(baseURL, apiKey, model, [
    { role: "system", content: PHASE4_GENERATE_PROMPT },
    { role: "user", content: userContent },
  ], true);
  return parseJSON(raw);
}

export async function generateCodeFromConversation(baseURL, apiKey, model, conversationHistory, mcpContext) {
  let userContent = `## Conversation History\n\n`;
  for (const msg of conversationHistory) {
    userContent += `**${msg.role}**: ${msg.content}\n\n`;
  }

  userContent += `## Bubble App Context (from MCP)\n\n`;

  if (mcpContext.summary) {
    const summaryStr = typeof mcpContext.summary === "string" ? mcpContext.summary : JSON.stringify(mcpContext.summary, null, 2);
    userContent += `### App Summary\n\n\`\`\`json\n${summaryStr}\n\`\`\`\n\n`;
  }
  if (mcpContext.dataTypeSchemas) {
    userContent += `### Data Type Schemas\n\n\`\`\`json\n${JSON.stringify(mcpContext.dataTypeSchemas, null, 2)}\n\`\`\`\n\n`;
  }
  if (mcpContext.workflows) {
    userContent += `### Workflow Definitions\n\n\`\`\`json\n${JSON.stringify(mcpContext.workflows, null, 2)}\n\`\`\`\n\n`;
  }
  if (mcpContext.trees) {
    userContent += `### Page Element Trees\n\n\`\`\`\n${mcpContext.trees}\n\`\`\`\n\n`;
  }
  if (mcpContext.testCases) {
    userContent += `### Agreed Test Cases\n\n\`\`\`json\n${JSON.stringify(mcpContext.testCases, null, 2)}\n\`\`\`\n\n`;
  }

  userContent += `Generate the test code implementing all agreed test cases from the conversation.`;

  const raw = await chat(baseURL, apiKey, model, [
    { role: "system", content: GENERATE_CODE_FROM_CONVERSATION_PROMPT },
    { role: "user", content: userContent },
  ], true);
  return parseJSON(raw);
}
