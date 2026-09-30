import { describe, expect, it } from "vitest";
import { validateUploadFile, MAX_FILE_SIZE } from "@/lib/validators";

describe("Upload Validation", () => {
  it("allows valid PDF files", () => {
    const file = { type: "application/pdf", size: 1024 };
    expect(validateUploadFile(file)).toBeNull();
  });

  it("allows valid JPG files", () => {
    const file = { type: "image/jpeg", size: 1024 };
    expect(validateUploadFile(file)).toBeNull();
  });

  it("allows valid PNG files", () => {
    const file = { type: "image/png", size: 1024 };
    expect(validateUploadFile(file)).toBeNull();
  });

  it("rejects unsupported file types", () => {
    const file = { type: "text/plain", size: 1024 };
    expect(validateUploadFile(file)).toMatch(/Invalid file type/);
    
    const file2 = { type: "application/msword", size: 1024 };
    expect(validateUploadFile(file2)).toMatch(/Invalid file type/);
  });

  it("rejects files that are too large", () => {
    const file = { type: "application/pdf", size: MAX_FILE_SIZE + 1 };
    expect(validateUploadFile(file)).toMatch(/File exceeds 20MB limit/);
  });

  it("allows files exactly at the size limit", () => {
    const file = { type: "application/pdf", size: MAX_FILE_SIZE };
    expect(validateUploadFile(file)).toBeNull();
  });
});
