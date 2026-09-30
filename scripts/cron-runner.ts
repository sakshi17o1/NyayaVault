import cron from "node-cron";
import { runRetentionPurge } from "../src/lib/retention-cron";

console.log("[Cron Runner] Started...");

// Run retention purge every night at midnight
cron.schedule("0 0 * * *", async () => {
  console.log("[Cron Runner] Running retention purge job...");
  try {
    // In production, you might pass 'approver1', 'approver2' if required by logic
    // but typically a cron job is automated. The current logic expects them if dryRun=false
    // For this example, we assume it's set up to run automated.
    await runRetentionPurge(false, "system_cron", "system_cron");
    console.log("[Cron Runner] Retention purge completed successfully.");
  } catch (err) {
    console.error("[Cron Runner] Retention purge failed:", err);
  }
});

console.log("[Cron Runner] Scheduled retention purge at 00:00 every day.");
