'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import Papa from 'papaparse';
import bwipjs from 'bwip-js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  generateVDP,
  CanvasTextData,
  CanvasBarcodeData,
  CanvasStaticImageData,
  ConditionalRule,
  evaluateCondition,
  parseRangeString,
} from '@/utils/pdfGenerator';

const SYSTEM_FONT_GROUPS = [
  {
    category: 'Standard Sans-Serif',
    fonts: [
      { label: 'Arial', value: 'Arial' },
      { label: 'Helvetica', value: 'Helvetica' },
      { label: 'Verdana', value: 'Verdana' },
      { label: 'Trebuchet MS', value: 'Trebuchet MS' },
      { label: 'Gill Sans', value: 'Gill Sans' },
      { label: 'Segoe UI', value: 'Segoe UI' },
    ],
  },
  {
    category: 'Standard Serif',
    fonts: [
      { label: 'Times New Roman', value: 'Times New Roman' },
      { label: 'Georgia', value: 'Georgia' },
      { label: 'Garamond', value: 'Garamond' },
      { label: 'Palatino', value: 'Palatino' },
      { label: 'Baskerville', value: 'Baskerville' },
    ],
  },
  {
    category: 'Standard Monospace',
    fonts: [
      { label: 'Courier New', value: 'Courier New' },
      { label: 'Courier', value: 'Courier' },
      { label: 'Lucida Console', value: 'Lucida Console' },
      { label: 'Monaco', value: 'Monaco' },
    ],
  },
  {
    category: 'Standard Display & Script',
    fonts: [
      { label: 'Impact', value: 'Impact' },
      { label: 'Comic Sans MS', value: 'Comic Sans MS' },
      { label: 'Symbol', value: 'Symbol' },
      { label: 'ZapfDingbats', value: 'ZapfDingbats' },
    ],
  },
  {
    category: 'Google Fonts (On-Demand)',
    fonts: [
      {
        label: 'Playfair Display',
        value: 'Playfair_Display',
        url: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-400-normal.ttf',
      },
      {
        label: 'Montserrat',
        value: 'Montserrat',
        url: 'https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-400-normal.ttf',
      },
      {
        label: 'Cinzel',
        value: 'Cinzel',
        url: 'https://cdn.jsdelivr.net/fontsource/fonts/cinzel@latest/latin-400-normal.ttf',
      },
      {
        label: 'Dancing Script',
        value: 'Dancing_Script',
        url: 'https://cdn.jsdelivr.net/fontsource/fonts/dancing-script@latest/latin-400-normal.ttf',
      },
    ],
  },
];

const BASE_CANVAS_WIDTH = 850;
const ZOOM_LEVELS = [
  { label: "50%", scale: 0.5 },
  { label: "100%", scale: 1.0 },
  { label: "150%", scale: 1.5 },
  { label: "200%", scale: 2.0 },
];

const SNAP_OPTIONS = [
  { label: 'Snap: Off', value: 0 },
  { label: 'Snap: 10px', value: 10 },
  { label: 'Snap: 20px', value: 20 },
];

const RULER_SIZE = 28;
const ROWS_PER_TABLE_PAGE = 8;

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<any>(null);
  const fabricModuleRef = useRef<any>(null);

  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const currentPageIndexRef = useRef<number>(0);
  const pdfDocProxyRef = useRef<any>(null);
  const pagesStorageRef = useRef<Record<number, any[]>>({});

  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const isHistoryLockedRef = useRef(false);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [selectedTag, setSelectedTag] = useState<any>(null);
  const [selectedBarcodeColor, setSelectedBarcodeColor] = useState<string>("#000000");
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [selectedBarcode, setSelectedBarcode] = useState<any>(null);
  const [selectedImageMask, setSelectedImageMask] = useState<'circle' | 'rounded' | 'square' | 'none'>('none');
  const [hasSelection, setHasSelection] = useState<boolean>(false);
  const [transformX, setTransformX] = useState<number>(0);
  const [transformY, setTransformY] = useState<number>(0);
  const [transformW, setTransformW] = useState<number>(0);
  const [transformH, setTransformH] = useState<number>(0);
  const [transformAngle, setTransformAngle] = useState<number>(0);
  const [isRatioLocked, setIsRatioLocked] = useState<boolean>(false);

  const [canvasWidth, setCanvasWidth] = useState<number>(850);
  const [canvasHeight, setCanvasHeight] = useState<number>(1100);

  const [gridSnap, setGridSnap] = useState<number>(0);
  const gridSnapRef = useRef<number>(0);
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(false);

  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const isPreviewModeRef = useRef<boolean>(false);
  const [previewRowIndex, setPreviewRowIndex] = useState<number>(0);
  const previewRowIndexRef = useRef<number>(0);

  const [isTableExpanded, setIsTableExpanded] = useState<boolean>(false);
  const [tableCurrentPage, setTableCurrentPage] = useState<number>(1);
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');

  const [guideBounds, setGuideBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [viewportScroll, setViewportScroll] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const viewportScrollContainerRef = useRef<HTMLDivElement>(null);

  const [customFontsList, setCustomFontsList] = useState<{ label: string; value: string }[]>([]);
  const customFontsRef = useRef<Record<string, ArrayBuffer>>({});
  const [loadingFont, setLoadingFont] = useState<boolean>(false);

  const [fontSize, setFontSize] = useState<number>(22);
  const [textColor, setTextColor] = useState<string>('#1e3a8a');
  const [isBold, setIsBold] = useState<boolean>(false);
  const [isItalic, setIsItalic] = useState<boolean>(false);
  const [isUppercase, setIsUppercase] = useState<boolean>(false);
  const [fontFamily, setFontFamily] = useState<string>('Arial');
  const [textAlign, setTextAlign] = useState<string>('left');

  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [currentTagRules, setCurrentTagRules] = useState<ConditionalRule[]>([]);

  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const csvDataRef = useRef<any[]>([]);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const [showScopeModal, setShowScopeModal] = useState<boolean>(false);
  const [recordScopeMode, setRecordScopeMode] = useState<'all' | 'custom' | 'filtered'>('all');
  const [customRecordRange, setCustomRecordRange] = useState<string>('1-10');
  const [pageScopeMode, setPageScopeMode] = useState<'all' | 'custom'>('all');
  const [customPageRange, setCustomPageRange] = useState<string>('1');

  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressStage, setProgressStage] = useState<string>('');
  const [progressCount, setProgressCount] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  const [selectedBarcodeCol, setSelectedBarcodeCol] = useState<string>('');

  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [exportFilename, setExportFilename] = useState<string>('CSVCanvas_Print_Ready');
  const pendingBlobRef = useRef<Blob | null>(null);

  // Template dropdown toggle
  const [showTemplateDropdown, setShowTemplateDropdown] = useState<boolean>(false);

  const serializeFabricObject = (obj: any) => {
    const data = obj.toObject([
      'selectable',
      'hasControls',
      'fontWeight',
      'fontStyle',
      'fill',
      'tagColor',
      'fontFamily',
      'textAlign',
      'isGuideLine',
      'guideOrientation',
      'rawTemplateTag',
      'isUppercase',
      'isBarcode',
      'barcodeType',
      'barcodeField',
      'pageIndex',
      'rules',
      'isStaticImage',
      'imageDataUrl',
      'originalRawDataUrl',
      'maskShape',
        'barcodeColor',
    ]);
    data.pageIndex = currentPageIndexRef.current;
    if (obj.isStaticImage) {
      data.isStaticImage = true;
      data.imageDataUrl = obj.imageDataUrl || obj.getSrc?.() || (obj._element && obj._element.src);
      data.originalRawDataUrl = obj.originalRawDataUrl || data.imageDataUrl;
      data.maskShape = obj.maskShape || 'none';
    }
    return data;
  };

  const saveState = (canvas: any) => {
    if (isHistoryLockedRef.current || !canvas) return;
    const json = JSON.stringify(
      canvas.toDatalessJSON([
        'selectable',
        'hasControls',
        'fontWeight',
        'fontStyle',
        'fill',
        'tagColor',
        'fontFamily',
        'textAlign',
        'isGuideLine',
        'guideOrientation',
        'rawTemplateTag',
        'isUppercase',
        'isBarcode',
        'barcodeType',
        'barcodeField',
        'pageIndex',
        'rules',
        'isStaticImage',
        'imageDataUrl',
        'originalRawDataUrl',
        'maskShape',
      ])
    );
    undoStackRef.current.push(json);
    if (undoStackRef.current.length > 30) undoStackRef.current.shift();
    redoStackRef.current = [];
    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(false);
  };

  const syncTransformValues = (obj: any) => {
    if (!obj) {
      setTransformX(0);
      setTransformY(0);
      setTransformW(0);
      setTransformH(0);
      setTransformAngle(0);
      return;
    }
    setTransformX(Math.round(obj.left || 0));
    setTransformY(Math.round(obj.top || 0));
    setTransformW(Math.round(obj.getScaledWidth ? obj.getScaledWidth() : (obj.width || 0) * (obj.scaleX || 1)));
    setTransformH(Math.round(obj.getScaledHeight ? obj.getScaledHeight() : (obj.height || 0) * (obj.scaleY || 1)));
    setTransformAngle(Math.round(obj.angle || 0) % 360);
  };

  const handleTransformChange = (
    field: 'x' | 'y' | 'w' | 'h' | 'angle',
    val: number
  ) => {
    const canvas = fabricCanvasRef.current;
    const obj = canvas?.getActiveObject();
    if (!canvas || !obj) return;

    if (field === 'x') {
      obj.set({ left: val });
      setTransformX(val);
    } else if (field === 'y') {
      obj.set({ top: val });
      setTransformY(val);
    } else if (field === 'angle') {
      const normalized = ((val % 360) + 360) % 360;
      obj.set({ angle: normalized });
      setTransformAngle(normalized);
    } else if (field === 'w') {
      const targetW = Math.max(5, val);
      const currentW = obj.getScaledWidth ? obj.getScaledWidth() : (obj.width || 1) * (obj.scaleX || 1);
      const currentH = obj.getScaledHeight ? obj.getScaledHeight() : (obj.height || 1) * (obj.scaleY || 1);
      const ratio = currentH / (currentW || 1);

      if (obj.type === 'textbox') {
        obj.set({ width: targetW / (obj.scaleX || 1) });
      } else {
        const baseWidth = obj.width || 1;
        obj.set({ scaleX: targetW / baseWidth });
      }
      setTransformW(Math.round(targetW));

      if (isRatioLocked) {
        const targetH = Math.round(targetW * ratio);
        const baseHeight = obj.height || 1;
        obj.set({ scaleY: targetH / baseHeight });
        setTransformH(targetH);
      }
    } else if (field === 'h') {
      const targetH = Math.max(5, val);
      const currentW = obj.getScaledWidth ? obj.getScaledWidth() : (obj.width || 1) * (obj.scaleX || 1);
      const currentH = obj.getScaledHeight ? obj.getScaledHeight() : (obj.height || 1) * (obj.scaleY || 1);
      const ratio = currentW / (currentH || 1);

      const baseHeight = obj.height || 1;
      obj.set({ scaleY: targetH / baseHeight });
      setTransformH(Math.round(targetH));

      if (isRatioLocked) {
        const targetW = Math.round(targetH * ratio);
        if (obj.type === 'textbox') {
          obj.set({ width: targetW / (obj.scaleX || 1) });
        } else {
          const baseWidth = obj.width || 1;
          obj.set({ scaleX: targetW / baseWidth });
        }
        setTransformW(targetW);
      }
    }

    obj.setCoords();
    canvas.renderAll();
    saveState(canvas);
  };

  const syncToolbarWithActiveObject = (obj: any) => {
    syncTransformValues(obj);
    if (obj && obj.isBarcode) {
      setSelectedBarcode(obj);
      setSelectedBarcodeColor(obj.barcodeColor || "#000000");
    } else {
      setSelectedBarcode(null);
    }
    if (!obj) {
      setSelectedTag(null);
      setSelectedImage(null);
      setSelectedBarcode(null);
      setSelectedImageMask('none');
      setHasSelection(false);
      setGuideBounds(null);
      setCurrentTagRules([]);
      return;
    }

    setHasSelection(true);

    if (obj.type === 'textbox') {
      setSelectedTag(obj);
      setSelectedImage(null);
      setSelectedImageMask('none');
      setFontSize(Math.round(obj.fontSize * (obj.scaleY || 1)));
      setTextColor(obj.tagColor || obj.fill || '#1e3a8a');
      setIsBold(obj.fontWeight === 'bold' || obj.fontWeight === 700 || obj.fontWeight === '700');
      setIsItalic(obj.fontStyle === 'italic');
      setIsUppercase(Boolean(obj.isUppercase));
      setFontFamily(obj.fontFamily || 'Arial');
      setTextAlign(obj.textAlign || 'left');
      setCurrentTagRules(obj.rules || []);
    } else if (obj.isStaticImage) {
      setSelectedImage(obj);
      setSelectedImageMask(obj.maskShape || 'none');
      setSelectedTag(null);
      setCurrentTagRules([]);
    } else {
      setSelectedTag(null);
      setSelectedImage(null);
      setSelectedImageMask('none');
      setCurrentTagRules([]);
    }

    const b = obj.getBoundingRect();
    setGuideBounds({ left: b.left, top: b.top, width: b.width, height: b.height });
  };

  const handleUndo = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || undoStackRef.current.length <= 1) return;

    isHistoryLockedRef.current = true;
    const currentState = undoStackRef.current.pop()!;
    redoStackRef.current.push(currentState);

    const targetState = undoStackRef.current[undoStackRef.current.length - 1];
    canvas.loadFromJSON(targetState, () => {
      canvas.renderAll();
      isHistoryLockedRef.current = false;
      setCanUndo(undoStackRef.current.length > 1);
      setCanRedo(redoStackRef.current.length > 0);
      syncToolbarWithActiveObject(canvas.getActiveObject());
    });
  };

  const handleRedo = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || redoStackRef.current.length === 0) return;

    isHistoryLockedRef.current = true;
    const targetState = redoStackRef.current.pop()!;
    undoStackRef.current.push(targetState);

    canvas.loadFromJSON(targetState, () => {
      canvas.renderAll();
      isHistoryLockedRef.current = false;
      setCanUndo(true);
      setCanRedo(redoStackRef.current.length > 0);
      syncToolbarWithActiveObject(canvas.getActiveObject());
    });
  };

    const handleResetProject = () => {
    const confirmed = window.confirm(
      "Start over? This will remove the current template and all canvas elements. Your uploaded CSV data will remain loaded."
    );
    if (!confirmed) return;

    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.clear();
      canvas.backgroundColor = "#ffffff";
      canvas.renderAll();
    }

    setPdfBytes(null);
    pdfDocProxyRef.current = null;
    setTotalPages(1);
    setCurrentPageIndex(0);
    currentPageIndexRef.current = 0;
    pagesStorageRef.current = {};
    setIsReady(false);
  };

  const handleDeleteSelected = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects();
    if (activeObjects && activeObjects.length > 0) {
      canvas.discardActiveGroup ? canvas.discardActiveGroup() : canvas.discardActiveObject();
      activeObjects.forEach((obj: any) => canvas.remove(obj));
      canvas.renderAll();
      saveState(canvas);
      setSelectedTag(null);
      setSelectedImage(null);
      setSelectedImageMask('none');
      setHasSelection(false);
      setGuideBounds(null);
    }
  };

  const alignSelectedToArtboard = (direction: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom') => {
    const canvas = fabricCanvasRef.current;
    const activeObj = canvas?.getActiveObject();
    if (!canvas || !activeObj) return;

    const bound = activeObj.getBoundingRect();
    const cWidth = canvas.width;
    const cHeight = canvas.height;

    const deltaX = activeObj.left - bound.left;
    const deltaY = activeObj.top - bound.top;

    switch (direction) {
      case 'left':
        activeObj.set({ left: 20 + deltaX });
        break;
      case 'centerH':
        activeObj.set({ left: Math.round((cWidth - bound.width) / 2) + deltaX });
        break;
      case 'right':
        activeObj.set({ left: Math.round(cWidth - bound.width - 20) + deltaX });
        break;
      case 'top':
        activeObj.set({ top: 20 + deltaY });
        break;
      case 'centerV':
        activeObj.set({ top: Math.round((cHeight - bound.height) / 2) + deltaY });
        break;
      case 'bottom':
        activeObj.set({ top: Math.round(cHeight - bound.height - 20) + deltaY });
        break;
    }

    activeObj.setCoords();
    canvas.renderAll();
    saveState(canvas);
    const updatedBound = activeObj.getBoundingRect();
    setGuideBounds({ left: updatedBound.left, top: updatedBound.top, width: updatedBound.width, height: updatedBound.height });
  };

  const addGuideLine = (orientation: 'horizontal' | 'vertical') => {
    const canvas = fabricCanvasRef.current;
    const fb = fabricModuleRef.current;
    if (!canvas || !fb) return;

    const snap = gridSnapRef.current || 1;
    let line: any;

    if (orientation === 'horizontal') {
      const topPos = Math.round((canvas.height / 3) / snap) * snap;
      line = new fb.Line([0, topPos, canvas.width, topPos], {
        stroke: '#38bdf8',
        strokeWidth: 1.5,
        strokeDashArray: [6, 4],
        selectable: true,
        hasControls: false,
        lockMovementX: true,
        lockMovementY: false,
        hoverCursor: 'ns-resize',
        isGuideLine: true,
        guideOrientation: 'horizontal',
        pageIndex: currentPageIndexRef.current,
      });
    } else {
      const leftPos = Math.round((canvas.width / 2) / snap) * snap;
      line = new fb.Line([leftPos, 0, leftPos, canvas.height], {
        stroke: '#38bdf8',
        strokeWidth: 1.5,
        strokeDashArray: [6, 4],
        selectable: true,
        hasControls: false,
        lockMovementX: false,
        lockMovementY: true,
        hoverCursor: 'ew-resize',
        isGuideLine: true,
        guideOrientation: 'vertical',
        pageIndex: currentPageIndexRef.current,
      });
    }

    canvas.add(line);
    canvas.setActiveObject(line);
    canvas.renderAll();
    saveState(canvas);
  };

  const clearAllGuides = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const guides = canvas.getObjects().filter((obj: any) => obj.isGuideLine);
    if (guides.length === 0) return;

    guides.forEach((g: any) => canvas.remove(g));
    canvas.discardActiveObject();
    canvas.renderAll();
    saveState(canvas);
    setSelectedTag(null);
    setSelectedImage(null);
    setSelectedImageMask('none');
    setHasSelection(false);
    setGuideBounds(null);
  };

  const handleStaticImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const canvas = fabricCanvasRef.current;
    const fb = fabricModuleRef.current;
    if (!file || !canvas || !fb) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawUrl = event.target?.result as string;
      if (!rawUrl) return;

      const tempImg = new Image();
      tempImg.onload = () => {
        const offscreen = document.createElement('canvas');
        offscreen.width = tempImg.naturalWidth || tempImg.width || 120;
        offscreen.height = tempImg.naturalHeight || tempImg.height || 120;
        const ctx = offscreen.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(tempImg, 0, 0);

        const cleanPngDataUrl = offscreen.toDataURL('image/png');

        fb.Image.fromURL(cleanPngDataUrl, (img: any) => {
          const snap = gridSnapRef.current || 1;
          const maxDimension = 160;
          let scale = 1;
          if (img.width > maxDimension || img.height > maxDimension) {
            scale = maxDimension / Math.max(img.width, img.height);
          }

          img.set({
            left: Math.round(120 / snap) * snap,
            top: Math.round(120 / snap) * snap,
            scaleX: scale,
            scaleY: scale,
            cornerColor: '#38bdf8',
            cornerSize: 10,
            transparentCorners: false,
            hasControls: true,
            selectable: true,
            isStaticImage: true,
            imageDataUrl: cleanPngDataUrl,
            originalRawDataUrl: cleanPngDataUrl,
            maskShape: 'none',
            pageIndex: currentPageIndexRef.current,
          });

          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
          saveState(canvas);
          syncToolbarWithActiveObject(img);
        });
      };
      tempImg.src = rawUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const applyImageMask = (maskType: 'circle' | 'rounded' | 'square' | 'none') => {
    const canvas = fabricCanvasRef.current;
    const fb = fabricModuleRef.current;
    const activeObj = canvas?.getActiveObject();
    if (!canvas || !fb || !activeObj || !activeObj.isStaticImage) return;

    const sourceDataUrl = activeObj.originalRawDataUrl || activeObj.imageDataUrl;
    if (!sourceDataUrl) return;

    const tempImg = new Image();
    tempImg.crossOrigin = 'anonymous';
    tempImg.onload = () => {
      const origW = tempImg.naturalWidth || tempImg.width || 100;
      const origH = tempImg.naturalHeight || tempImg.height || 100;

      const offscreen = document.createElement('canvas');
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      if (maskType === 'circle') {
        const side = Math.min(origW, origH);
        offscreen.width = side;
        offscreen.height = side;

        ctx.beginPath();
        ctx.arc(side / 2, side / 2, side / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();

        const sx = (origW - side) / 2;
        const sy = (origH - side) / 2;
        ctx.drawImage(tempImg, sx, sy, side, side, 0, 0, side, side);
      } else if (maskType === 'rounded') {
        offscreen.width = origW;
        offscreen.height = origH;
        const radius = Math.min(origW, origH) * 0.18;

        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(origW - radius, 0);
        ctx.quadraticCurveTo(origW, 0, origW, radius);
        ctx.lineTo(origW, origH - radius);
        ctx.quadraticCurveTo(origW, origH, origW - radius, origH);
        ctx.lineTo(radius, origH);
        ctx.quadraticCurveTo(0, origH, 0, origH - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(tempImg, 0, 0);
      } else if (maskType === 'square') {
        const side = Math.min(origW, origH);
        offscreen.width = side;
        offscreen.height = side;

        const sx = (origW - side) / 2;
        const sy = (origH - side) / 2;
        ctx.drawImage(tempImg, sx, sy, side, side, 0, 0, side, side);
      } else {
        offscreen.width = origW;
        offscreen.height = origH;
        ctx.drawImage(tempImg, 0, 0);
      }

      const maskedDataUrl = offscreen.toDataURL('image/png');

      activeObj.setSrc(maskedDataUrl, () => {
        activeObj.set({
          imageDataUrl: maskedDataUrl,
          maskShape: maskType,
        });
        activeObj.setCoords();
        canvas.renderAll();
        saveState(canvas);
        setSelectedImageMask(maskType);
        const b = activeObj.getBoundingRect();
        setGuideBounds({ left: b.left, top: b.top, width: b.width, height: b.height });
      });
    };
    tempImg.src = sourceDataUrl;
  };

  const createBarcodeDataUrl = async (bcid: string, text: string, color: string = "#000000"): Promise<string> => {
    return new Promise((resolve) => {
      const offscreen = document.createElement("canvas");
      try {
        const cleanHex = color.replace("#", "").trim() || "000000";
        let safeText = String(text ?? "").trim();
        if (bcid === "code39") {
          safeText = safeText.toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, "");
          if (!safeText) safeText = "SAMPLE";
        } else if (bcid === "code128") {
          safeText = safeText.replace(/[^\x00-\x7F]/g, "");
          if (!safeText) safeText = "SAMPLE";
        }

        const opts: Record<string, any> = {
          bcid,
          text: safeText || "SAMPLE",
          scale: 3,
          includetext: bcid !== "qrcode",
          textxalign: "center",
          barcolor: cleanHex,
          textcolor: cleanHex,
        };
        if (bcid !== 'qrcode') {
          opts.height = 10;
        }

        bwipjs.toCanvas(offscreen, opts as any);
        resolve(offscreen.toDataURL('image/png'));
      } catch (e) {
        console.error('Barcode rendering error:', e);
        resolve('');
      }
    });
  };

  
  const handleBarcodeColorChange = async (newColor: string) => {
    setSelectedBarcodeColor(newColor);
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject() as any;
    if (!active || !active.isBarcode) return;

    active.barcodeColor = newColor;

    const val = isPreviewModeRef.current
      ? (csvDataRef.current[previewRowIndexRef.current] || {})[active.barcodeField] || "SAMPLE"
      : active.rawTemplateTag || active.barcodeField || "SAMPLE";

    const newUrl = await createBarcodeDataUrl(active.barcodeType, String(val), newColor);
    if (newUrl) {
      active.setSrc(newUrl, () => {
        canvas.renderAll();
        saveState(canvas);
      });
    }
  };

  const handleBarcodeTypeChange = async (newType: 'qrcode' | 'code128' | 'code39') => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject() as any;
    if (!active || !active.isBarcode) return;

    active.barcodeType = newType;
    const val = isPreviewModeRef.current
      ? (csvDataRef.current[previewRowIndexRef.current] || {})[active.barcodeField] || "SAMPLE"
      : active.rawTemplateTag || active.barcodeField || "SAMPLE";

    const newUrl = await createBarcodeDataUrl(newType, String(val), active.barcodeColor || "#000000");
    if (newUrl) {
      active.setSrc(newUrl, () => {
        canvas.renderAll();
        saveState(canvas);
        setSelectedBarcode({ ...active });
      });
    }
  };

  const addBarcodeToCanvas = async (headerName: string, barcodeType: 'qrcode' | 'code128' | 'code39') => {
    const canvas = fabricCanvasRef.current;
    const fb = fabricModuleRef.current;
    if (!canvas || !fb) return;

    const snap = gridSnapRef.current || 1;
    const rowVal = csvDataRef.current[previewRowIndexRef.current]?.[headerName] || headerName;
    const dataUrl = await createBarcodeDataUrl(barcodeType, String(rowVal));
    if (!dataUrl) return;

    fb.Image.fromURL(dataUrl, (img: any) => {
      const targetWidth = barcodeType === 'qrcode' ? 120 : 180;
      const scale = targetWidth / (img.width || 1);

      img.set({
        left: Math.round(100 / snap) * snap,
        top: Math.round(100 / snap) * snap,
        scaleX: scale,
        scaleY: scale,
        cornerColor: '#38bdf8',
        cornerSize: 10,
        transparentCorners: false,
        hasControls: true,
        selectable: true,
        isBarcode: true,
        barcodeType,
        barcodeField: headerName,
        barcodeColor: "#000000",
        rawTemplateTag: `{{${headerName}}}`,
        pageIndex: currentPageIndexRef.current,
      });

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      saveState(canvas);
      syncToolbarWithActiveObject(img);
    });
  };

  const applyDataPreview = async (enablePreview: boolean, rowIndex: number) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const data = csvDataRef.current;
    const currentRow = data && data[rowIndex] ? data[rowIndex] : {};

    canvas.getObjects("textbox").forEach((obj: any) => {
      if (obj.isGuideLine) return;
      if (!obj.rawTemplateTag) {
        obj.rawTemplateTag = obj.text;
      }

      let displayText = obj.rawTemplateTag;
      let effectiveColor = obj.tagColor || obj.fill || "#0f172a";
      let effectiveBold = obj.fontWeight === "bold" || obj.fontWeight === 700 || obj.fontWeight === "700";
      let effectiveItalic = obj.fontStyle === "italic";

      if (enablePreview) {
        // Replace all instances of {{columnName}} dynamically
        displayText = obj.rawTemplateTag.replace(/\{\{\s*(\w+)\s*\}\}/g, (_: string, colName: string) => {
          return currentRow[colName] !== undefined ? String(currentRow[colName]) : `{{${colName}}}`;
        });

        if (obj.rules && obj.rules.length > 0) {
          for (const rule of obj.rules) {
            if (evaluateCondition(displayText, rule)) {
              if (rule.color) effectiveColor = rule.color;
              if (rule.isBold !== undefined) effectiveBold = rule.isBold;
              if (rule.isItalic !== undefined) effectiveItalic = rule.isItalic;
            }
          }
        }
      }

      if (obj.isUppercase) {
        displayText = displayText.toUpperCase();
      }

      obj.set({
        text: displayText,
        fill: effectiveColor,
        fontWeight: effectiveBold ? "bold" : "normal",
        fontStyle: effectiveItalic ? "italic" : "normal",
      });
    });

    const barcodeObjs = canvas.getObjects().filter((obj: any) => obj.isBarcode);
    for (const bObj of barcodeObjs) {
      const val = enablePreview
        ? (currentRow[bObj.barcodeField] !== undefined ? String(currentRow[bObj.barcodeField]) : bObj.barcodeField)
        : bObj.barcodeField;

      const newUrl = await createBarcodeDataUrl(bObj.barcodeType, String(val), bObj.barcodeColor || "#000000");
      if (newUrl) {
        bObj.setSrc(newUrl, () => {
          canvas.renderAll();
        });
      }
    }

    canvas.renderAll();
    const active = canvas.getActiveObject();
    if (active) {
      const b = active.getBoundingRect();
      setGuideBounds({ left: b.left, top: b.top, width: b.width, height: b.height });
    }
  };

  const togglePreviewMode = () => {
    const nextVal = !isPreviewMode;
    setIsPreviewMode(nextVal);
    isPreviewModeRef.current = nextVal;
    applyDataPreview(nextVal, previewRowIndexRef.current);
  };

  const selectRecordDirectly = (rowIndex: number) => {
    setPreviewRowIndex(rowIndex);
    previewRowIndexRef.current = rowIndex;
    if (!isPreviewModeRef.current) {
      setIsPreviewMode(true);
      isPreviewModeRef.current = true;
    }
    applyDataPreview(true, rowIndex);
  };

  const handleRowStep = (delta: number) => {
    if (csvDataRef.current.length === 0) return;
    const nextIdx = Math.max(0, Math.min(csvDataRef.current.length - 1, previewRowIndexRef.current + delta));
    setPreviewRowIndex(nextIdx);
    previewRowIndexRef.current = nextIdx;
    if (isPreviewModeRef.current) {
      applyDataPreview(true, nextIdx);
    }
  };

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fontName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');

    try {
      const buffer = await file.arrayBuffer();
      customFontsRef.current[fontName] = buffer.slice(0);

      const fontFace = new FontFace(fontName, buffer);
      await fontFace.load();
      document.fonts.add(fontFace);

      setCustomFontsList((prev) => [...prev, { label: `${fontName} (Uploaded)`, value: fontName }]);
      handleFontFamilyChange(fontName);

      alert(`Font "${fontName}" loaded successfully!`);
    } catch (err) {
      console.error(err);
      alert('Could not parse font file. Ensure it is a valid TTF or OTF format.');
    }
  };

  const handleFontSizeChange = (newSize: number) => {
    const canvas = fabricCanvasRef.current;
    const activeObj = canvas?.getActiveObject();
    if (activeObj && activeObj.type === 'textbox') {
      activeObj.set({ fontSize: newSize, scaleX: 1, scaleY: 1 });
      setFontSize(newSize);
      canvas.renderAll();
      saveState(canvas);
      const b = activeObj.getBoundingRect();
      setGuideBounds({ left: b.left, top: b.top, width: b.width, height: b.height });
    }
  };

  const handleColorChange = (newColor: string) => {
    const canvas = fabricCanvasRef.current;
    const activeObj = canvas?.getActiveObject();
    if (activeObj && activeObj.type === 'textbox') {
      activeObj.set({ fill: newColor, tagColor: newColor });
      setTextColor(newColor);
      canvas.renderAll();
      saveState(canvas);
    }
  };

  const handleBoldToggle = () => {
    const canvas = fabricCanvasRef.current;
    const activeObj = canvas?.getActiveObject();
    if (activeObj && activeObj.type === 'textbox') {
      const currentIsBold = activeObj.fontWeight === 'bold' || activeObj.fontWeight === 700 || activeObj.fontWeight === '700';
      const nextWeight = currentIsBold ? 'normal' : 'bold';
      activeObj.set({ fontWeight: nextWeight });
      setIsBold(!currentIsBold);
      canvas.renderAll();
      saveState(canvas);
      const b = activeObj.getBoundingRect();
      setGuideBounds({ left: b.left, top: b.top, width: b.width, height: b.height });
    }
  };

  const handleItalicToggle = () => {
    const canvas = fabricCanvasRef.current;
    const activeObj = canvas?.getActiveObject();
    if (activeObj && activeObj.type === 'textbox') {
      const currentIsItalic = activeObj.fontStyle === 'italic';
      const nextStyle = currentIsItalic ? 'normal' : 'italic';
      activeObj.set({ fontStyle: nextStyle });
      setIsItalic(!currentIsItalic);
      canvas.renderAll();
      saveState(canvas);
      const b = activeObj.getBoundingRect();
      setGuideBounds({ left: b.left, top: b.top, width: b.width, height: b.height });
    }
  };

  const handleUppercaseToggle = () => {
    const canvas = fabricCanvasRef.current;
    const activeObj = canvas?.getActiveObject();
    if (activeObj && activeObj.type === 'textbox') {
      const nextUppercase = !isUppercase;
      activeObj.set({ isUppercase: nextUppercase });

      const baseText = isPreviewModeRef.current
        ? (csvDataRef.current[previewRowIndexRef.current]?.[activeObj.rawTemplateTag?.replace(/{{|}}/g, '').trim()] || activeObj.rawTemplateTag)
        : (activeObj.rawTemplateTag || activeObj.text);

      activeObj.set({ text: nextUppercase ? baseText.toUpperCase() : baseText });
      setIsUppercase(nextUppercase);
      canvas.renderAll();
      saveState(canvas);
      const b = activeObj.getBoundingRect();
      setGuideBounds({ left: b.left, top: b.top, width: b.width, height: b.height });
    }
  };

  const handleFontFamilyChange = async (newFont: string) => {
    setFontFamily(newFont);
    const canvas = fabricCanvasRef.current;
    const activeObj = canvas?.getActiveObject();

    const allFontsFlat = SYSTEM_FONT_GROUPS.flatMap((g) => g.fonts);
    const fontMeta = allFontsFlat.find((f: any) => f.value === newFont) as any;

    if (fontMeta && fontMeta.url && !customFontsRef.current[newFont]) {
      setLoadingFont(true);
      try {
        const res = await fetch(fontMeta.url);
        const buffer = await res.arrayBuffer();
        customFontsRef.current[newFont] = buffer.slice(0);

        const fontFace = new FontFace(newFont, buffer);
        await fontFace.load();
        document.fonts.add(fontFace);
      } catch (err) {
        console.error('Failed to load remote font:', err);
      }
      setLoadingFont(false);
    }

    if (activeObj && activeObj.type === 'textbox') {
      activeObj.set({ fontFamily: newFont });
      canvas.renderAll();
      saveState(canvas);
      const b = activeObj.getBoundingRect();
      setGuideBounds({ left: b.left, top: b.top, width: b.width, height: b.height });
    }
  };

  const handleAlignChange = (alignment: 'left' | 'center' | 'right') => {
    const canvas = fabricCanvasRef.current;
    const activeObj = canvas?.getActiveObject();
    if (activeObj && activeObj.type === 'textbox') {
      activeObj.set({ textAlign: alignment });
      setTextAlign(alignment);
      canvas.renderAll();
      saveState(canvas);
    }
  };

  const handleSnapOptionChange = (val: number) => {
    setGridSnap(val);
    gridSnapRef.current = val;
  };

  const handleAddRule = () => {
    const newRule: ConditionalRule = {
      id: Math.random().toString(36).substring(2, 9),
      operator: 'equals',
      value: '',
      color: '#dc2626',
      isBold: true,
      isItalic: false,
    };
    const updated = [...currentTagRules, newRule];
    setCurrentTagRules(updated);
    commitRulesToObject(updated);
  };

  const handleUpdateRule = (ruleId: string, patch: Partial<ConditionalRule>) => {
    const updated = currentTagRules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r));
    setCurrentTagRules(updated);
    commitRulesToObject(updated);
  };

  const handleDeleteRule = (ruleId: string) => {
    const updated = currentTagRules.filter((r) => r.id !== ruleId);
    setCurrentTagRules(updated);
    commitRulesToObject(updated);
  };

  const commitRulesToObject = (rules: ConditionalRule[]) => {
    const canvas = fabricCanvasRef.current;
    const activeObj = canvas?.getActiveObject();
    if (activeObj && activeObj.type === 'textbox') {
      activeObj.set({ rules });
      saveState(canvas);
      if (isPreviewModeRef.current) {
        applyDataPreview(true, previewRowIndexRef.current);
      }
    }
  };

  const handleSaveTemplatePreset = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const currentObjs = canvas.getObjects().filter((obj: any) => !obj.isBackground);
    pagesStorageRef.current[currentPageIndexRef.current] = currentObjs.map(serializeFabricObject);

    const presetPayload = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      canvasWidth,
      canvasHeight,
      totalPages,
      gridSnap,
      pagesStorage: pagesStorageRef.current,
      csvHeaders,
    };

    const blob = new Blob([JSON.stringify(presetPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CSVCanvas_Preset_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadTemplatePreset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const canvas = fabricCanvasRef.current;
    const fb = fabricModuleRef.current;
    if (!file || !canvas || !fb) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.pagesStorage) {
          alert('Invalid preset JSON format.');
          return;
        }

        if (json.canvasWidth) setCanvasWidth(json.canvasWidth);
        if (json.canvasHeight) setCanvasHeight(json.canvasHeight);
        if (json.gridSnap !== undefined) {
          setGridSnap(json.gridSnap);
          gridSnapRef.current = json.gridSnap;
        }
        if (json.csvHeaders && json.csvHeaders.length > 0) {
          setCsvHeaders(json.csvHeaders);
          setSelectedBarcodeCol(json.csvHeaders[0]);
        }

        pagesStorageRef.current = json.pagesStorage;
        const targetPageObjs = json.pagesStorage[currentPageIndexRef.current] || [];

        const toRemove = canvas.getObjects().filter((obj: any) => !obj.isBackground);
        toRemove.forEach((obj: any) => canvas.remove(obj));

        if (targetPageObjs.length > 0) {
          fb.util.enlivenObjects(targetPageObjs, (enlivened: any[]) => {
            enlivened.forEach((obj: any) => canvas.add(obj));
            canvas.renderAll();
            saveState(canvas);
          });
        } else {
          canvas.renderAll();
          saveState(canvas);
        }

        alert('Template layout loaded successfully!');
      } catch (err) {
        console.error(err);
        alert('Error parsing JSON template preset.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const renderPdfBackgroundAtWidth = async (pdfDoc: any, pageNum: number, targetWidth: number) => {
    const canvas = fabricCanvasRef.current;
    const fb = fabricModuleRef.current;
    if (!canvas || !fb || !pdfDoc) return;

    const page = await pdfDoc.getPage(pageNum);
    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = targetWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const finalWidth = Math.round(targetWidth);
    const finalHeight = Math.round(viewport.height);

    const offscreenCanvas = document.createElement('canvas');
    const offscreenContext = offscreenCanvas.getContext('2d');
    offscreenCanvas.width = finalWidth;
    offscreenCanvas.height = finalHeight;

    await page.render({
      canvasContext: offscreenContext,
      viewport: viewport,
    }).promise;

    const bgDataUrl = offscreenCanvas.toDataURL('image/png');

    canvas.setWidth(finalWidth);
    canvas.setHeight(finalHeight);
    setCanvasWidth(finalWidth);
    setCanvasHeight(finalHeight);

    return new Promise<void>((resolve) => {
      fb.Image.fromURL(bgDataUrl, (img: any) => {
        img.set({
          originX: 'left',
          originY: 'top',
          scaleX: finalWidth / img.width,
          scaleY: finalHeight / img.height,
        });
        canvas.setBackgroundImage(img, () => {
          canvas.renderAll();
          resolve();
        });
      });
    });
  };

  const switchPage = async (newPageIndex: number) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !pdfDocProxyRef.current) return;

    const currentObjs = canvas.getObjects().filter((obj: any) => !obj.isBackground);
    pagesStorageRef.current[currentPageIndexRef.current] = currentObjs.map(serializeFabricObject);

    canvas.clear();

    setCurrentPageIndex(newPageIndex);
    currentPageIndexRef.current = newPageIndex;

    await renderPdfBackgroundAtWidth(pdfDocProxyRef.current, newPageIndex + 1, canvasWidth);

    const targetObjs = pagesStorageRef.current[newPageIndex] || [];
    if (targetObjs.length > 0) {
      fabricModuleRef.current.util.enlivenObjects(targetObjs, (enlivened: any[]) => {
        enlivened.forEach((obj: any) => canvas.add(obj));
        canvas.renderAll();
        saveState(canvas);
      });
    } else {
      saveState(canvas);
    }

    setSelectedTag(null);
    setSelectedImage(null);
    setSelectedImageMask('none');
    setHasSelection(false);
    setGuideBounds(null);
  };

  const handlePreviewResize = async (newWidth: number) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const oldWidth = canvas.width || canvasWidth;
    const scaleRatio = newWidth / oldWidth;

    canvas.getObjects().forEach((obj: any) => {
      if (obj.isGuideLine) {
        if (obj.guideOrientation === 'horizontal') {
          obj.set({ y1: obj.y1 * scaleRatio, y2: obj.y2 * scaleRatio, x2: newWidth });
        } else {
          obj.set({ x1: obj.x1 * scaleRatio, x2: obj.x2 * scaleRatio, y2: Math.round(newWidth * 1.333) });
        }
      } else if (obj.type === 'textbox') {
        obj.set({
          left: obj.left * scaleRatio,
          top: obj.top * scaleRatio,
          width: obj.width * scaleRatio,
          fontSize: Math.round(obj.fontSize * scaleRatio),
        });
      } else if (obj.isBarcode || obj.isStaticImage) {
        obj.set({
          left: obj.left * scaleRatio,
          top: obj.top * scaleRatio,
          scaleX: (obj.scaleX || 1) * scaleRatio,
          scaleY: (obj.scaleY || 1) * scaleRatio,
        });
      }
      obj.setCoords();
    });

    setCanvasWidth(Math.round(newWidth));

    if (pdfDocProxyRef.current) {
      await renderPdfBackgroundAtWidth(pdfDocProxyRef.current, currentPageIndexRef.current + 1, newWidth);
    } else {
      const currentHeight = canvas.height || canvasHeight;
      const newHeight = Math.round(currentHeight * scaleRatio);
      canvas.setWidth(Math.round(newWidth));
      canvas.setHeight(newHeight);
      setCanvasHeight(newHeight);

      const bgImg = canvas.backgroundImage as any;
      if (bgImg) {
        bgImg.set({
          scaleX: (bgImg.scaleX || 1) * scaleRatio,
          scaleY: (bgImg.scaleY || 1) * scaleRatio,
        });
      }
      canvas.renderAll();
    }

    const activeObj = canvas.getActiveObject();
    if (activeObj) {
      const b = activeObj.getBoundingRect();
      setGuideBounds({ left: b.left, top: b.top, width: b.width, height: b.height });
    }
  };

  // BUILT-IN STARTER PACK GENERATOR & LOADER
  const loadStarterTemplate = async (templateKey: "badge" | "certificate" | "ticket") => {
    setShowTemplateDropdown(false);
    const canvas = fabricCanvasRef.current;
    const fb = fabricModuleRef.current;
    const pdfjsLib = (window as any).pdfjsLib;

    if (!canvas || !fb || !pdfjsLib) {
      alert("System initializing. Please try again in 1 second.");
      return;
    }

    const templateConfig: Record<string, { pdfFile: string; textY: number; barcodeY: number; qrY: number }> = {
      badge: {
        pdfFile: "/samples/Badge_Template.pdf",
        textY: 260,
        barcodeY: 420,
        qrY: 380,
      },
      certificate: {
        pdfFile: "/samples/Certificate_Template.pdf",
        textY: 320,
        barcodeY: 480,
        qrY: 460,
      },
      ticket: {
        pdfFile: "/samples/Ticket_Template.pdf",
        textY: 80,
        barcodeY: 160,
        qrY: 60,
      },
    };

    const cfg = templateConfig[templateKey];

    try {
      // 1. Fetch real PDF template
      const pdfRes = await fetch(cfg.pdfFile);
      if (!pdfRes.ok) {
        throw new Error("Could not find " + cfg.pdfFile + " in public/samples/");
      }
      const arrayBuffer = await pdfRes.arrayBuffer();
      setPdfBytes(arrayBuffer.slice(0));

      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
      const loadedPdf = await loadingTask.promise;
      pdfDocProxyRef.current = loadedPdf;

      setTotalPages(loadedPdf.numPages);
      setCurrentPageIndex(0);
      currentPageIndexRef.current = 0;
      pagesStorageRef.current = {};

      await renderPdfBackgroundAtWidth(loadedPdf, 1, canvasWidth);

      // 2. Fetch standard CSV data
      const csvRes = await fetch("/samples/sample_data.csv");
      const sampleCsv = await csvRes.text();

      Papa.parse(sampleCsv, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          setCsvData(results.data);
          csvDataRef.current = results.data;
          setPreviewRowIndex(0);
          previewRowIndexRef.current = 0;
          setTableCurrentPage(1);
          setTableSearchQuery("");

          const fields = results.meta.fields || ["FullName", "Barcode", "QR Code"];
          setCsvHeaders(fields);
          setSelectedBarcodeCol("Barcode");

          // 3. Clear canvas of previous non-background objects
          const toRemove = canvas.getObjects().filter((obj: any) => !obj.isBackground);
          toRemove.forEach((obj: any) => canvas.remove(obj));

          canvas.renderAll();
          saveState(canvas);

          setIsPreviewMode(false);
          isPreviewModeRef.current = false;
        },
      });
    } catch (err) {
      console.error(err);
      alert("Failed loading starter template. Please verify that public" + cfg.pdfFile + " exists.");
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (!(window as any).pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      };
      document.body.appendChild(script);
    }

    import('fabric').then((module) => {
      if (!isMounted) return;

      const fb = module.fabric || module.default || module;
      fabricModuleRef.current = fb;

      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
      }

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        const canvasEl = document.createElement('canvas');
        containerRef.current.appendChild(canvasEl);

        const c = new fb.Canvas(canvasEl, {
          width: 850,
          height: 1100,
          backgroundColor: '#ffffff',
          selection: true,
          preserveObjectStacking: true,
        });

        fabricCanvasRef.current = c;
        setIsReady(true);
        saveState(c);

        const updateSelectionBounds = () => {
          const active = c.getActiveObject();
          if (active) {
            const b = active.getBoundingRect();
            setGuideBounds({ left: b.left, top: b.top, width: b.width, height: b.height });
          } else {
            setGuideBounds(null);
          }
        };

        const handleObjectMoving = (options: any) => {
          const snap = gridSnapRef.current;
          if (options.target) {
            const target = options.target;
            if (target.isGuideLine) {
              if (target.guideOrientation === 'horizontal') {
                target.set({ left: 0 });
                if (snap > 0) target.set({ top: Math.round(target.top / snap) * snap });
              } else {
                target.set({ top: 0 });
                if (snap > 0) target.set({ left: Math.round(target.left / snap) * snap });
              }
            } else if (snap > 0) {
              target.set({
                left: Math.round(target.left / snap) * snap,
                top: Math.round(target.top / snap) * snap,
              });
            }
          }
          updateSelectionBounds();
        };

        const record = () => {
          saveState(c);
          updateSelectionBounds();
        };

        c.on('object:modified', record);
        c.on('object:moving', (e: any) => {
          handleObjectMoving(e);
          syncTransformValues(c.getActiveObject());
        });
        c.on('object:scaling', () => {
          updateSelectionBounds();
          syncTransformValues(c.getActiveObject());
        });
        c.on('object:rotating', () => {
          syncTransformValues(c.getActiveObject());
        });
        c.on('object:scaling', updateSelectionBounds);
        c.on('object:added', record);
        c.on('object:removed', record);

        c.on('selection:created', (e: any) => syncToolbarWithActiveObject(e.selected?.[0]));
        c.on('selection:updated', (e: any) => syncToolbarWithActiveObject(e.selected?.[0]));
        c.on('selection:cleared', () => syncToolbarWithActiveObject(null));
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      const canvas = fabricCanvasRef.current;
      const activeObj = canvas?.getActiveObject();

      if (activeObj && activeObj.isEditing) return;

      if (activeObj && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();

        const snap = gridSnapRef.current;
        let step = 1;

        if (e.shiftKey) {
          step = snap > 0 ? snap : 10;
        } else if (snap > 0) {
          step = snap;
        }

        let newLeft = activeObj.left;
        let newTop = activeObj.top;

        if (e.key === 'ArrowUp') newTop -= step;
        if (e.key === 'ArrowDown') newTop += step;
        if (e.key === 'ArrowLeft') newLeft -= step;
        if (e.key === 'ArrowRight') newLeft += step;

        if (activeObj.isGuideLine) {
          if (activeObj.guideOrientation === 'horizontal') {
            activeObj.set({ top: newTop, left: 0 });
          } else {
            activeObj.set({ left: newLeft, top: 0 });
          }
        } else {
          activeObj.set({ left: newLeft, top: newTop });
        }

        activeObj.setCoords();
        canvas.renderAll();
        saveState(canvas);

        const b = activeObj.getBoundingRect();
        setGuideBounds({ left: b.left, top: b.top, width: b.width, height: b.height });
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (activeObj) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }

      if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
        (e.ctrlKey && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

    
  const processRasterImageFile = (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const canvas = fabricCanvasRef.current;
      const fb = fabricModuleRef.current;
      if (!canvas || !fb) return resolve();

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return resolve();

        const imgEl = new Image();
        imgEl.onload = () => {
          let w = imgEl.naturalWidth;
          let h = imgEl.naturalHeight;

          // Default fallback constraints if dimensions are 0
          if (!w || !h) {
            w = 850;
            h = 1100;
          }

          setCanvasWidth(w);
          setCanvasHeight(h);
          canvas.setWidth(w);
          canvas.setHeight(h);

          fb.Image.fromURL(dataUrl, (fabricImg: any) => {
            if (!fabricImg) return resolve();
            fabricImg.set({
              originX: 'left',
              originY: 'top',
              selectable: false,
              evented: false,
              excludeFromExport: false,
              scaleX: w / (fabricImg.width || w),
              scaleY: h / (fabricImg.height || h),
            });

            canvas.setBackgroundImage(fabricImg, () => {
              canvas.renderAll();
              if (typeof saveState === 'function') {
                saveState(canvas);
              }
              file.arrayBuffer().then((buf) => {
                setPdfBytes(buf);
              });
              setTotalPages(1);
              setCurrentPageIndex(0);
              resolve();
            });
          });
        };
        imgEl.onerror = reject;
        imgEl.src = dataUrl;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleTemplateUploadFile = async (file: File) => {
    if (file.type === 'application/pdf') {
      await processPdfFile(file);
    } else if (file.type.startsWith('image/')) {
      await processRasterImageFile(file);
    } else {
      alert('Please upload a valid .pdf, .png, .jpg, or .webp file.');
    }
  };

  const processPdfFile = async (file: File) => {
    const canvas = fabricCanvasRef.current;
    const fb = fabricModuleRef.current;
    const pdfjsLib = (window as any).pdfjsLib;

    if (!file || !canvas || !fb) return;
    if (!pdfjsLib) {
      alert("PDF engine is initializing. Please try again in 2 seconds.");
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      setPdfBytes(arrayBuffer.slice(0));

      const workerBuffer = arrayBuffer.slice(0);
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(workerBuffer) });
      const pdf = await loadingTask.promise;
      pdfDocProxyRef.current = pdf;

      setTotalPages(pdf.numPages);
      setCurrentPageIndex(0);
      currentPageIndexRef.current = 0;
      pagesStorageRef.current = {};

      await renderPdfBackgroundAtWidth(pdf, 1, canvasWidth);
      setIsReady(true);
    } catch (err) {
      console.error("Error loading PDF:", err);
      alert("Failed to read PDF file.");
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processPdfFile(file);
    e.target.value = "";
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setCsvData(results.data);
          csvDataRef.current = results.data;
          setPreviewRowIndex(0);
          previewRowIndexRef.current = 0;
          setTableCurrentPage(1);
          setTableSearchQuery('');
          if (results.meta.fields && results.meta.fields.length > 0) {
            setCsvHeaders(results.meta.fields);
            setSelectedBarcodeCol(results.meta.fields[0]);
          }
        }
      });
    }
  };

    const addFreeformText = (initialString: string = "Double-click to type...") => {
    const canvas = fabricCanvasRef.current;
    const fb = fabricModuleRef.current;
    if (!canvas || !fb) return;

    const snap = gridSnapRef.current || 1;
    const cvs = fabricCanvasRef.current;
      const vpt = cvs.viewportTransform || [1, 0, 0, 1, 0, 0];
      const zoom = cvs.getZoom() || 1;
      
      const visibleCenterX = (-vpt[4] + (cvs.getWidth() / 2)) / zoom;
      const visibleCenterY = (-vpt[5] + (cvs.getHeight() / 2)) / zoom;
      
      const offset = (Math.random() * 40) - 20; 
      
      const rawLeft = visibleCenterX + offset;
      const rawTop = visibleCenterY + offset;

    const textObj = new fb.Textbox(initialString, {
      left: (() => {
        const cvs = fabricCanvasRef.current;
        const rect = cvs?.lowerCanvasEl?.getBoundingClientRect();
        const center = rect ? (window.innerWidth / 2) - rect.left : rawLeft;
        return Math.round((center + (Math.random() * 40 - 20)) / snap) * snap;
      })(),
      top: (() => {
        const cvs = fabricCanvasRef.current;
        const rect = cvs?.lowerCanvasEl?.getBoundingClientRect();
        // Adjust for standard browser scroll using bounding box
        const center = rect ? (window.innerHeight / 2) - rect.top : rawTop;
        return Math.round((center + (Math.random() * 40 - 20)) / snap) * snap;
      })(),
      width: 260,
      fontSize: fontSize || 22,
      fill: textColor || "#0f172a",
      fontWeight: isBold ? "bold" : "normal",
      fontStyle: isItalic ? "italic" : "normal",
      fontFamily: fontFamily || "Arial",
      textAlign: textAlign || "left",
      tagColor: textColor || "#0f172a",
      backgroundColor: "transparent",
      padding: 0,
      cornerColor: "#38bdf8",
      cornerSize: 10,
      transparentCorners: false,
      hasControls: true,
      selectable: true,
      lockUniScaling: false,
      rawTemplateTag: initialString,
      isUppercase: isUppercase || false,
      pageIndex: currentPageIndexRef.current,
      rules: [],
    });

    textObj.on("changed", () => {
      textObj.rawTemplateTag = textObj.text;
      saveState(canvas);
    });

    canvas.add(textObj);
    canvas.setActiveObject(textObj);
    canvas.renderAll();
    saveState(canvas);
    syncToolbarWithActiveObject(textObj);
  };

  const addTagToCanvas = (headerName: string) => {
    const canvas = fabricCanvasRef.current;
    const fb = fabricModuleRef.current;

    if (canvas && fb) {
      const snap = gridSnapRef.current || 1;
      const rawLeft = 80 + Math.random() * 50;
      const rawTop = 80 + Math.random() * 50;

      const templateTag = `{{${headerName}}}`;
      let initialText = templateTag;

      if (isPreviewModeRef.current) {
        const row = csvDataRef.current[previewRowIndexRef.current];
        if (row && row[headerName] !== undefined) {
          initialText = String(row[headerName]);
        }
      }

      const text = new fb.Textbox(initialText, {
        left: (() => {
        const cvs = fabricCanvasRef.current;
        const rect = cvs?.lowerCanvasEl?.getBoundingClientRect();
        const center = rect ? (window.innerWidth / 2) - rect.left : rawLeft;
        return Math.round((center + (Math.random() * 40 - 20)) / snap) * snap;
      })(),
      top: (() => {
        const cvs = fabricCanvasRef.current;
        const rect = cvs?.lowerCanvasEl?.getBoundingClientRect();
        // Adjust for standard browser scroll using bounding box
        const center = rect ? (window.innerHeight / 2) - rect.top : rawTop;
        return Math.round((center + (Math.random() * 40 - 20)) / snap) * snap;
      })(),
        width: 220,
        fontSize: 24,
        fill: '#0f172a',
        fontWeight: 'normal',
        fontStyle: 'normal',
        fontFamily: fontFamily,
        textAlign: 'left',
        tagColor: '#0f172a',
        backgroundColor: 'transparent',
        padding: 0,
        cornerColor: '#0284c7',
        cornerSize: 10,
        transparentCorners: false,
        hasControls: true,
        selectable: true,
        lockUniScaling: false,
        rawTemplateTag: templateTag,
        isUppercase: false,
        pageIndex: currentPageIndexRef.current,
        rules: [],
      });

      canvas.add(text);
      canvas.setActiveObject(text);
      canvas.renderAll();
      const b = text.getBoundingRect();
      setGuideBounds({ left: b.left, top: b.top, width: b.width, height: b.height });
      syncToolbarWithActiveObject(text);
    }
  };

  const filteredIndexedRows = useMemo(() => {
    if (!tableSearchQuery.trim()) {
      return csvData.map((row, originalIndex) => ({ row, originalIndex }));
    }
    const q = tableSearchQuery.toLowerCase().trim();
    return csvData
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => {
        return Object.values(row).some((val) =>
          String(val || '').toLowerCase().includes(q)
        );
      });
  }, [csvData, tableSearchQuery]);

  const totalTablePages = Math.max(1, Math.ceil(filteredIndexedRows.length / ROWS_PER_TABLE_PAGE));
  const tableStartIndex = (tableCurrentPage - 1) * ROWS_PER_TABLE_PAGE;
  const currentTableRows = filteredIndexedRows.slice(tableStartIndex, tableStartIndex + ROWS_PER_TABLE_PAGE);

  const handleSearchChange = (query: string) => {
    setTableSearchQuery(query);
    setTableCurrentPage(1);
  };

  const handleOpenExportModal = () => {
    if (!pdfBytes || csvData.length === 0) {
      alert('Please upload both a PDF template and a CSV dataset first.');
      return;
    }
    setShowScopeModal(true);
  };

  const handleExecuteExport = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !pdfBytes || csvData.length === 0) return;

    let targetRows: Record<string, string>[] = [];
    if (recordScopeMode === 'all') {
      targetRows = csvData;
    } else if (recordScopeMode === 'filtered') {
      targetRows = filteredIndexedRows.map((item) => item.row);
    } else {
      const selectedIndices = parseRangeString(customRecordRange, csvData.length);
      if (selectedIndices.length === 0) {
        alert('Invalid custom record range specified.');
        return;
      }
      targetRows = selectedIndices.map((idx) => csvData[idx]);
    }

    let targetPageIndices: number[] = [];
    if (pageScopeMode === 'all') {
      targetPageIndices = Array.from({ length: totalPages }, (_, i) => i);
    } else {
      targetPageIndices = parseRangeString(customPageRange, totalPages);
      if (targetPageIndices.length === 0) {
        alert('Invalid custom page range specified.');
        return;
      }
    }

    setShowScopeModal(false);
    setIsGenerating(true);
    setProgressPercent(0);
    setProgressStage('Preparing selected ranges & compiling...');
    setProgressCount({ current: 0, total: targetRows.length });

    try {
      const currentObjs = canvas.getObjects().filter((obj: any) => !obj.isBackground);
      pagesStorageRef.current[currentPageIndexRef.current] = currentObjs.map(serializeFabricObject);

      const allTextData: CanvasTextData[] = [];
      const allBarcodeData: CanvasBarcodeData[] = [];
      const allStaticImages: CanvasStaticImageData[] = [];

      for (let pIdx = 0; pIdx < totalPages; pIdx++) {
        const pageObjects = pagesStorageRef.current[pIdx] || [];
        for (const obj of pageObjects) {
          if (obj.isGuideLine) continue;

          if (obj.type === 'textbox') {
            allTextData.push({
              text: obj.rawTemplateTag || obj.text,
              x: obj.left,
              y: obj.top,
              width: (obj.width || 0) * (obj.scaleX || 1),
              fontSize: obj.fontSize * (obj.scaleY || 1),
              color: obj.tagColor || obj.fill || '#000000',
              fontWeight: obj.fontWeight || 'normal',
              fontStyle: obj.fontStyle || 'normal',
              fontFamily: obj.fontFamily || 'Arial',
              textAlign: obj.textAlign || 'left',
              isUppercase: Boolean(obj.isUppercase),
              padding: obj.padding || 0,
              lineHeight: obj.lineHeight || 1.16,
              pageIndex: pIdx,
              rules: obj.rules || [],
            });
          } else if (obj.isBarcode) {
            allBarcodeData.push({
              field: obj.barcodeField,
              barcodeType: obj.barcodeType,
              x: obj.left,
              y: obj.top,
              width: (obj.width || 100) * (obj.scaleX || 1),
              height: (obj.height || 50) * (obj.scaleY || 1),
              pageIndex: pIdx,
            });
          } else if (obj.isStaticImage && (obj.imageDataUrl || obj.src)) {
            const rawSource = obj.imageDataUrl || obj.src;
            allStaticImages.push({
              dataUrl: rawSource,
              pageIndex: pIdx,
              x: obj.left,
              y: obj.top,
              width: (obj.width || 100) * (obj.scaleX || 1),
              height: (obj.height || 100) * (obj.scaleY || 1),
            });
          }
        }
      }

      if (currentPageIndexRef.current !== undefined) {
        currentObjs.forEach((cObj: any) => {
          if (cObj.isStaticImage) {
            const src = cObj.imageDataUrl || (cObj.getElement && cObj.getElement()?.src) || cObj.toDataURL?.();
            const existing = allStaticImages.find((img) => img.pageIndex === currentPageIndexRef.current && img.x === cObj.left && img.y === cObj.top);
            if (existing && src) {
              existing.dataUrl = src;
            }
          }
        });
      }

      const finalPdfBytes = await generateVDP(
        pdfBytes.slice(0),
        targetRows,
        allTextData,
        canvas.width!,
        customFontsRef.current,
        allBarcodeData,
        (current, total, stage) => {
          const pct = Math.round((current / total) * 100);
          setProgressPercent(pct);
          setProgressCount({ current, total });
          setProgressStage(stage);
        },
        targetPageIndices,
        allStaticImages
      );

      pendingBlobRef.current = new Blob([finalPdfBytes as any], { type: 'application/pdf' });
      setShowSaveModal(true);
    } catch (error) {
      console.error(error);
      alert('Error generating PDF.');
    }
    setIsGenerating(false);
  };

  const handleOpenPdfTab = () => {
    const blob = pendingBlobRef.current;
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleDirectDownload = () => {
    const blob = pendingBlobRef.current;
    if (!blob) return;

    const chosenName = exportFilename.trim().replace(/\.pdf$/i, '');
    const finalFilename = `${chosenName || 'CSVCanvas_Export'}.pdf`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setShowSaveModal(false);
    pendingBlobRef.current = null;
  };

  const horizontalMarks = [];
  for (let x = 0; x <= canvasWidth; x += 100) {
    horizontalMarks.push(x);
  }

  const verticalMarks = [];
  for (let y = 0; y <= canvasHeight; y += 100) {
    verticalMarks.push(y);
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
      {/* 1. TOP GLOBAL APP HEADER */}
      <div className="shrink-0 z-30">
              {/* Sleek Top Navigation Bar with Starter Templates Dropdown */}
      <header className="w-full border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-6 py-3 flex items-center justify-between shadow-xs mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="13" y2="17" />
            </svg>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black tracking-tight text-white font-sans">
              CSV<span className="text-cyan-400">Canvas</span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-mono">
              VDP STUDIO
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* STARTER PACK TEMPLATES DROPDOWN */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <span>✨</span>
              <span>Sample Templates</span>
              <span className="text-[10px]">▼</span>
            </button>

            {showTemplateDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 border-b border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Load Built-in Demo
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => loadStarterTemplate('badge')}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 text-slate-200 transition flex flex-col cursor-pointer"
                >
                  <span className="font-bold text-cyan-300">🎟 Conference Badge</span>
                  <span className="text-[11px] text-slate-400">Name tag, roles, and dynamic QR code</span>
                </button>

                <button
                  type="button"
                  onClick={() => loadStarterTemplate('certificate')}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 text-slate-200 transition flex flex-col cursor-pointer"
                >
                  <span className="font-bold text-amber-300">🏆 Certificate of Achievement</span>
                  <span className="text-[11px] text-slate-400">Award layout with centered typography</span>
                </button>

                <button
                  type="button"
                  onClick={() => loadStarterTemplate('ticket')}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 text-slate-200 transition flex flex-col cursor-pointer"
                >
                  <span className="font-bold text-emerald-300">🎫 Event Ticket</span>
                  <span className="text-[11px] text-slate-400">Admissions ticket with 1D Code 128 barcode</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleOpenExportModal}
            disabled={isGenerating || !isReady}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-lg shadow-md shadow-cyan-500/20 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Export</span>
              </>
            )}
          </button>
        </div>
      </header>

      </div>

      {/* 2. THREE-PANE MAIN WORKBENCH */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        
        {/* LEFT PANEL: Ingestion, CSV Chips & Elements (w-80) */}
        <aside className="w-80 shrink-0 border-r border-slate-800/80 bg-slate-900/40 flex flex-col justify-between overflow-y-auto p-3.5 gap-4">
          <div className="flex flex-col gap-3.5">
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 px-1">
              Data & Assets
            </div>

            {/* CARD 1: DOCUMENT & DATA SOURCES */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">File Sources</span>
              
              <div className="flex flex-col gap-2">
                <label className="w-full py-2 px-3 bg-slate-950 hover:bg-slate-850 text-slate-200 border border-slate-800 hover:border-cyan-500/50 font-semibold text-xs rounded-lg transition cursor-pointer flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400">📄</span>
                    <span>Template (PDF/Img)</span>
                  </div>
                  {pdfBytes ? (
                    <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-1.5 py-0.5 rounded font-bold">Loaded</span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-medium">Browse...</span>
                  )}
                  <input type="file" hidden accept="application/pdf,image/png,image/jpeg,image/webp" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      await handleTemplateUploadFile(file);
                    }
                  }} />
                </label>

                <label className="w-full py-2 px-3 bg-slate-950 hover:bg-slate-850 text-slate-200 border border-slate-800 hover:border-emerald-500/50 font-semibold text-xs rounded-lg transition cursor-pointer flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">📊</span>
                    <span>Data CSV</span>
                  </div>
                  {csvData.length > 0 ? (
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded font-bold">{csvData.length} rows</span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-medium">Browse...</span>
                  )}
                  <input type="file" hidden accept=".csv" onChange={handleCsvUpload} />
                </label>
              </div>
            </div>

            {/* CARD 2: INSERT STATIC ELEMENTS */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Insert Elements</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => addFreeformText("Double-click to edit text...")}
                  className="py-2 px-2.5 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-cyan-500/50 font-semibold text-xs rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                  title="Add editable text field"
                >
                  <span className="text-cyan-400 font-bold text-xs">T</span>
                  <span>+ Text Box</span>
                </button>

                <label
                  className="py-2 px-2.5 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-sky-500/50 font-semibold text-xs rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                  title="Upload static image"
                >
                  <span>🖼</span>
                  <span>+ Image</span>
                  <input type="file" hidden accept="image/*" onChange={handleStaticImageUpload} />
                </label>
              </div>
            </div>

            {/* CARD 3: DYNAMIC CSV FIELDS & BARCODES */}
            {csvHeaders.length > 0 ? (
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dynamic Fields</span>
                  <span className="text-[10px] text-cyan-400 font-semibold">Page {currentPageIndex + 1}</span>
                </div>

                {/* Column Chips */}
                <div className="flex flex-wrap gap-1.5 pr-1">
                  {csvHeaders.map((header) => (
                    <button
                      key={header}
                      type="button"
                      onClick={() => addTagToCanvas(header)}
                      className="px-2 py-1 text-[11px] bg-slate-950 hover:bg-slate-800 text-cyan-300 font-semibold border border-slate-800 hover:border-cyan-500/50 rounded-md transition cursor-pointer flex items-center gap-1"
                      title={`Insert ${header} onto canvas`}
                    >
                      <span className="text-cyan-400 font-bold">+</span>
                      <span>{"{{" + header + "}}"}</span>
                    </button>
                  ))}
                </div>

                {/* Barcode / QR Placement */}
                <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Generate Code:</span>
                    <select
                      value={selectedBarcodeCol}
                      onChange={(e) => setSelectedBarcodeCol(e.target.value)}
                      className="px-2 py-0.5 text-xs border border-slate-800 rounded bg-slate-950 text-slate-200 font-medium max-w-[130px] focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      {csvHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => addBarcodeToCanvas(selectedBarcodeCol || csvHeaders[0], 'qrcode')}
                      className="py-1 px-1.5 text-[11px] font-bold bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80 rounded-md transition cursor-pointer text-center"
                      title="Insert QR Code"
                    >
                      + QR
                    </button>
                    <button
                      type="button"
                      onClick={() => addBarcodeToCanvas(selectedBarcodeCol || csvHeaders[0], 'code128')}
                      className="py-1 px-1.5 text-[11px] font-bold bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80 rounded-md transition cursor-pointer text-center"
                      title="Insert Code 128"
                    >
                      + Code 128
                    </button>
                    <button
                      type="button"
                      onClick={() => addBarcodeToCanvas(selectedBarcodeCol || csvHeaders[0], 'code39')}
                      className="py-1 px-1.5 text-[11px] font-bold bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80 rounded-md transition cursor-pointer text-center"
                      title="Insert Code 39"
                    >
                      + Code 39
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-900/40 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-center py-4">
                <span className="text-[11px] font-semibold text-slate-400">No CSV Data Loaded</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Upload a CSV to place dynamic tags & barcodes.</span>
              </div>
            )}

            {/* CARD 4: DATASET PREVIEW TRIGGER */}
            {csvData.length > 0 && (
              <div 
                onClick={() => setIsTableExpanded(!isTableExpanded)}
                className="p-2.5 bg-slate-900/80 hover:bg-slate-850 border border-slate-800 rounded-xl flex items-center justify-between cursor-pointer select-none transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs">📊</span>
                  <span className="text-xs font-bold text-slate-300">View Data Table</span>
                  <span className="px-1.5 py-0.2 text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60 rounded">
                    {csvData.length}
                  </span>
                </div>
                <span className={`text-xs text-slate-400 transform transition-transform ${isTableExpanded ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </div>
            )}
          </div>

          {/* BOTTOM PRESETS */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={handleSaveTemplatePreset}
                className="py-1 px-2 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-medium rounded-lg transition cursor-pointer flex items-center justify-center gap-1 hover:text-white"
                title="Save template layout"
              >
                <span>💾</span> Save Preset
              </button>
              <label
                className="py-1 px-2 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-medium rounded-lg transition cursor-pointer flex items-center justify-center gap-1 hover:text-white"
                title="Load template layout"
              >
                <span>📂</span> Load Preset
                <input type="file" hidden accept=".json" onChange={handleLoadTemplatePreset} />
              </label>
            </div>
          </div>
        </aside>

        {/* CENTER STAGE: Canvas Viewport */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-hidden relative">
          {/* Top Control Bar: Zoom, Snap, Guides */}
          <div className="shrink-0 h-11 border-b border-slate-800 bg-slate-900/60 px-3 flex items-center justify-between gap-3 select-none z-10">
            {/* Left: Viewport Controls (Zoom, Guides, Grid) */}
            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 select-none">
                  Zoom
                </span>
                {ZOOM_LEVELS.map((lvl) => {
                  const targetWidth = Math.round(BASE_CANVAS_WIDTH * lvl.scale);
                  const isSelected = Math.abs(canvasWidth - targetWidth) < 15;
                  return (
                    <button
                      key={lvl.label}
                      type="button"
                      onClick={() => handlePreviewResize(targetWidth)}
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded transition cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-850'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  );
                })}
              </div>

              <div className="h-4 w-px bg-slate-800 mx-0.5" />

              {/* Guides Controls */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 select-none">
                  Guides
                </span>
                <button
                  type="button"
                  onClick={() => addGuideLine('horizontal')}
                  className="px-2 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-slate-850 hover:text-cyan-200 rounded transition cursor-pointer"
                  title="Add horizontal guideline"
                >
                  +H
                </button>
                <button
                  type="button"
                  onClick={() => addGuideLine('vertical')}
                  className="px-2 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-slate-850 hover:text-cyan-200 rounded transition cursor-pointer"
                  title="Add vertical guideline"
                >
                  +V
                </button>
                <div className="h-3 w-px bg-slate-800 mx-0.5" />
                <button
                  type="button"
                  onClick={clearAllGuides}
                  className="px-2 py-1 text-[10px] font-medium text-slate-400 hover:text-rose-400 hover:bg-slate-850 rounded transition cursor-pointer"
                  title="Clear all guidelines"
                >
                  Clear
                </button>
              </div>

              <div className="h-4 w-px bg-slate-800 mx-0.5" />

              {/* Grid Snap Controls */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 select-none">
                  Grid
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setGridSnap(0);
                    gridSnapRef.current = 0;
                  }}
                  className={`px-2 py-1 text-[11px] font-semibold rounded transition cursor-pointer ${
                    gridSnap === 0
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-850'
                  }`}
                >
                  Off
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGridSnap(10);
                    gridSnapRef.current = 10;
                  }}
                  className={`px-2 py-1 text-[11px] font-semibold rounded transition cursor-pointer ${
                    gridSnap === 10
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-850'
                  }`}
                >
                  10px
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGridSnap(20);
                    gridSnapRef.current = 20;
                  }}
                  className={`px-2 py-1 text-[11px] font-semibold rounded transition cursor-pointer ${
                    gridSnap === 20
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-850'
                  }`}
                >
                  20px
                </button>
                <div className="h-4 w-px bg-slate-800 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setShowGridOverlay(!showGridOverlay)}
                  disabled={gridSnap === 0}
                  className={`px-2 py-1 text-[11px] font-semibold rounded transition flex items-center gap-1 ${
                    gridSnap === 0 ? 'opacity-40 cursor-not-allowed text-slate-600' : 
                    showGridOverlay ? 'text-slate-200 bg-slate-850' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${showGridOverlay && gridSnap > 0 ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                  Dots
                </button>
              </div>
            </div>

            {/* Live Data Preview Controls */}
            {csvData.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
                <button
                  type="button"
                  onClick={togglePreviewMode}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded transition flex items-center gap-1.5 ${
                    isPreviewMode
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                  title="Toggle live variable-data evaluation on canvas"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isPreviewMode ? 'bg-slate-950 animate-pulse' : 'bg-slate-500'}`} />
                  Preview
                </button>

                {isPreviewMode && (
                  <div className="flex items-center border-l border-slate-800 pl-1.5 pr-0.5 gap-1">
                    <button
                      type="button"
                      disabled={previewRowIndex <= 0}
                      onClick={() => {
                        const nextIdx = Math.max(0, previewRowIndex - 1);
                        setPreviewRowIndex(nextIdx);
                        previewRowIndexRef.current = nextIdx;
                        applyDataPreview(true, nextIdx);
                      }}
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                        previewRowIndex <= 0 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                      }`}
                      title="Previous record"
                    >
                      ◀
                    </button>
                    <span className="text-[10px] font-mono text-slate-400 px-1 select-none">
                      {previewRowIndex + 1}/{csvData.length}
                    </span>
                    <button
                      type="button"
                      disabled={previewRowIndex >= csvData.length - 1}
                      onClick={() => {
                        const nextIdx = Math.min(csvData.length - 1, previewRowIndex + 1);
                        setPreviewRowIndex(nextIdx);
                        previewRowIndexRef.current = nextIdx;
                        applyDataPreview(true, nextIdx);
                      }}
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                        previewRowIndex >= csvData.length - 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                      }`}
                      title="Next record"
                    >
                      ▶
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Right: History, Delete, Reset */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded transition flex items-center gap-1.5 ${
                    canUndo
                      ? 'text-slate-200 hover:bg-slate-850 hover:text-white cursor-pointer'
                      : 'text-slate-600 opacity-40 cursor-not-allowed'
                  }`}
                  title="Undo (⌘Z)"
                >
                  <span>↩</span> Undo
                </button>
                <div className="h-3 w-px bg-slate-800" />
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded transition flex items-center gap-1.5 ${
                    canRedo
                      ? 'text-slate-200 hover:bg-slate-850 hover:text-white cursor-pointer'
                      : 'text-slate-600 opacity-40 cursor-not-allowed'
                  }`}
                  title="Redo (⇧⌘Z)"
                >
                  Redo <span>↪</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={!hasSelection}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition flex items-center gap-1 ${
                  hasSelection
                    ? 'bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border-rose-800/80 cursor-pointer shadow-xs'
                    : 'bg-slate-950 text-slate-600 border-slate-800/50 opacity-40 cursor-not-allowed'
                }`}
                title="Delete selected item or guide"
              >
                ✕ Delete
              </button>

              {pdfBytes && (
                <button
                  type="button"
                  onClick={handleResetProject}
                  className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-xs"
                  title="Reset PDF background and canvas elements"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Centered Scrollable Canvas Artboard with Viewport Perimeter Rulers */}
          <div className="relative flex-1 overflow-hidden bg-slate-950 flex flex-col">
            {/* Top-Left Corner Block */}
            <div
              className="absolute top-0 left-0 z-20 bg-slate-900 border-r border-b border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 font-mono select-none"
              style={{ width: `${RULER_SIZE}px`, height: `${RULER_SIZE}px` }}
            >
              px
            </div>

            {/* Horizontal Perimeter Ruler (Top) */}
            <div
              className="absolute top-0 right-0 z-10 bg-[#090d16] border-b border-slate-800 overflow-hidden pointer-events-none"
              style={{ left: `${RULER_SIZE}px`, height: `${RULER_SIZE}px` }}
            >
              <div
                style={{
                  transform: `translateX(${-viewportScroll.left + (viewportScrollContainerRef.current ? Math.max(0, (viewportScrollContainerRef.current.clientWidth - canvasWidth) / 2) : 0)}px)`,
                  width: `${canvasWidth}px`,
                  height: `${RULER_SIZE}px`,
                  position: 'relative',
                }}
              >
                <svg width={canvasWidth} height={RULER_SIZE} style={{ display: 'block' }}>
                  <defs>
                    <pattern id="ruler-grid-x-10" width="10" height={RULER_SIZE} patternUnits="userSpaceOnUse">
                      <line x1="0" y1={RULER_SIZE - 6} x2="0" y2={RULER_SIZE} stroke="#1e293b" strokeWidth="1" />
                    </pattern>
                    <pattern id="ruler-grid-x-50" width="50" height={RULER_SIZE} patternUnits="userSpaceOnUse">
                      <line x1="0" y1={RULER_SIZE - 12} x2="0" y2={RULER_SIZE} stroke="#334155" strokeWidth="1.2" />
                    </pattern>
                  </defs>
                  <rect width={canvasWidth} height={RULER_SIZE} fill="url(#ruler-grid-x-10)" />
                  <rect width={canvasWidth} height={RULER_SIZE} fill="url(#ruler-grid-x-50)" />
                  {horizontalMarks.map((x) => (
                    <g key={`x-${x}`}>
                      <line x1={x} y1="0" x2={x} y2={RULER_SIZE} stroke="#475569" strokeWidth="1.5" />
                      {x !== 0 && (
                        <text x={x + 3} y="12" fill="#94a3b8" fontSize="10" fontWeight="bold" fontFamily="monospace">
                          {x}
                        </text>
                      )}
                    </g>
                  ))}
                </svg>

                {guideBounds && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: `${guideBounds.left}px`,
                      width: `${guideBounds.width}px`,
                      height: `${RULER_SIZE}px`,
                      backgroundColor: 'rgba(56, 189, 248, 0.35)',
                      borderLeft: '2px solid #38bdf8',
                      borderRight: '2px solid #38bdf8',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>
            </div>

            {/* Vertical Perimeter Ruler (Left) */}
            <div
              className="absolute left-0 bottom-0 z-10 bg-[#090d16] border-r border-slate-800 overflow-hidden pointer-events-none"
              style={{ top: `${RULER_SIZE}px`, width: `${RULER_SIZE}px` }}
            >
              <div
                style={{
                  transform: `translateY(${-viewportScroll.top + (viewportScrollContainerRef.current ? Math.max(0, (viewportScrollContainerRef.current.clientHeight - canvasHeight) / 2) : 0)}px)`,
                  height: `${canvasHeight}px`,
                  width: `${RULER_SIZE}px`,
                  position: 'relative',
                }}
              >
                <svg width={RULER_SIZE} height={canvasHeight} style={{ display: 'block' }}>
                  <defs>
                    <pattern id="ruler-grid-y-10" width={RULER_SIZE} height="10" patternUnits="userSpaceOnUse">
                      <line x1={RULER_SIZE - 6} y1="0" x2={RULER_SIZE} y2="0" stroke="#1e293b" strokeWidth="1" />
                    </pattern>
                    <pattern id="ruler-grid-y-50" width={RULER_SIZE} height="50" patternUnits="userSpaceOnUse">
                      <line x1={RULER_SIZE - 12} y1="0" x2={RULER_SIZE} y2="0" stroke="#334155" strokeWidth="1.2" />
                    </pattern>
                  </defs>
                  <rect width={RULER_SIZE} height={canvasHeight} fill="url(#ruler-grid-y-10)" />
                  <rect width={RULER_SIZE} height={canvasHeight} fill="url(#ruler-grid-y-50)" />
                  {verticalMarks.map((y) => (
                    <g key={`y-${y}`}>
                      <line x1="0" y1={y} x2={RULER_SIZE} y2={y} stroke="#475569" strokeWidth="1.5" />
                      {y !== 0 && (
                        <text
                          x="13"
                          y={y - 3}
                          fill="#94a3b8"
                          fontSize="10"
                          fontWeight="bold"
                          fontFamily="monospace"
                          transform={`rotate(-90, 13, ${y - 3})`}
                        >
                          {y}
                        </text>
                      )}
                    </g>
                  ))}
                </svg>

                {guideBounds && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: `${guideBounds.top}px`,
                      width: `${RULER_SIZE}px`,
                      height: `${guideBounds.height}px`,
                      backgroundColor: 'rgba(56, 189, 248, 0.35)',
                      borderTop: '2px solid #38bdf8',
                      borderBottom: '2px solid #38bdf8',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>
            </div>

            {/* Scrollable Viewport Stage */}
            <div
              ref={viewportScrollContainerRef}
              className="flex-1 overflow-auto flex items-start justify-center p-12 relative bg-slate-950/80 min-h-0 min-w-0"
              style={{
                marginLeft: `${RULER_SIZE}px`,
                marginTop: `${RULER_SIZE}px`,
              }}
              onScroll={(e) => {
                const target = e.currentTarget;
                setViewportScroll({ left: target.scrollLeft, top: target.scrollTop });
                fabricCanvasRef.current?.calcOffset();
              }}
            >
              {/* Empty State: Centered PDF Drag & Drop Box */}
            {!pdfBytes ? (
              <div
                className="w-full max-w-md p-8 rounded-2xl border-2 border-dashed flex flex-col items-center text-center transition-all duration-200 backdrop-blur-md shadow-2xl select-none z-30 bg-slate-900/80 border-slate-700/80 hover:border-cyan-500/50 hover:bg-slate-900/95 text-slate-300"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingPdf(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDraggingPdf(false);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  setIsDraggingPdf(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    await handleTemplateUploadFile(file);
                  }
                }}
              >
                <div className="w-14 h-14 mb-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center text-2xl shadow-inner">
                  📄
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-1">
                  Drag & drop your Background PDF or Image
                </h3>
                <p className="text-xs text-slate-400 mb-6 max-w-xs leading-relaxed">
                  Upload your PDF, PNG, JPG, or WebP template to start adding dynamic fields.
                </p>

                <label className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-950/40 transition-all cursor-pointer flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]">
                  <span>Browse Template File</span>
                  <input
                    type="file"
                    hidden
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      await handleTemplateUploadFile(file);
                    }
                  }}
                  />
                </label>
              </div>
            ) : null}

            {/* Isolated White Document Canvas Card */}
            <div
              style={{
                display: pdfBytes ? 'block' : 'none',
                width: `${canvasWidth}px`,
                height: `${canvasHeight}px`,
                position: 'relative',
                margin: 'auto',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 20px 40px -15px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)',
              }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: `${canvasWidth}px`,
                    height: `${canvasHeight}px`,
                  }}
                  ref={containerRef}
                />
                {showGridOverlay && gridSnap > 0 && (
                  <div
                    className="pointer-events-none absolute inset-0 z-50 mix-blend-difference opacity-40"
                    style={{
                      backgroundImage: `radial-gradient(circle, #ffffff 1.5px, transparent 1.5px)`,
                      backgroundSize: `${gridSnap}px ${gridSnap}px`,
                      backgroundPosition: '0 0'
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* SLIDE-UP CSV DATA TABLE DRAWER */}
          {isTableExpanded && csvData.length > 0 && (
            <div className="absolute inset-x-0 bottom-0 z-20 max-h-[50vh] flex flex-col bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-2xl transition-all duration-200">
              {/* Drawer Header Toolbar */}
              <div className="shrink-0 px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">📊</span>
                    <span className="text-xs font-bold text-slate-100">CSV Dataset Preview</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60 rounded-full">
                      {filteredIndexedRows.length} {filteredIndexedRows.length === 1 ? 'record' : 'records'}
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-400 font-medium hidden md:inline">
                    (Click any row to bind canvas preview)
                  </span>
                </div>

                {/* Search & Pagination Controls */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search records..."
                      value={tableSearchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="w-48 pl-7 pr-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                    <span className="absolute left-2 top-1.5 text-xs text-slate-500">🔍</span>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setTableCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={tableCurrentPage <= 1}
                      className="px-2 py-0.5 text-xs font-bold text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-white"
                    >
                      ‹
                    </button>
                    <span className="text-[11px] font-semibold text-slate-400 px-1.5">
                      {tableCurrentPage} / {totalTablePages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTableCurrentPage((p) => Math.min(totalTablePages, p + 1))}
                      disabled={tableCurrentPage >= totalTablePages}
                      className="px-2 py-0.5 text-xs font-bold text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-white"
                    >
                      ›
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsTableExpanded(false)}
                    className="p-1 px-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-950 border border-slate-800 rounded-lg transition hover:bg-slate-800"
                    title="Close table"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Scrollable Spreadsheet Table */}
              <div className="flex-1 overflow-auto max-h-[calc(50vh-48px)]">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400 font-bold border-b border-slate-800 select-none">
                    <tr>
                      <th className="py-2 px-3 border-r border-slate-800/80 w-12 text-center text-[10px] uppercase tracking-wider">
                        #
                      </th>
                      {csvHeaders.map((header) => (
                        <th
                          key={header}
                          className="py-2 px-3 border-r border-slate-800/80 whitespace-nowrap text-[11px] font-bold text-slate-300"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 font-mono text-[11px]">
                    {currentTableRows.length > 0 ? (
                      currentTableRows.map(({ row, originalIndex }) => {
                        const isCurrent = isPreviewMode && previewRowIndex === originalIndex;
                        return (
                          <tr
                            key={originalIndex}
                            onClick={() => {
                              setPreviewRowIndex(originalIndex);
                              previewRowIndexRef.current = originalIndex;
                              setIsPreviewMode(true);
                              isPreviewModeRef.current = true;
                              applyDataPreview(true, originalIndex);
                            }}
                            className={`cursor-pointer transition-colors ${
                              isCurrent
                                ? 'bg-cyan-950/60 text-cyan-200 font-semibold'
                                : 'hover:bg-slate-800/50 text-slate-300'
                            }`}
                          >
                            <td className="py-1.5 px-3 border-r border-slate-800/80 text-center font-bold text-slate-400 select-none">
                              {originalIndex + 1}
                            </td>
                            {csvHeaders.map((header) => (
                              <td
                                key={header}
                                className="py-1.5 px-3 border-r border-slate-800/80 whitespace-nowrap max-w-xs truncate"
                              >
                                {row[header] || ''}
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={csvHeaders.length + 1}
                          className="py-8 text-center text-slate-500 font-sans"
                        >
                          No matching records found for "{tableSearchQuery}".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {/* RIGHT INSPECTOR: Contextual Properties (w-80) */}
        <aside className="w-80 shrink-0 border-l border-slate-800/80 bg-slate-900/40 flex flex-col justify-between overflow-y-auto p-3.5 gap-4">
          <div className="flex flex-col gap-3.5">
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 px-1">
              Properties
            </div>

            {/* CARD 0: EXACT TRANSFORM */}
            <div className={`p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-2.5 transition-all duration-150 ${hasSelection ? 'opacity-100 ring-1 ring-cyan-500/40' : 'opacity-35 pointer-events-none select-none'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Transform</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsRatioLocked(!isRatioLocked)}
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded border transition cursor-pointer flex items-center gap-1 ${
                      isRatioLocked
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-xs'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border-slate-800'
                    }`}
                    title="Lock aspect ratio when resizing"
                  >
                    <span>{isRatioLocked ? '🔒' : '🔓'}</span>
                    <span>Lock Ratio</span>
                  </button>
                  {!hasSelection && <span className="text-[9px] text-slate-500 font-medium">No selection</span>}
                </div>
              </div>

              {/* X and Y */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
                  <span className="text-[10px] font-bold text-slate-400 w-4 select-none">X</span>
                  <input
                    type="number"
                    value={transformX}
                    onChange={(e) => handleTransformChange('x', Number(e.target.value))}
                    className="w-full bg-transparent text-right text-xs text-slate-100 font-semibold focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 ml-1 select-none">px</span>
                </div>

                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
                  <span className="text-[10px] font-bold text-slate-400 w-4 select-none">Y</span>
                  <input
                    type="number"
                    value={transformY}
                    onChange={(e) => handleTransformChange('y', Number(e.target.value))}
                    className="w-full bg-transparent text-right text-xs text-slate-100 font-semibold focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 ml-1 select-none">px</span>
                </div>
              </div>

              {/* Width and Height */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
                  <span className="text-[10px] font-bold text-slate-400 w-4 select-none">W</span>
                  <input
                    type="number"
                    min={5}
                    value={transformW}
                    onChange={(e) => handleTransformChange('w', Number(e.target.value))}
                    className="w-full bg-transparent text-right text-xs text-slate-100 font-semibold focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 ml-1 select-none">px</span>
                </div>

                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
                  <span className="text-[10px] font-bold text-slate-400 w-4 select-none">H</span>
                  <input
                    type="number"
                    min={5}
                    value={transformH}
                    onChange={(e) => handleTransformChange('h', Number(e.target.value))}
                    className="w-full bg-transparent text-right text-xs text-slate-100 font-semibold focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 ml-1 select-none">px</span>
                </div>
              </div>

              {/* Rotation Angle */}
              <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
                <div className="flex items-center flex-1">
                  <span className="text-[10px] font-bold text-slate-400 select-none mr-2">Angle</span>
                  <input
                    type="number"
                    min={0}
                    max={359}
                    value={transformAngle}
                    onChange={(e) => handleTransformChange('angle', Number(e.target.value))}
                    className="w-full bg-transparent text-right text-xs text-slate-100 font-semibold focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 ml-1 select-none">°</span>
                </div>
                {transformAngle !== 0 && (
                  <button
                    type="button"
                    onClick={() => handleTransformChange('angle', 0)}
                    className="ml-2 text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* CARD 1: ARTBOARD ALIGNMENT */}
            <div className={`p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-2 transition-all duration-150 ${hasSelection ? 'opacity-100 ring-1 ring-cyan-500/40' : 'opacity-35 pointer-events-none select-none'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Artboard Align</span>
                {!hasSelection && <span className="text-[9px] text-slate-500 font-medium">No selection</span>}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => alignSelectedToArtboard('left')}
                  className="py-1 px-1.5 text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg cursor-pointer text-center"
                >
                  ⇤ Left
                </button>
                <button
                  type="button"
                  onClick={() => alignSelectedToArtboard('centerH')}
                  className="py-1 px-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/60 rounded-lg cursor-pointer text-center"
                >
                  ⇥ Center ⇤
                </button>
                <button
                  type="button"
                  onClick={() => alignSelectedToArtboard('right')}
                  className="py-1 px-1.5 text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg cursor-pointer text-center"
                >
                  Right ⇥
                </button>
                <button
                  type="button"
                  onClick={() => alignSelectedToArtboard('top')}
                  className="py-1 px-1.5 text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg cursor-pointer text-center"
                >
                  ⤊ Top
                </button>
                <button
                  type="button"
                  onClick={() => alignSelectedToArtboard('centerV')}
                  className="py-1 px-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/60 rounded-lg cursor-pointer text-center"
                >
                  Center V
                </button>
                <button
                  type="button"
                  onClick={() => alignSelectedToArtboard('bottom')}
                  className="py-1 px-1.5 text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg cursor-pointer text-center"
                >
                  ⤋ Bottom
                </button>
              </div>
            </div>

            {/* CARD 2: BARCODE & QR CODE PROPERTIES */}
            <div className={`p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-2.5 transition-all duration-150 ${selectedBarcode ? 'opacity-100 ring-1 ring-cyan-500/40' : 'opacity-35 pointer-events-none select-none'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Barcode / QR Properties</span>
                {!selectedBarcode && <span className="text-[9px] text-slate-500 font-medium">Select a code</span>}
              </div>
              
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-slate-400">Symbology Format:</span>
                <select
                  value={selectedBarcode?.barcodeType || 'qrcode'}
                  onChange={(e) => handleBarcodeTypeChange(e.target.value as 'qrcode' | 'code128' | 'code39')}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-800 rounded-lg bg-slate-950 text-slate-200 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="code128">Code 128 (Standard Barcode)</option>
                  <option value="code39">Code 39 (Alphanumeric)</option>
                  <option value="qrcode">QR Code 2D Matrix</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 pt-1">
                <span className="text-[10px] font-semibold text-slate-400">Render Fill Color:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleBarcodeColorChange("#000000")}
                    className={"py-1.5 px-3 text-xs font-bold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1.5 " +
                      (selectedBarcodeColor.toLowerCase() === "#000000" || selectedBarcodeColor.toLowerCase() === "000000"
                        ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm"
                        : "bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800")}
                  >
                    <span>⬛</span> Black
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBarcodeColorChange("#ffffff")}
                    className={"py-1.5 px-3 text-xs font-bold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1.5 " +
                      (selectedBarcodeColor.toLowerCase() === "#ffffff" || selectedBarcodeColor.toLowerCase() === "ffffff"
                        ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm"
                        : "bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800")}
                  >
                    <span>⬜</span> White
                  </button>
                </div>
              </div>
            </div>

            {/* CARD 3: TYPOGRAPHY & TEXT PROPERTIES */}
            <div className={`p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-2.5 transition-all duration-150 ${selectedTag ? 'opacity-100 ring-1 ring-cyan-500/40' : 'opacity-35 pointer-events-none select-none'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Typography & Style</span>
                {!selectedTag && <span className="text-[9px] text-slate-500 font-medium">Select a text field</span>}
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-400">Font Family:</span>
                  <label
                    className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 transition cursor-pointer shadow-xs hover:border-cyan-400 hover:text-white flex items-center gap-1 active:scale-95"
                    title="Upload custom .ttf or .otf file"
                  >
                    <span className="text-cyan-400">+</span> Custom Font
                    <input type="file" hidden accept=".ttf,.otf" onChange={handleFontUpload} />
                  </label>
                </div>
                <select
                  value={fontFamily}
                  onChange={(e) => handleFontFamilyChange(e.target.value)}
                  disabled={loadingFont}
                  className="w-full px-2 py-1.5 text-xs border border-slate-800 rounded-lg bg-slate-950 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  {customFontsList.length > 0 && (
                    <optgroup label="Uploaded Fonts">
                      {customFontsList.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </optgroup>
                  )}
                  {SYSTEM_FONT_GROUPS.map((group) => (
                    <optgroup key={group.category} label={group.category}>
                      {group.fonts.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-slate-400">Size (pt):</span>
                  <input
                    type="number"
                    min={8}
                    max={120}
                    value={fontSize}
                    onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                    className="w-full px-2 py-1 text-xs border border-slate-800 rounded-lg bg-slate-950 text-slate-100 font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-slate-400">Color:</span>
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-full h-[29px] p-0.5 border border-slate-800 rounded-lg bg-slate-950 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-1 pt-1">
                <div className="flex items-center border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                  <button
                    type="button"
                    onClick={() => handleAlignChange('left')}
                    className={`px-2.5 py-1 text-xs font-semibold ${
                      textAlign === 'left' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    L
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAlignChange('center')}
                    className={`px-2.5 py-1 text-xs font-semibold border-x border-slate-800 ${
                      textAlign === 'center' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    C
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAlignChange('right')}
                    className={`px-2.5 py-1 text-xs font-semibold ${
                      textAlign === 'right' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    R
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleBoldToggle}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition ${
                      isBold ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white'
                    }`}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={handleItalicToggle}
                    className={`px-2.5 py-1 text-xs italic font-serif font-bold rounded-lg border transition ${
                      isItalic ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white'
                    }`}
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={handleUppercaseToggle}
                    className={`px-2 py-1 text-xs font-black tracking-tight rounded-lg border transition ${
                      isUppercase ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white'
                    }`}
                  >
                    TT
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                className={`w-full mt-1 py-1.5 px-3 text-xs font-bold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  currentTagRules.length > 0
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                    : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60 hover:bg-indigo-900/60'
                }`}
              >
                <span>⚡</span> Conditional Rules ({currentTagRules.length})
              </button>
            </div>

            {/* CARD 4: IMAGE CROP & MASK */}
            <div className={`p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-2 transition-all duration-150 ${selectedImage ? 'opacity-100 ring-1 ring-cyan-500/40' : 'opacity-35 pointer-events-none select-none'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Image Shape Mask</span>
                {!selectedImage && <span className="text-[9px] text-slate-500 font-medium">Select an image</span>}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => applyImageMask('circle')}
                  className={`py-1 px-2 text-xs font-bold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedImageMask === 'circle'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  ◯ Circle
                </button>
                <button
                  type="button"
                  onClick={() => applyImageMask('rounded')}
                  className={`py-1 px-2 text-xs font-bold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedImageMask === 'rounded'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  ▢ Rounded
                </button>
                <button
                  type="button"
                  onClick={() => applyImageMask('square')}
                  className={`py-1 px-2 text-xs font-bold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedImageMask === 'square'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  □ 1:1 Square
                </button>
                <button
                  type="button"
                  onClick={() => applyImageMask('none')}
                  className="py-1 px-2 text-xs font-medium text-slate-400 hover:text-rose-400 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer text-center"
                >
                  Reset Crop
                </button>
              </div>
            </div>

          </div>
        </aside>
      </div>

      {/* 3. MODALS & OVERLAYS */}
            {/* Scope Export Modal */}
      {showScopeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-extrabold text-white">Configure Export Scope</h3>
              <button
                type="button"
                onClick={() => setShowScopeModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              Select which records and template pages you wish to compile:
            </p>

            <div className="mb-4 p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                1. Select CSV Records to Export:
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-300">
                <input
                  type="radio"
                  name="recordScope"
                  value="all"
                  checked={recordScopeMode === 'all'}
                  onChange={() => setRecordScopeMode('all')}
                  className="text-cyan-500"
                />
                <span>All Records ({csvData.length} records)</span>
              </label>

              {tableSearchQuery.trim() && (
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-300">
                  <input
                    type="radio"
                    name="recordScope"
                    value="filtered"
                    checked={recordScopeMode === 'filtered'}
                    onChange={() => setRecordScopeMode('filtered')}
                    className="text-cyan-500"
                  />
                  <span>
                    Filtered Search Results ({filteredIndexedRows.length} matching "{tableSearchQuery}")
                  </span>
                </label>
              )}

              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-300">
                <input
                  type="radio"
                  name="recordScope"
                  value="custom"
                  checked={recordScopeMode === 'custom'}
                  onChange={() => setRecordScopeMode('custom')}
                  className="text-cyan-500"
                />
                <span>Custom Record Range</span>
              </label>

              {recordScopeMode === 'custom' && (
                <div className="pl-6 pt-1">
                  <input
                    type="text"
                    value={customRecordRange}
                    onChange={(e) => setCustomRecordRange(e.target.value)}
                    placeholder="e.g. 1-10, 15, 20-30"
                    className="w-full px-2.5 py-1 text-xs border border-slate-800 rounded font-mono bg-slate-900 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Enter 1-based indices separated by commas and dashes. Max: {csvData.length}
                  </span>
                </div>
              )}
            </div>

            <div className="mb-6 p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                2. Select Template Pages to Include:
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-300">
                <input
                  type="radio"
                  name="pageScope"
                  value="all"
                  checked={pageScopeMode === 'all'}
                  onChange={() => setPageScopeMode('all')}
                  className="text-cyan-500"
                />
                <span>All Pages ({totalPages} page{totalPages > 1 ? 's' : ''})</span>
              </label>

              {totalPages > 1 && (
                <>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-300">
                    <input
                      type="radio"
                      name="pageScope"
                      value="custom"
                      checked={pageScopeMode === 'custom'}
                      onChange={() => setPageScopeMode('custom')}
                      className="text-cyan-500"
                    />
                    <span>Specific Page Range</span>
                  </label>

                  {pageScopeMode === 'custom' && (
                    <div className="pl-6 pt-1">
                      <input
                        type="text"
                        value={customPageRange}
                        onChange={(e) => setCustomPageRange(e.target.value)}
                        placeholder="e.g. 1 or 1, 2"
                        className="w-full px-2.5 py-1 text-xs border border-slate-800 rounded font-mono bg-slate-900 text-slate-200 focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowScopeModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteExport}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <span>⚡</span> Compile & Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Builder Modal */}
      {showRulesModal && selectedTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-extrabold text-white">
                Conditional Formatting Rules
              </h3>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Apply dynamic styling to <span className="font-mono font-bold text-cyan-400">{selectedTag.rawTemplateTag}</span>:
            </p>

            <div className="max-h-72 overflow-y-auto space-y-3 mb-4 pr-1">
              {currentTagRules.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
                  No conditional rules configured. Click below to add your first rule.
                </div>
              ) : (
                currentTagRules.map((rule, idx) => (
                  <div key={rule.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                        Rule #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-rose-400 hover:text-rose-300 text-xs font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-400">If value</span>
                      <select
                        value={rule.operator}
                        onChange={(e) => handleUpdateRule(rule.id, { operator: e.target.value as any })}
                        className="px-2 py-1 bg-slate-900 border border-slate-800 text-slate-200 rounded font-medium focus:ring-1 focus:ring-cyan-500"
                      >
                        <option value="equals">equals</option>
                        <option value="not_equals">does not equal</option>
                        <option value="contains">contains</option>
                        <option value="greater_than">&gt; (numeric)</option>
                        <option value="less_than">&lt; (numeric)</option>
                      </select>

                      <input
                        type="text"
                        placeholder="Target value..."
                        value={rule.value}
                        onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                        className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded font-semibold text-slate-100 flex-1 min-w-[120px]"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-1 border-t border-slate-800 text-xs">
                      <span className="font-semibold text-slate-400">Then format:</span>

                      <div className="flex items-center gap-1.5">
                        <label className="text-[11px] text-slate-400 font-medium">Color:</label>
                        <input
                          type="color"
                          value={rule.color || '#dc2626'}
                          onChange={(e) => handleUpdateRule(rule.id, { color: e.target.value })}
                          className="w-6 h-6 p-0 border border-slate-800 rounded cursor-pointer"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUpdateRule(rule.id, { isBold: !rule.isBold })}
                        className={`px-2 py-0.5 rounded border font-bold text-xs ${
                          rule.isBold ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-900 text-slate-300 border-slate-800'
                        }`}
                      >
                        B
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateRule(rule.id, { isItalic: !rule.isItalic })}
                        className={`px-2 py-0.5 rounded border italic font-serif font-bold text-xs ${
                          rule.isItalic ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-900 text-slate-300 border-slate-800'
                        }`}
                      >
                        I
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleAddRule}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-cyan-400 font-bold text-xs rounded-lg border border-cyan-800/60 transition cursor-pointer flex items-center gap-1"
              >
                <span>+</span> Add Condition
              </button>

              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-white text-slate-950 font-bold text-xs rounded-lg shadow-sm transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generating Progress Modal */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-800 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 mx-auto mb-3 bg-cyan-950 text-cyan-400 border border-cyan-800/80 rounded-full flex items-center justify-center text-xl font-black">
              ⚡
            </div>

            <h3 className="text-xl font-extrabold text-white mb-1">Generating Print Document</h3>
            <p className="text-xs font-semibold text-slate-400 mb-4 h-5 truncate">{progressStage}</p>

            <div className="w-full bg-slate-950 rounded-full h-4 mb-2 overflow-hidden border border-slate-800 shadow-inner">
              <div
                className="bg-gradient-to-r from-cyan-500 to-indigo-600 h-full rounded-full transition-all duration-100 ease-out flex items-center justify-end pr-1 text-[9px] font-bold text-white shadow-sm"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-400">
              <span>{progressCount.total > 0 ? `Record ${progressCount.current} of ${progressCount.total}` : 'Compiling...'}</span>
              <span className="text-cyan-400 font-extrabold">{progressPercent}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Export Options Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-800">
            <h3 className="text-xl font-extrabold text-white mb-2">Export Complete!</h3>
            <p className="text-sm text-slate-400 mb-4">
              Your variable data print file has been generated:
            </p>

            <div className="mb-5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                File Name:
              </label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={exportFilename}
                  onChange={(e) => setExportFilename(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-800 bg-slate-950 text-slate-100 rounded-l-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 font-semibold"
                  placeholder="Enter file name"
                  autoFocus
                />
                <span className="bg-slate-950 border border-l-0 border-slate-800 px-3 py-2 text-sm font-bold text-slate-400 rounded-r-lg">
                  .pdf
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleDirectDownload}
                className="w-full py-2.5 px-4 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>💾</span> Download PDF
              </button>

              <button
                type="button"
                onClick={handleOpenPdfTab}
                className="w-full py-2.5 px-4 text-xs font-bold text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>↗</span> Open in New Tab (Print / Save As...)
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSaveModal(false);
                  pendingBlobRef.current = null;
                }}
                className="w-full py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-300 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

