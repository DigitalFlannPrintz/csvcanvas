const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/page.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add pan and tool state
if (!code.includes('const [activeTool, setActiveTool]')) {
  const guideBoundsNeedle = `const [guideBounds, setGuideBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);`;
  const panStateDeclarations = `const [guideBounds, setGuideBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [viewportScroll, setViewportScroll] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const panOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<'select' | 'hand'>('select');
  const activeToolRef = useRef<'select' | 'hand'>('select');
  const isSpacePressedRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; startPanX: number; startPanY: number }>({ x: 0, y: 0, startPanX: 0, startPanY: 0 });
  const viewportScrollContainerRef = useRef<HTMLDivElement>(null);`;

  code = code.replace(guideBoundsNeedle, panStateDeclarations);
}

// 2. Add Tool Mode & Spacebar Listeners
if (!code.includes('// Spacebar and Hand Tool Pan Engine')) {
  const insertionPoint = `  // Keyboard Shortcuts (Undo, Redo, Delete, Arrow Keys)`;
  const engineHooks = `  // Spacebar and Hand Tool Pan Engine
  useEffect(() => {
    activeToolRef.current = activeTool;
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (activeTool === 'hand') {
      canvas.defaultCursor = 'grab';
      canvas.hoverCursor = 'grab';
      canvas.selection = false;
      canvas.discardActiveObject();
      canvas.renderAll();
      setHasSelection(false);
    } else {
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
      canvas.selection = true;
    }
  }, [activeTool]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable) return;

      if (e.code === 'Space' && !e.repeat && !isSpacePressedRef.current) {
        e.preventDefault();
        isSpacePressedRef.current = true;
        const canvas = fabricCanvasRef.current;
        if (canvas) {
          canvas.defaultCursor = 'grab';
          canvas.hoverCursor = 'grab';
          canvas.selection = false;
        }
      }

      if (e.key.toLowerCase() === 'h' && !e.metaKey && !e.ctrlKey) {
        setActiveTool('hand');
      } else if (e.key.toLowerCase() === 'v' && !e.metaKey && !e.ctrlKey) {
        setActiveTool('select');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        isPanningRef.current = false;
        const canvas = fabricCanvasRef.current;
        const isHand = activeToolRef.current === 'hand';
        if (canvas) {
          canvas.defaultCursor = isHand ? 'grab' : 'default';
          canvas.hoverCursor = isHand ? 'grab' : 'move';
          canvas.selection = !isHand;
        }
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return;
      const deltaX = e.clientX - panStartRef.current.x;
      const deltaY = e.clientY - panStartRef.current.y;
      const nx = panStartRef.current.startPanX + deltaX;
      const ny = panStartRef.current.startPanY + deltaY;
      panOffsetRef.current = { x: nx, y: ny };
      setPanOffset({ x: nx, y: ny });
    };

    const handleGlobalMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        const canvas = fabricCanvasRef.current;
        const isHand = isSpacePressedRef.current || activeToolRef.current === 'hand';
        if (canvas) {
          canvas.defaultCursor = isHand ? 'grab' : 'default';
          canvas.hoverCursor = isHand ? 'grab' : 'move';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);
`;
  code = code.replace(insertionPoint, `${engineHooks}\n${insertionPoint}`);
}

// 3. Inject mouse event listeners into the Fabric Canvas initialization block
const canvasInitNeedle = `const c = new fb.Canvas(canvasEl, {`;
const fabricClearedNeedle = `c.on('selection:cleared', () => syncToolbarWithActiveObject(null));`;

if (code.includes(canvasInitNeedle) && !code.includes("c.on('mouse:down', onCanvasMouseDown)")) {
  const fabricPanListeners = `c.on('selection:cleared', () => syncToolbarWithActiveObject(null));

        const onCanvasMouseDown = (opt: any) => {
          const isHand = isSpacePressedRef.current || activeToolRef.current === 'hand' || opt.e?.button === 1;
          if (isHand) {
            isPanningRef.current = true;
            panStartRef.current = {
              x: opt.e.clientX,
              y: opt.e.clientY,
              startPanX: panOffsetRef.current.x,
              startPanY: panOffsetRef.current.y,
            };
            c.defaultCursor = 'grabbing';
            c.hoverCursor = 'grabbing';
          }
        };

        const onCanvasMouseMove = (opt: any) => {
          if (!isPanningRef.current) return;
          const deltaX = opt.e.clientX - panStartRef.current.x;
          const deltaY = opt.e.clientY - panStartRef.current.y;
          const nx = panStartRef.current.startPanX + deltaX;
          const ny = panStartRef.current.startPanY + deltaY;
          panOffsetRef.current = { x: nx, y: ny };
          setPanOffset({ x: nx, y: ny });
        };

        const onCanvasMouseUp = () => {
          if (isPanningRef.current) {
            isPanningRef.current = false;
            const isHand = isSpacePressedRef.current || activeToolRef.current === 'hand';
            c.defaultCursor = isHand ? 'grab' : 'default';
            c.hoverCursor = isHand ? 'grab' : 'move';
          }
        };

        c.on('mouse:down', onCanvasMouseDown);
        c.on('mouse:move', onCanvasMouseMove);
        c.on('mouse:up', onCanvasMouseUp);`;

  code = code.replace(fabricClearedNeedle, fabricPanListeners);
}

// 4. Inject Select / Hand segmented control into Top Shelf
const zoomControlsNeedle = `{/* Zoom Controls */}`;
if (!code.includes('Select Tool (V)')) {
  const toolButtonsJSX = `{/* Select / Hand Tools */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTool('select')}
                  className={\`px-2.5 py-1 text-[11px] font-semibold rounded transition cursor-pointer flex items-center gap-1 \${
                    activeTool === 'select'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-850'
                  }\`}
                  title="Select Tool (V)"
                >
                  <span className="text-xs">↖</span> Select
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTool('hand')}
                  className={\`px-2.5 py-1 text-[11px] font-semibold rounded transition cursor-pointer flex items-center gap-1 \${
                    activeTool === 'hand'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-850'
                  }\`}
                  title="Hand / Pan Tool (H or hold Spacebar)"
                >
                  <span className="text-xs">✋</span> Hand
                </button>
              </div>

              <div className="h-4 w-px bg-slate-800 mx-0.5" />

              {/* Zoom Controls */}`;

  code = code.replace(zoomControlsNeedle, toolButtonsJSX);
}

// 5. Replace Stage with Perimeter Rulers, Dropzone, and Transform-Based Canvas Card
const stageStartNeedle = `{/* Centered Scrollable Canvas Artboard`;
const drawerStartNeedle = `{/* SLIDE-UP CSV DATA TABLE DRAWER */}`;

const startIdx = code.indexOf(stageStartNeedle);
const endIdx = code.indexOf(drawerStartNeedle);

if (startIdx !== -1 && endIdx !== -1) {
  const newStageJSX = `{/* Centered Scrollable Canvas Artboard with Viewport Perimeter Rulers */}
          <div className="relative flex-1 overflow-hidden bg-slate-950 flex flex-col">
            {/* Top-Left Corner Block */}
            <div
              className="absolute top-0 left-0 z-20 bg-slate-900 border-r border-b border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 font-mono select-none"
              style={{ width: \`\${RULER_SIZE}px\`, height: \`\${RULER_SIZE}px\` }}
            >
              px
            </div>

            {/* Horizontal Perimeter Ruler (Top) */}
            <div
              className="absolute top-0 right-0 z-10 bg-[#090d16] border-b border-slate-800 overflow-hidden pointer-events-none"
              style={{ left: \`\${RULER_SIZE}px\`, height: \`\${RULER_SIZE}px\` }}
            >
              <div
                style={{
                  transform: \`translateX(\${panOffset.x}px)\`,
                  width: \`\${canvasWidth}px\`,
                  height: \`\${RULER_SIZE}px\`,
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
                    <g key={\`x-\${x}\`}>
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
                      left: \`\${guideBounds.left}px\`,
                      width: \`\${guideBounds.width}px\`,
                      height: \`\${RULER_SIZE}px\`,
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
              style={{ top: \`\${RULER_SIZE}px\`, width: \`\${RULER_SIZE}px\` }}
            >
              <div
                style={{
                  transform: \`translateY(\${panOffset.y}px)\`,
                  height: \`\${canvasHeight}px\`,
                  width: \`\${RULER_SIZE}px\`,
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
                    <g key={\`y-\${y}\`}>
                      <line x1="0" y1={y} x2={RULER_SIZE} y2={y} stroke="#475569" strokeWidth="1.5" />
                      {y !== 0 && (
                        <text
                          x="13"
                          y={y - 3}
                          fill="#94a3b8"
                          fontSize="10"
                          fontWeight="bold"
                          fontFamily="monospace"
                          transform={\`rotate(-90, 13, \${y - 3})\`}
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
                      top: \`\${guideBounds.top}px\`,
                      width: \`\${RULER_SIZE}px\`,
                      height: \`\${guideBounds.height}px\`,
                      backgroundColor: 'rgba(56, 189, 248, 0.35)',
                      borderTop: '2px solid #38bdf8',
                      borderBottom: '2px solid #38bdf8',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>
            </div>

            {/* Viewport Center Stage */}
            <div
              ref={viewportScrollContainerRef}
              className="flex-1 overflow-hidden flex items-center justify-center relative bg-slate-950/80 select-none cursor-default"
              style={{
                marginLeft: \`\${RULER_SIZE}px\`,
                marginTop: \`\${RULER_SIZE}px\`,
              }}
              onMouseDown={(e) => {
                const isHandOrSpace = isSpacePressedRef.current || activeToolRef.current === 'hand';
                if (isHandOrSpace || e.button === 1) {
                  isPanningRef.current = true;
                  panStartRef.current = {
                    x: e.clientX,
                    y: e.clientY,
                    startPanX: panOffsetRef.current.x,
                    startPanY: panOffsetRef.current.y,
                  };
                }
              }}
            >
              {/* Empty State: Compact Drag & Drop Card */}
              {!pdfBytes && (
                <div className="flex flex-col items-center justify-center py-16 px-4 w-full z-10">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingPdf(true);
                    }}
                    onDragLeave={() => setIsDraggingPdf(false)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setIsDraggingPdf(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type === "application/pdf") {
                        await processPdfFile(file);
                      } else if (file) {
                        alert("Please drop a valid .pdf file.");
                      }
                    }}
                    className={"w-full max-w-md p-8 rounded-2xl border-2 border-dashed flex flex-col items-center text-center transition-all duration-200 backdrop-blur-md shadow-2xl select-none " +
                      (isDraggingPdf
                        ? "bg-cyan-950/70 border-cyan-400 text-cyan-200 scale-[1.02]"
                        : "bg-slate-900/60 border-slate-700/80 hover:border-cyan-500/50 hover:bg-slate-900/90 text-slate-300")}
                  >
                    <div className="w-14 h-14 mb-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center text-2xl shadow-inner">
                      📄
                    </div>
                    <h3 className="text-base font-bold text-slate-100 mb-1">
                      Drag & drop your Background PDF
                    </h3>
                    <p className="text-xs text-slate-400 mb-6 max-w-xs leading-relaxed">
                      Upload your certificate, badge, or document template to start adding dynamic fields.
                    </p>

                    <label className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-950/40 transition-all cursor-pointer flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]">
                      <span>Browse PDF File</span>
                      <input
                        type="file"
                        hidden
                        accept="application/pdf"
                        onChange={handlePdfUpload}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Isolated White Document Canvas Card */}
              <div
                style={{
                  display: pdfBytes ? 'block' : 'none',
                  width: \`\${canvasWidth}px\`,
                  height: \`\${canvasHeight}px\`,
                  position: 'relative',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 20px 40px -15px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)',
                  transform: \`translate(\${panOffset.x}px, \${panOffset.y}px)\`,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: \`\${canvasWidth}px\`,
                    height: \`\${canvasHeight}px\`,
                  }}
                  ref={containerRef}
                />
              </div>
            </div>
          </div>

          `;

  code = code.substring(0, startIdx) + newStageJSX + code.substring(endIdx);
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully installed studio workspace with dropzone and pan engine.');
