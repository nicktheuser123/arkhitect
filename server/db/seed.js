import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { adminClient } from "./supabase.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function seed() {
  const logicMd = readFileSync(join(__dirname, "..", "..", "LOGIC.md"), "utf8");
  const orderValidationCode = readFileSync(join(__dirname, "templates", "orderValidation.js.txt"), "utf8");
  const reportingDailyCode = readFileSync(join(__dirname, "templates", "reportingDaily.js.txt"), "utf8");

  const { data: existing } = await adminClient
    .from("test_suites")
    .select("id, name")
    .in("name", ["Order Validation", "Reporting Daily"]);

  const existingMap = Object.fromEntries((existing || []).map((r) => [r.name, r.id]));

  if (existingMap["Order Validation"]) {
    await adminClient
      .from("test_suites")
      .update({ calculator_code: orderValidationCode, logic_md: logicMd, updated_at: new Date().toISOString() })
      .eq("id", existingMap["Order Validation"]);
  } else {
    await adminClient
      .from("test_suites")
      .insert({
        name: "Order Validation",
        description: "Validates GP_Order financial calculations against Bubble",
        calculator_code: orderValidationCode,
        logic_md: logicMd,
        run_order_tests: true,
        run_reporting_daily_tests: true,
      });
  }

  if (existingMap["Reporting Daily"]) {
    await adminClient
      .from("test_suites")
      .update({ calculator_code: reportingDailyCode, updated_at: new Date().toISOString() })
      .eq("id", existingMap["Reporting Daily"]);
  } else {
    await adminClient
      .from("test_suites")
      .insert({
        name: "Reporting Daily",
        description: "Validates GP_ReportingDaily against order sums for Date Label + Event",
        calculator_code: reportingDailyCode,
        logic_md: logicMd,
        run_order_tests: false,
        run_reporting_daily_tests: true,
      });
  }

  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
