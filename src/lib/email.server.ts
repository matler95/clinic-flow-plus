// Transactional e-mail fallback (Resend, EU-friendly, REST only so it runs on the Worker runtime).
// Content is deliberately generic (guardrail G3): no file names, senders or patient data.

export function emailConfigured(): boolean {
  return !!process.env["RESEND_API_KEY"] && !!process.env["EMAIL_FROM"];
}

export async function sendEmail(to: string, orgName: string): Promise<"sent" | "failed"> {
  const key = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM"];
  if (!key || !from) return "failed";
  const appUrl = process.env["APP_URL"] ?? "";
  const safeOrg = orgName.replace(/[<>&"]/g, "");
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Nowy plik w DentalHub",
        text: `Masz nowy plik w: ${safeOrg}.\nOtwórz skrzynkę${appUrl ? `: ${appUrl}/inbox` : " w aplikacji"}.\n\nTa wiadomość nie zawiera danych pacjentów.`,
      }),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
