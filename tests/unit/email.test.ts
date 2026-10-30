import { afterEach, describe, expect, it, vi } from "vitest";
import { kirimEmail, kirimHasilPengajuan } from "@/lib/email";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("kirimEmail", () => {
  it("di development hanya mencetak ke log, tidak memanggil Resend", async () => {
    const fetchPalsu = vi.fn();
    vi.stubGlobal("fetch", fetchPalsu);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await kirimEmail({ ke: "a@contoh.test", subjek: "Halo", pesan: "isi" });
    expect(fetchPalsu).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledOnce();
  });

  it("menolak isi atau subjek yang memuat nomor 16 digit", async () => {
    await expect(kirimEmail({ ke: "a@contoh.test", subjek: "Halo", pesan: "NIK 9990000000000001" })).rejects.toThrow("16 digit");
    await expect(kirimEmail({ ke: "a@contoh.test", subjek: "9990000000000001" })).rejects.toThrow("16 digit");
  });

  it("di produksi tanpa konfigurasi gagal keras", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_DARI", "");
    await expect(kirimEmail({ ke: "a@contoh.test", subjek: "Halo", pesan: "isi" })).rejects.toThrow("belum dikonfigurasi");
  });

  it("di produksi mengirim ke API Resend dan gagal bila ditolak", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "kunci-uji");
    vi.stubEnv("EMAIL_DARI", "RT <rt@contoh.test>");
    const fetchPalsu = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, status: 422 });
    vi.stubGlobal("fetch", fetchPalsu);
    await kirimEmail({ ke: "a@contoh.test", subjek: "Halo", pesan: "isi", tautan: "https://app.test/x" });
    const [url, init] = fetchPalsu.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(init.body as string)).toMatchObject({ from: "RT <rt@contoh.test>", to: "a@contoh.test", subject: "Halo" });
    await expect(kirimEmail({ ke: "a@contoh.test", subjek: "Halo", pesan: "isi" })).rejects.toThrow("422");
  });
});

describe("kirimHasilPengajuan", () => {
  it("menyensor nomor 16 digit pada alasan penolakan", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await kirimHasilPengajuan({ ke: "a@contoh.test", nama: "Budi", jenis: "Ubah data", disetujui: false, alasan: "NIK 9990000000000001 salah" });
    const teks = String(info.mock.calls[0]?.[0]);
    expect(teks).toContain("[nomor disembunyikan]");
    expect(teks).not.toContain("9990000000000001");
  });
});
