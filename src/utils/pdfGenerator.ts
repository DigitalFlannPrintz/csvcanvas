import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import bwipjs from 'bwip-js';

export interface ConditionalRule {
  id: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: string;
  color?: string;
  isBold?: boolean;
  isItalic?: boolean;
}

export interface CanvasTextData {
  text: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  fontSize: number;
  pageIndex: number;
  color?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  fontFamily?: string;
  textAlign?: string;
  isUppercase?: boolean;
  padding?: number;
  lineHeight?: number;
  rules?: ConditionalRule[];
}

export interface CanvasBarcodeData {
  field: string;
  barcodeType: 'qrcode' | 'code128' | 'code39';
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  barcodeColor?: string;
}

export interface CanvasStaticImageData {
  dataUrl: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ProgressCallback = (current: number, total: number, stage: string) => void;

function hexToRgbFraction(hex: string = '#000000') {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255 || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255 || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255 || 0;
  return { r, g, b };
}

const PDF_FONT_FALLBACK_MAP: Record<string, string> = {
  'Arial': 'Helvetica',
  'Verdana': 'Helvetica',
  'Trebuchet MS': 'Helvetica',
  'Impact': 'Helvetica',
  'Gill Sans': 'Helvetica',
  'Lucida Sans': 'Helvetica',
  'Segoe UI': 'Helvetica',
  'Helvetica': 'Helvetica',
  'Times New Roman': 'Times New Roman',
  'Georgia': 'Times New Roman',
  'Garamond': 'Times New Roman',
  'Palatino': 'Times New Roman',
  'Baskerville': 'Times New Roman',
  'Courier': 'Courier',
  'Courier New': 'Courier',
  'Lucida Console': 'Courier',
  'Monaco': 'Courier',
  'Comic Sans MS': 'Helvetica',
  'Symbol': 'Symbol',
  'ZapfDingbats': 'ZapfDingbats',
};

const barcodeBufferCache = new Map<string, Uint8Array>();

async function generateBarcodePng(bcid: string, text: string, color: string = "#000000"): Promise<Uint8Array | null> {
  if (!text || typeof text !== "string" && typeof text !== "number") return null;
  
  let rawStr = String(text).trim();
  if (!rawStr) return null;

  // Format-aware sanitization
  const normalizedBcid = bcid.toLowerCase();
  if (normalizedBcid === "code39") {
    // Code 39 requires uppercase and accepts standard punctuation only
    rawStr = rawStr.toUpperCase().replace(/[^A-Z0-9 \-\.\$\+\/%]/g, "");
    if (!rawStr) rawStr = "INVALID";
  } else if (normalizedBcid === "ean13" || normalizedBcid === "upca") {
    rawStr = rawStr.replace(/[^0-9]/g, "");
    if (!rawStr) return null;
  }

  const cleanHex = color.replace("#", "").trim() || "000000";
  const cacheKey = `${normalizedBcid}_${rawStr}_${cleanHex}`;
  if (barcodeBufferCache.has(cacheKey)) {
    return barcodeBufferCache.get(cacheKey)!;
  }

  try {
    const opts: Record<string, any> = {
      bcid: normalizedBcid,
      text: rawStr,
      scale: 3,
      includetext: normalizedBcid !== "qrcode",
      textxalign: "center",
      barcolor: cleanHex,
    };
    if (normalizedBcid !== "qrcode") {
      opts.height = 10;
    }

    const canvas = document.createElement("canvas");
    bwipjs.toCanvas(canvas, opts as any);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return null;

    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (barcodeBufferCache.size < 500) {
      barcodeBufferCache.set(cacheKey, bytes);
    }
    return bytes;
  } catch (err) {
    console.warn(`[Barcode Warning] Could not encode "${rawStr}" as ${bcid}. Falling back to Code128/QR.`, err);
    // Fallback attempt: if code39 or UPC failed, try code128 as a resilient fallback
    if (normalizedBcid !== "code128" && normalizedBcid !== "qrcode") {
      try {
        const fallbackCanvas = document.createElement("canvas");
        bwipjs.toCanvas(fallbackCanvas, {
          bcid: "code128",
          text: String(text).trim(),
          scale: 3,
          includetext: true,
          textxalign: "center",
          barcolor: cleanHex,
          height: 10,
        } as any);
        const fallbackBlob = await new Promise<Blob | null>((resolve) => fallbackCanvas.toBlob(resolve, "image/png"));
        if (fallbackBlob) {
          const fbArray = await fallbackBlob.arrayBuffer();
          const fbBytes = new Uint8Array(fbArray);
          barcodeBufferCache.set(cacheKey, fbBytes);
          return fbBytes;
        }
      } catch (innerErr) {
        console.error("Barcode secondary fallback also failed:", innerErr);
      }
    }
    return null;
    }
}

export function evaluateCondition(rawText: string, rule: ConditionalRule): boolean {
  const currentVal = (rawText || '').trim();
  const targetVal = (rule.value || '').trim();

  switch (rule.operator) {
    case 'equals':
      return currentVal.toLowerCase() === targetVal.toLowerCase();
    case 'not_equals':
      return currentVal.toLowerCase() !== targetVal.toLowerCase();
    case 'contains':
      return currentVal.toLowerCase().includes(targetVal.toLowerCase());
    case 'greater_than': {
      const numCur = parseFloat(currentVal);
      const numTgt = parseFloat(targetVal);
      return !isNaN(numCur) && !isNaN(numTgt) && numCur > numTgt;
    }
    case 'less_than': {
      const numCur = parseFloat(currentVal);
      const numTgt = parseFloat(targetVal);
      return !isNaN(numCur) && !isNaN(numTgt) && numCur < numTgt;
    }
    default:
      return false;
  }
}

export function parseRangeString(input: string, maxLimit: number): number[] {
  if (!input.trim()) {
    return Array.from({ length: maxLimit }, (_, i) => i);
  }

  const result = new Set<number>();
  const parts = input.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const minVal = Math.max(1, Math.min(start, end));
        const maxVal = Math.min(maxLimit, Math.max(start, end));
        for (let i = minVal; i <= maxVal; i++) {
          result.add(i - 1);
        }
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1 && num <= maxLimit) {
        result.add(num - 1);
      }
    }
  }

  return Array.from(result).sort((a, b) => a - b);
}

// Convert dataURL to standard PNG byte stream
async function normalizeImageDataToPngBytes(dataUrl: string): Promise<Uint8Array | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = dataUrl;
    });

    const offscreen = document.createElement('canvas');
    offscreen.width = img.naturalWidth || img.width || 100;
    offscreen.height = img.naturalHeight || img.height || 100;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => offscreen.toBlob(resolve, 'image/png'));
    if (!blob) return null;

    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (err) {
    console.error('Failed to convert image to clean PNG byte stream:', err);
    return null;
  }
}

export async function generateVDP(
  basePdfBytes: ArrayBuffer,
  csvData: Record<string, string>[],
  templateFields: CanvasTextData[],
  canvasWidth: number,
  customFontRegistry: Record<string, ArrayBuffer> = {},
  barcodeFields: CanvasBarcodeData[] = [],
  onProgress?: ProgressCallback,
  targetPageIndices?: number[],
  staticImages: CanvasStaticImageData[] = []
): Promise<Uint8Array> {
  if (onProgress) onProgress(0, csvData.length, 'Initializing PDF engine & fonts...');

  barcodeBufferCache.clear();

  const pdfDoc = await PDFDocument.load(basePdfBytes);
  const totalTemplatePages = pdfDoc.getPageCount();

  const activeTemplateIndices = (targetPageIndices && targetPageIndices.length > 0)
    ? targetPageIndices.filter((idx) => idx >= 0 && idx < totalTemplatePages)
    : Array.from({ length: totalTemplatePages }, (_, i) => i);

  const templateDimensions: Record<
    number,
    { width: number; height: number; originX: number; originY: number; scaleFactor: number }
  > = {};
  for (const i of activeTemplateIndices) {
    const page = pdfDoc.getPage(i);
    const box = page.getCropBox() || page.getMediaBox() || { x: 0, y: 0, ...page.getSize() };
    const width = box.width;
    const height = box.height;
    const originX = box.x || 0;
    const originY = box.y || 0;
    templateDimensions[i] = { width, height, originX, originY, scaleFactor: width / canvasWidth };
  }

  const finalPdf = await PDFDocument.create();
  finalPdf.registerFontkit(fontkit);

  const embeddedStaticImages: {
    embedded: any;
    pageIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] = [];

  for (const imgItem of staticImages) {
    if (!imgItem.dataUrl) continue;
    try {
      const pngBytes = await normalizeImageDataToPngBytes(imgItem.dataUrl);
      if (pngBytes) {
        const embedded = await finalPdf.embedPng(pngBytes);
        embeddedStaticImages.push({
          embedded,
          pageIndex: imgItem.pageIndex,
          x: imgItem.x,
          y: imgItem.y,
          width: imgItem.width,
          height: imgItem.height,
        });
      }
    } catch (err) {
      console.error('Error embedding static image in PDF:', err);
    }
  }

  const fontRegistry: Record<string, any> = {
    'Helvetica': {
      regular: await finalPdf.embedFont(StandardFonts.Helvetica),
      bold: await finalPdf.embedFont(StandardFonts.HelveticaBold),
      italic: await finalPdf.embedFont(StandardFonts.HelveticaOblique),
      boldItalic: await finalPdf.embedFont(StandardFonts.HelveticaBoldOblique),
    },
    'Times New Roman': {
      regular: await finalPdf.embedFont(StandardFonts.TimesRoman),
      bold: await finalPdf.embedFont(StandardFonts.TimesRomanBold),
      italic: await finalPdf.embedFont(StandardFonts.TimesRomanItalic),
      boldItalic: await finalPdf.embedFont(StandardFonts.TimesRomanBoldItalic),
    },
    'Courier': {
      regular: await finalPdf.embedFont(StandardFonts.Courier),
      bold: await finalPdf.embedFont(StandardFonts.CourierBold),
      italic: await finalPdf.embedFont(StandardFonts.CourierOblique),
      boldItalic: await finalPdf.embedFont(StandardFonts.CourierBoldOblique),
    },
    'Symbol': {
      regular: await finalPdf.embedFont(StandardFonts.Symbol),
      bold: await finalPdf.embedFont(StandardFonts.Symbol),
      italic: await finalPdf.embedFont(StandardFonts.Symbol),
      boldItalic: await finalPdf.embedFont(StandardFonts.Symbol),
    },
    'ZapfDingbats': {
      regular: await finalPdf.embedFont(StandardFonts.ZapfDingbats),
      bold: await finalPdf.embedFont(StandardFonts.ZapfDingbats),
      italic: await finalPdf.embedFont(StandardFonts.ZapfDingbats),
      boldItalic: await finalPdf.embedFont(StandardFonts.ZapfDingbats),
    },
  };

  for (const [fontName, fontBuffer] of Object.entries(customFontRegistry)) {
    try {
      const embeddedCustomFont = await finalPdf.embedFont(fontBuffer);
      fontRegistry[fontName] = {
        regular: embeddedCustomFont,
        bold: embeddedCustomFont,
        italic: embeddedCustomFont,
        boldItalic: embeddedCustomFont,
      };
    } catch (err) {
      console.error(`Failed to embed custom font ${fontName}:`, err);
    }
  }

  const textFieldsByPage: Record<number, CanvasTextData[]> = {};
  const barcodesByPage: Record<number, CanvasBarcodeData[]> = {};
  const staticImagesByPage: Record<number, typeof embeddedStaticImages> = {};

  for (const i of activeTemplateIndices) {
    textFieldsByPage[i] = templateFields.filter((f) => (f.pageIndex ?? 0) === i);
    barcodesByPage[i] = barcodeFields.filter((b) => (b.pageIndex ?? 0) === i);
    staticImagesByPage[i] = embeddedStaticImages.filter((img) => (img.pageIndex ?? 0) === i);
  }

  const totalRecords = csvData.length;
  const embeddedBarcodeMap = new Map<string, any>();
  const YIELD_INTERVAL = 5;

  for (let rIdx = 0; rIdx < totalRecords; rIdx++) {
    const row = csvData[rIdx];

    if (onProgress && (rIdx % YIELD_INTERVAL === 0 || rIdx === totalRecords - 1)) {
      onProgress(rIdx + 1, totalRecords, `Rendering record ${rIdx + 1} of ${totalRecords}...`);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const copiedPages = await finalPdf.copyPages(pdfDoc, activeTemplateIndices);

    for (let loopIdx = 0; loopIdx < copiedPages.length; loopIdx++) {
      const page = copiedPages[loopIdx];
      finalPdf.addPage(page);

      const origPageIndex = activeTemplateIndices[loopIdx];
      const { height: pdfHeight, originX, originY, scaleFactor } = templateDimensions[origPageIndex];

      // Draw Static Images
      const pageStaticImages = staticImagesByPage[origPageIndex] || [];
      for (let sIdx = 0; sIdx < pageStaticImages.length; sIdx++) {
        const sImg = pageStaticImages[sIdx];
        const drawWidth = sImg.width * scaleFactor;
        const drawHeight = sImg.height * scaleFactor;
        const drawX = originX + (sImg.x * scaleFactor);
        const drawY = originY + pdfHeight - (sImg.y * scaleFactor) - drawHeight;

        page.drawImage(sImg.embedded, {
          x: drawX,
          y: drawY,
          width: drawWidth,
          height: drawHeight,
        });
      }

      // Draw Text Fields (with baseline alignment & multi-line support)
      const pageTextFields = textFieldsByPage[origPageIndex] || [];
      for (let tIdx = 0; tIdx < pageTextFields.length; tIdx++) {
        const field = pageTextFields[tIdx];

        let actualText = field.text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
          return row[key] !== undefined ? String(row[key]) : "";
        });

        let effectiveColor = field.color || "#000000";
        let isBold = field.fontWeight === "bold" || field.fontWeight === 700 || field.fontWeight === "700";
        let isItalic = field.fontStyle === "italic";

        if (field.rules && field.rules.length > 0) {
          for (let rk = 0; rk < field.rules.length; rk++) {
            const rule = field.rules[rk];
            if (evaluateCondition(actualText, rule)) {
              if (rule.color) effectiveColor = rule.color;
              if (rule.isBold !== undefined) isBold = rule.isBold;
              if (rule.isItalic !== undefined) isItalic = rule.isItalic;
            }
          }
        }

        if (field.isUppercase) {
          actualText = actualText.toUpperCase();
        }

        const effectiveFontSize = field.fontSize * scaleFactor;
        const boxWidth = (field.width || 0) * scaleFactor;
        const padOffset = (field.padding || 0) * scaleFactor;
        const basePdfX = originX + (field.x * scaleFactor) + padOffset;
        const lineSpacingFactor = field.lineHeight || 1.16;

        const { r, g, b } = hexToRgbFraction(effectiveColor);
        const requestedFont = field.fontFamily || "Helvetica";
        const targetFamilyKey = fontRegistry[requestedFont]
          ? requestedFont
          : PDF_FONT_FALLBACK_MAP[requestedFont] || "Helvetica";

        const selectedFontGroup = fontRegistry[targetFamilyKey] || fontRegistry["Helvetica"];

        let selectedFont = selectedFontGroup.regular;
        if (isBold && isItalic) {
          selectedFont = selectedFontGroup.boldItalic || selectedFontGroup.bold;
        } else if (isBold) {
          selectedFont = selectedFontGroup.bold;
        } else if (isItalic) {
          selectedFont = selectedFontGroup.italic || selectedFontGroup.regular;
        }

                // 1. Calculate usable dimensions
        const maxBoxWidth = Math.max(10, boxWidth - (padOffset * 2));
        const maxBoxHeight = ((field as any).height || 0) * scaleFactor;

        // 2. Helper to break text into lines matching boxWidth
        const wrapTextToWidth = (textToWrap: string, font: any, size: number, maxWidth: number): string[] => {
          const rawLines = textToWrap.split("\n");
          const wrapped: string[] = [];

          for (const rawLine of rawLines) {
            if (!rawLine.trim()) {
              wrapped.push("");
              continue;
            }
            const words = rawLine.split(" ");
            let currentLine = words[0] || "";

            for (let w = 1; w < words.length; w++) {
              const testLine = currentLine + " " + words[w];
              const testWidth = font.widthOfTextAtSize(testLine, size);
              if (testWidth <= maxWidth) {
                currentLine = testLine;
              } else {
                wrapped.push(currentLine);
                currentLine = words[w];
              }
            }
            wrapped.push(currentLine);
          }
          return wrapped;
        };

        // 3. Auto-shrink fontSize if content exceeds bounds
        let renderedFontSize = effectiveFontSize;
        let lines = wrapTextToWidth(actualText, selectedFont, renderedFontSize, maxBoxWidth);
        const minFontSize = Math.max(6, effectiveFontSize * 0.4);

        if (maxBoxHeight > 0) {
          let totalHeight = lines.length * (renderedFontSize * lineSpacingFactor);
          while ((totalHeight > maxBoxHeight || lines.some(l => selectedFont.widthOfTextAtSize(l, renderedFontSize) > maxBoxWidth + 2)) && renderedFontSize > minFontSize) {
            renderedFontSize -= 0.5;
            lines = wrapTextToWidth(actualText, selectedFont, renderedFontSize, maxBoxWidth);
            totalHeight = lines.length * (renderedFontSize * lineSpacingFactor);
          }
        }

        const singleLineHeight = renderedFontSize * lineSpacingFactor;

        // 4. Draw wrapped & scaled lines
        lines.forEach((lineText, lineIndex) => {
          let lineX = basePdfX;
          const fontBaselineOffset = renderedFontSize * 0.86;
          const lineY = originY + pdfHeight - ((field.y * scaleFactor) + padOffset) - fontBaselineOffset - (lineIndex * singleLineHeight);

          const textWidth = selectedFont.widthOfTextAtSize(lineText, renderedFontSize);
          if (field.textAlign === "center") {
            lineX = basePdfX + (maxBoxWidth - textWidth) / 2;
          } else if (field.textAlign === "right") {
            lineX = basePdfX + (maxBoxWidth - textWidth);
          }

          page.drawText(lineText, {
            x: lineX,
            y: lineY,
            size: renderedFontSize,
            font: selectedFont,
            color: rgb(r, g, b),
          });
        });
      }

      // Draw Barcodes
      const pageBarcodes = barcodesByPage[origPageIndex] || [];
      for (let bIdx = 0; bIdx < pageBarcodes.length; bIdx++) {
        const bc = pageBarcodes[bIdx];
        const actualVal = row[bc.field] !== undefined ? String(row[bc.field]) : '';
        if (!actualVal) continue;

        const cleanHex = (bc.barcodeColor || "#000000").replace("#", "").trim();
        const barcodeKey = `${bc.barcodeType}_${actualVal}_${cleanHex}`;

        let embeddedImg = embeddedBarcodeMap.get(barcodeKey);
        if (!embeddedImg) {
          const pngData = await generateBarcodePng(bc.barcodeType, actualVal, bc.barcodeColor || "#000000");
          if (pngData) {
            embeddedImg = await finalPdf.embedPng(pngData);
            if (embeddedBarcodeMap.size < 1000) {
              embeddedBarcodeMap.set(barcodeKey, embeddedImg);
            }
          }
        }

        if (embeddedImg) {
          const drawWidth = bc.width * scaleFactor;
          const drawHeight = bc.height * scaleFactor;
          const drawX = originX + (bc.x * scaleFactor);
          const drawY = originY + pdfHeight - (bc.y * scaleFactor) - drawHeight;

          page.drawImage(embeddedImg, {
            x: drawX,
            y: drawY,
            width: drawWidth,
            height: drawHeight,
          });
        }
      }
    }
  }

  if (onProgress) {
    onProgress(totalRecords, totalRecords, 'Compressing and compiling output document...');
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  barcodeBufferCache.clear();
  return await finalPdf.save({ useObjectStreams: true });
}
