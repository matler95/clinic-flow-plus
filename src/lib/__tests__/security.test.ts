import { describe, expect, it, vi } from "vitest";
import { ALLOWED_MIME, MAX_BYTES, hashToken, newToken, sniff } from "../tokens.server";
import { can, capabilities } from "../roles";
import { emailConfigured } from "../email.server";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

const bytes = (...b: number[]) => Uint8Array.from(b);
const pad = (arr: number[], at = 0, len = 136) => {
  const u = new Uint8Array(len);
  u.set(arr, at);
  return u;
};

describe("magic bytes (sniff)", () => {
  it("recognises allow-listed formats", () => {
    expect(sniff(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniff(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniff(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31))).toBe("application/pdf");
    const webp = pad([0x52, 0x49, 0x46, 0x46]);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(sniff(webp)).toBe("image/webp");
    expect(sniff(pad([0x44, 0x49, 0x43, 0x4d], 128))).toBe("application/dicom");
  });
  it("rejects executables, zip, text and SVG/HTML", () => {
    expect(sniff(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull(); // EXE
    expect(sniff(bytes(0x50, 0x4b, 0x03, 0x04))).toBeNull(); // ZIP
    expect(sniff(new TextEncoder().encode("hello world"))).toBeNull();
    expect(sniff(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniff(new TextEncoder().encode("<html><script>"))).toBeNull();
  });
  it("allow-list contains no active content types", () => {
    for (const m of ["image/svg+xml", "text/html", "application/zip", "application/x-msdownload"]) {
      expect(ALLOWED_MIME).not.toContain(m);
    }
    expect(MAX_BYTES).toBe(50 * 1024 * 1024);
  });
});

describe("drop-link tokens", () => {
  it("are 256-bit, url-safe and unique", () => {
    const a = newToken(), b = newToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it("hash deterministically to sha-256 hex", async () => {
    const h = await hashToken("abc");
    expect(h).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("role capabilities", () => {
  it("reception cannot read doctors' files or manage the team", () => {
    expect(can.personalInbox("staff")).toBe(false);
    expect(can.manageTeam("staff")).toBe(false);
    expect(can.clinicInbox("staff")).toBe(true);
  });
  it("only admins audit, delete clinic files and manage links of the clinic", () => {
    for (const r of ["doctor", "staff"]) {
      expect(can.audit(r)).toBe(false);
      expect(can.deleteClinicFiles(r)).toBe(false);
      expect(can.clinicLinks(r)).toBe(false);
    }
    expect(can.audit("admin")).toBe(true);
  });
  it("capability list matches helpers for every role", () => {
    for (const r of ["admin", "doctor", "staff"]) {
      const c = Object.fromEntries(capabilities(r).map((x) => [x.label, x.allowed]));
      expect(c["Zapraszanie osób, zmiana ról i odbieranie dostępu"]).toBe(can.manageTeam(r));
      expect(c["Historia działań (audyt)"]).toBe(can.audit(r));
    }
  });
});

describe("cron authentication", () => {
  const req = (auth?: string) => new Request("https://x/api", { method: "POST", headers: auth ? { authorization: auth } : {} });
  it("rejects missing/wrong bearer and accepts the right one", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await authenticateCronRequest(req()))?.status).toBe(401);
    expect((await authenticateCronRequest(req("Bearer nope")))?.status).toBe(401);
    expect(await authenticateCronRequest(req("Bearer s3cret"))).toBeNull();
    vi.unstubAllEnvs();
  });
  it("accepts the previous secret during rotation", async () => {
    vi.stubEnv("CRON_SECRET", "current");
    vi.stubEnv("CRON_SECRET_PREVIOUS", "previous");
    expect(await authenticateCronRequest(req("Bearer previous"))).toBeNull();
    vi.unstubAllEnvs();
  });
  it("ignores legacy Lovable secrets entirely", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("LOVABLE_CRON_SECRET", "legacy");
    expect((await authenticateCronRequest(req("Bearer legacy")))?.status).toBe(500);
    vi.unstubAllEnvs();
  });
  it("does not accept the legacy secret when the provider-neutral secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "current");
    vi.stubEnv("LOVABLE_CRON_SECRET", "legacy");
    expect((await authenticateCronRequest(req("Bearer legacy")))?.status).toBe(401);
    expect(await authenticateCronRequest(req("Bearer current"))).toBeNull();
    vi.unstubAllEnvs();
  });
  it("fails closed without a configured secret", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("LOVABLE_CRON_SECRET", "");
    expect((await authenticateCronRequest(req("Bearer x")))?.status).toBe(500);
    vi.unstubAllEnvs();
  });
});

describe("e-mail fallback", () => {
  it("is off until a provider is configured", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(emailConfigured()).toBe(false);
    vi.stubEnv("RESEND_API_KEY", "k");
    vi.stubEnv("EMAIL_FROM", "DentalHub <hub@example.pl>");
    expect(emailConfigured()).toBe(true);
    vi.unstubAllEnvs();
  });
});
