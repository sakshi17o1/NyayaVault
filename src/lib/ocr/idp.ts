import Tesseract, { createWorker, Worker } from "tesseract.js";
import path from "path";

type ExtractedFields = {
  caseNumber?: string;
  date?: string;
  policeStation?: string;
  accusedNames?: string[];
  victimNames?: string[];
  witnessNames?: string[];
  sections?: string[];
};

type FieldConfidence = {
  [K in keyof ExtractedFields]: number;
};

export type OcrResult = {
  rawText: string;
  confidence: number;
  extractedData: ExtractedFields;
  fieldConfidence: FieldConfidence;
  suggestedDocumentType?: string;
};

export function suggestDocumentType(text: string, currentType: string): string {
  const upperText = text.toUpperCase();
  if (upperText.includes("CHARGE SHEET") || upperText.includes("CHARGESHEET")) return "CHARGE_SHEET";
  if (upperText.includes("FORENSIC") || upperText.includes("FSL")) return "FORENSIC_REPORT";
  if (upperText.includes("WITNESS") && upperText.includes("STATEMENT")) return "WITNESS_STATEMENT";
  if (upperText.includes("ARREST MEMO")) return "ARREST_MEMO";
  if (upperText.includes("SEIZURE") || upperText.includes("PANCHNAMA")) return "SEIZURE_MEMO_PANCHNAMA";
  if (upperText.includes("MEDICAL") || upperText.includes("DOCTOR")) return "MEDICAL_REPORT";
  if (upperText.includes("BAIL") && upperText.includes("ORDER")) return "BAIL_ORDER";
  
  // Check for FIR last, because almost all other documents reference "FIR NO" in their header!
  if (upperText.includes("FIRST INFORMATION REPORT") || upperText.includes("FIR NO")) return "FIR";
  
  return currentType; // fallback
}

function extractFields(text: string, docType: string, overallConfidence: number): { data: ExtractedFields; confidence: FieldConfidence; suggestedType: string } {
  const data: ExtractedFields = {};
  const conf: FieldConfidence = {
    caseNumber: 0,
    date: 0,
    policeStation: 0,
    accusedNames: 0,
    sections: 0,
  };
  
  const suggestedType = suggestDocumentType(text, docType);

  const firMatch = text.match(/FIR\s*No\.?\s*[:\-]\s*([A-Z0-9\/\-]+)/i);
  if (firMatch) {
    data.caseNumber = firMatch[1].trim();
    conf.caseNumber = 0.98 * overallConfidence; // exact regex match -> high confidence
  }

  const dateMatch = text.match(/Date\s*[:\-]\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (dateMatch) {
    data.date = dateMatch[1].trim();
    conf.date = 0.95 * overallConfidence;
  }

  const psMatch = text.match(/Police Station\s*[:\-]\s*([^\n\r]+)/i);
  if (psMatch) {
    data.policeStation = psMatch[1].trim();
    conf.policeStation = 0.95 * overallConfidence;
  }

  const secMatch = text.match(/Section[s]?\s*[:\-]\s*([^\n\r]+)/i);
  if (secMatch) {
    data.sections = secMatch[1].split(",").map((s) => s.trim());
    conf.sections = 0.90 * overallConfidence;
  }

  // Simulate low confidence on handwritten/tricky names
  const nameMatch = text.match(/Accused\s*[:\-]\s*([^\n\r]+)/i);
  if (nameMatch) {
    data.accusedNames = nameMatch[1].split(",").map((n) => n.trim());
    conf.accusedNames = 0.55 * overallConfidence; 
  }

  const victimMatch = text.match(/Victim(?:s)?\s*[:\-]\s*([^\n\r]+)/i);
  if (victimMatch) {
    data.victimNames = victimMatch[1].split(",").map((n) => n.trim());
    conf.victimNames = 0.65 * overallConfidence;
  }

  const witnessMatchStr = text.match(/Witness(?:es)?\s*[:\-]\s*([^\n\r]+)/i);
  if (witnessMatchStr) {
    data.witnessNames = witnessMatchStr[1].split(",").map((n) => n.trim());
    conf.witnessNames = 0.7 * overallConfidence;
  }

  if (docType === "WITNESS_STATEMENT") {
    // Try to find "My name is [Name]" or "Statement of [Name]" or "Signed, [Name]"
    const witnessMatch = text.match(/(?:My name i[cs]|Statement of)\s+([A-Z][A-Za-z\s]+)(?:,|\.)/i) || text.match(/Signed,?\s*([^\n\r]+)/i) || text.match(/Cianed,?\s*([^\n\r]+)/i);
    if (witnessMatch) {
      data.witnessNames = [witnessMatch[1].trim()]; // properly mapped to witness instead of accused
      conf.witnessNames = 0.75 * overallConfidence;
    }
    
    // Try to find Ref: or Case:
    const refMatch = text.match(/(?:Ref|Case|FIR)\s*[:\-]?\s*([A-Z0-9\/\-]+)/i);
    if (refMatch) {
      data.caseNumber = refMatch[1].trim();
      conf.caseNumber = 0.8 * overallConfidence;
    }
  }

  // If we couldn't find a date using "Date:", try to find any date pattern
  if (!data.date) {
    const looseDateMatch = text.match(/(\d{1,2}[\/\-\s][A-Za-z]+[\/\-\s]\d{2,4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (looseDateMatch) {
      data.date = looseDateMatch[1].trim();
      conf.date = 0.6 * overallConfidence;
    }
  }

  return { data, confidence: conf, suggestedType };
}

/**
 * Extract text from a PDF buffer using pdf-parse.
 * Returns the extracted text or null if extraction fails.
 */
async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    const pdfParse: any = await import("pdf-parse");
    const parser = pdfParse.default || pdfParse;
    const result = await parser(buffer);
    if (result.text && result.text.trim().length > 0) {
      return result.text.trim();
    }
    return null;
  } catch (error) {
    console.error("PDF text extraction error:", error);
    return null;
  }
}

export async function processDocument(
  buffer: Buffer,
  mimeType: string,
  docType: string
): Promise<OcrResult> {
  let rawText = "";
  let overallConfidence = 0.8;

  if (mimeType.startsWith("image/")) {
    let worker: Worker | null = null;
    try {
      worker = await createWorker("eng+hin", 1, {
        langPath: path.join(process.cwd(), "models", "tesseract"),
        cachePath: path.join(process.cwd(), "models", "tesseract"),
        cacheMethod: "none",
        gzip: true, // projectnaptha v4.0.0 uses gzip
      });
      const { data } = await worker.recognize(buffer);
      rawText = data.text;
      overallConfidence = data.confidence / 100;
    } catch (error) {
      console.error("Tesseract error:", error);
      rawText = "[OCR Engine Error - Falling back to mock extraction]";
    } finally {
      if (worker) {
        await worker.terminate().catch(console.error);
      }
    }
  } else if (mimeType === "application/pdf") {
    // PDF files: extract embedded text directly (no OCR needed for typed/digital PDFs)
    const pdfText = await extractPdfText(buffer);
    if (pdfText) {
      rawText = pdfText;
      overallConfidence = 0.92; // High confidence for digitally-generated PDFs
    } else {
      // PDF had no extractable text (e.g., scanned image-only PDF)
      rawText = `[PDF contained no extractable text — likely a scanned image]\nDocument Type: ${docType}`;
      overallConfidence = 0.3;
    }
  } else {
    // Other unsupported types: fallback
    rawText = `[Unsupported file type: ${mimeType}]\nDocument Type: ${docType}`;
    overallConfidence = 0.2;
  }

  const { data: extractedData, confidence: fieldConfidence, suggestedType } = extractFields(rawText, docType, overallConfidence);

  return {
    rawText,
    confidence: overallConfidence,
    extractedData,
    fieldConfidence,
    suggestedDocumentType: suggestedType
  };
}
