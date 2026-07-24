import "server-only";
import { getEmailTransport } from "@/lib/email/client";

/**
 * Best-effort email send -- notification emails are a side-effect of the
 * real action (deposit landed, bet settled, etc.), never a precondition
 * for it. A dead mail server should never fail a deposit webhook or a
 * settlement run, so failures are logged and swallowed here rather than
 * thrown.
 */
export async function sendEmail(to: string, subject: string, html: string) {
  if (!to) return;
  try {
    await getEmailTransport().sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error(`[email] failed to send "${subject}" to ${to}:`, (err as Error).message);
  }
}
