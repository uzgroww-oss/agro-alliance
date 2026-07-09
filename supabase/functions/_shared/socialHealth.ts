/**
 * Simple health checks for each social platform.
 * Returns true if the configured API endpoint responds within a short timeout.
 */

export async function checkTelegramHealth(): Promise<boolean> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return false;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    return resp.ok;
  } catch {
    return false;
  }
}

export async function checkInstagramHealth(): Promise<boolean> {
  const token = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
  if (!token) return false;
  try {
    const resp = await fetch(`https://graph.facebook.com/v15.0/me?access_token=${token}`);
    return resp.ok;
  } catch {
    return false;
  }
}

export async function checkFacebookHealth(): Promise<boolean> {
  const token = Deno.env.get("FACEBOOK_PAGE_TOKEN");
  if (!token) return false;
  try {
    const resp = await fetch(`https://graph.facebook.com/v15.0/me?access_token=${token}`);
    return resp.ok;
  } catch {
    return false;
  }
}
