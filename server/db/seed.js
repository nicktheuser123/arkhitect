import dotenv from "dotenv";
import { query } from "./index.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", "..", ".env") });

async function seed() {
  const logicMd = readFileSync(
    join(__dirname, "..", "..", "LOGIC.md"),
    "utf8"
  );
  const orderValidationCode = readFileSync(
    join(__dirname, "templates", "orderValidation.js.txt"),
    "utf8"
  );
  const reportingDailyCode = readFileSync(
    join(__dirname, "templates", "reportingDaily.js.txt"),
    "utf8"
  );

  const orderRes = await query(
    "SELECT id FROM test_suites WHERE name = $1",
    ["Order Validation"]
  );
  if (orderRes.rows.length === 0) {
    await query(
      `INSERT INTO test_suites (name, description, calculator_code, logic_md, run_order_tests, run_reporting_daily_tests)
       VALUES ($1, $2, $3, $4, true, true)`,
      [
        "Order Validation",
        "Validates GP_Order financial calculations against Bubble",
        orderValidationCode,
        logicMd,
      ]
    );
  } else {
    await query(
      `UPDATE test_suites SET calculator_code = $2, logic_md = $3, updated_at = NOW() WHERE name = $1`,
      ["Order Validation", orderValidationCode, logicMd]
    );
  }

  const reportingRes = await query(
    "SELECT id FROM test_suites WHERE name = $1",
    ["Reporting Daily"]
  );
  if (reportingRes.rows.length === 0) {
    await query(
      `INSERT INTO test_suites (name, description, calculator_code, logic_md, run_order_tests, run_reporting_daily_tests)
       VALUES ($1, $2, $3, $4, false, true)`,
      [
        "Reporting Daily",
        "Validates GP_ReportingDaily against order sums for Date Label + Event",
        reportingDailyCode,
        logicMd,
      ]
    );
  } else {
    await query(
      `UPDATE test_suites SET calculator_code = $2, updated_at = NOW() WHERE name = $1`,
      ["Reporting Daily", reportingDailyCode]
    );
  }

  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
