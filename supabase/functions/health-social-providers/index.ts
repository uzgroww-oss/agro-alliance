/**
 * Health endpoint – reports connectivity status for each social platform.
 */

import { checkTelegramHealth, checkInstagramHealth, checkFacebookHealth } from "../../_shared/socialHealth.ts";
import { log } from "../../_shared/logger.ts";

export default async function handler() {
  const [tg, ig, fb] = await Promise.all([
    checkTelegramHealth(),
    checkInstagramHealth(),
    checkFacebookHealth(),
  ]);

  const status = {
    telegram: tg ? "ok" : "unreachable",
    instagram: ig ? "ok" : "unreachable",
    facebook: fb ? "ok" : "unreachable",
  };

  log("info", "Social providers health check", status);
  return new Response(JSON.stringify(status), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
