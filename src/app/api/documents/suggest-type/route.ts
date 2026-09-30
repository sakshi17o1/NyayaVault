import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { suggestDocumentType } from "@/lib/ocr/idp";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import util from "util";

const execAsync = util.promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rawText = "";
    let confidence = 0.5;

    if (file.type.startsWith("image/")) {
      // Detached script execution to avoid Next.js Webpack breaking Tesseract WebWorkers
      const tempId = Math.random().toString(36).substring(7);
      const tempPath = path.join(os.tmpdir(), `preview_${tempId}.tmp`);
      
      try {
        await fs.writeFile(tempPath, buffer);
        const { stdout } = await execAsync(`node scripts/preview-ocr.js "${tempPath}"`);
        const result = JSON.parse(stdout);
        rawText = result.text;
        confidence = result.confidence;
      } catch (err) {
        console.error("Preview OCR detached script failed:", err);
      } finally {
        await fs.unlink(tempPath).catch(() => {});
      }
    } else if (file.type === "application/pdf") {
      // For PDFs, we can safely use the pdf-parse package inline
      try {
        const pdfParse: any = require("pdf-parse");
        const parser = pdfParse.default || pdfParse;
        const result = await parser(buffer);
        if (result.text && result.text.trim().length > 0) {
          rawText = result.text.trim();
          confidence = 0.9;
        }
      } catch (err) {
        console.error("Preview PDF parse failed:", err);
      }
    }

    const suggestedType = suggestDocumentType(rawText, "UNKNOWN");

    return NextResponse.json({
      success: true,
      suggestedType,
      confidence
    });
  } catch (error: any) {
    console.error("Type suggestion error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
