import { describe, expect, it } from "vitest";
import { fmtSize, guessMime } from "../upload";

describe("upload helpers", () => {
  it("formats sizes", () => {
    expect(fmtSize(512)).toBe("512 B");
    expect(fmtSize(2048)).toBe("2 KB");
    expect(fmtSize(50 * 1024 * 1024)).toBe("50.0 MB");
  });
  it("guesses DICOM from extension when the browser gives no type", () => {
    expect(guessMime(new File(["x"], "scan.dcm"))).toBe("application/dicom");
    expect(guessMime(new File(["x"], "a.png", { type: "image/png" }))).toBe("image/png");
  });
});
