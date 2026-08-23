export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

/**
 * No real email provider is wired up (deliberate scope decision — see the plan). This logs
 * to the server console so the link is usable in dev without a mail client; a real
 * provider (Resend, SMTP, etc.) drops in later behind this same function signature.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  console.log(`\n--- EMAIL (stub, no provider configured) ---\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.body}\n---\n`);
}
