import "server-only";
import nodemailer from "nodemailer";

let transport: nodemailer.Transporter | null = null;

/** Singleton SMTP transport -- reused across invocations instead of
 * reconnecting per email (Fluid Compute keeps the module warm between
 * requests on the same instance). */
export function getEmailTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  return transport;
}
