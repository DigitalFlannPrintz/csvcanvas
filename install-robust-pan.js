const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/page.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add panOffset state and ref right around viewportScroll
const oldStateHook = `const [viewportScroll, setViewportScroll] = useState<{ left: number; top: number }>({ left: 0, top: 0 });`;
const newStateHook = `const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const panOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [viewportScroll, setViewportScroll] = useState<{ left: number; top: number }>({ left: 0, top: 0 });`;

if (!code.includes('panOffsetRef = useRef')) {
  code = code.replace(oldStateHook, newStateHook);
}

// 2. Locate and replace the Fabric mouse listeners inside canvas init
const oldFabricMouseStart = `c.on('selection:cleared', () => syncToolbarWithActiveObject(null));`;
const fabricPanReplacement = `c.on('selection:cleared', () => syncToolbarWithActiveObject(null));

        // Direct Fabric Event Pan Engine
        c.on('mouse:down', (opt: any) => {
          const isHand = isSpacePressedRef.current || activeToolRef.current === 'hand' || opt.e?.button === 1;
          if (isHand) {
            isPanningRef.current = true;
            panStartRef.current = {
              x: opt.e.clientX,
              y: opt.e.clientY,
              scrollLeft: panOffsetRef.current.x,
              scrollTop: panOffsetRef.current.y,
            };
            c.defaultCursor = 'grabbing';
            c.hoverCursor = 'grabbing';
          }
        });

        c.on('mouse:move', (opt: any) => {
          if (!isPanningRef.current) return;
          const deltaX = opt.e.clientX - panStartRef.current.x;
          const deltaY = opt.e.clientY - panStartRef.current.y;
          const nextX = panStartRef.current.scrollLeft + deltaX;
          const nextY = panStartRef.current.scrollTop + deltaY;
          panOffsetRef.current = { x: nextX, y: nextY };
          setPanOffset({ x: nextX, y: nextY });
        });

        c.on('mouse:up', () => {
          if (isPanningRef.current) {
            isPanningRef.current = false;
            const isHand = isSpacePressedRef.current || activeToolRef.current === 'hand';
            c.defaultCursor = isHand ? 'grab' : 'default';
            c.hoverCursor = isHand ? 'grab' : 'move';
          }
        });`;

// Replace existing Fabric mouse listeners block
const startListenerIdx = code.indexOf(oldFabricMouseStart);
if (startListenerIdx !== -1) {
  const afterSelectionCleared = code.indexOf("const handleGlobalMouseUp", startListenerIdx);
  if (afterSelectionCleared !== -1) {
    code = code.substring(0, startListenerIdx) + fabricPanReplacement + '\n\n        ' + code.substring(afterSelectionCleared);
  }
}

// 3. Update global window listeners so pointer move/up works even outside the canvas element
const globalWindowListeners = `
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return;
      const deltaX = e.clientX - panStartRef.current.x;
      const deltaY = e.clientY - panStartRef.current.y;
      const nextX = panStartRef.current.scrollLeft + deltaX;
      const nextY = panStartRef.current.scrollTop + deltaY;
      panOffsetRef.current = { x: nextX, y: nextY };
      setPanOffset({ x: nextX, y: nextY });
    };

    const handleGlobalMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        const c = fabricCanvasRef.current;
        const isHand = isSpacePressedRef.current || activeToolRef.current === 'hand';
        if (c) {
          c.defaultCursor = isHand ? 'grab' : 'default';
          c.hoverCursor = isHand ? 'grab' : 'move';
        }
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
`;

const oldGlobalUpNeedle = `const handleGlobalMouseUp = () => {`;
if (code.includes(oldGlobalUpNeedle)) {
  const existingEnd = code.indexOf(`window.addEventListener('mouseup', handleGlobalMouseUp);`);
  if (existingEnd !== -1) {
    code = code.substring(0, code.indexOf(oldGlobalUpNeedle)) + globalWindowListeners + code.substring(existingEnd + `window.addEventListener('mouseup', handleGlobalMouseUp);`.length);
  }
}

// 4. Update Horizontal Ruler transform to reflect panOffset.x
code = code.replace(
  /transform:\s*`translateX\([^`]+\)`/g,
  "transform: `translateX(${panOffset.x}px)`"
);

// 5. Update Vertical Ruler transform to reflect panOffset.y
code = code.replace(
  /transform:\s*`translateY\([^`]+\)`/g,
  "transform: `translateY(${panOffset.y}px)`"
);

// 6. Update the Viewport Stage and Canvas Card to use panOffset
const stageWrapperNeedle = `{/* Scrollable Viewport Stage */}
            <div
              ref={viewportScrollContainerRef}`;

const stageWrapperIdx = code.indexOf(stageWrapperNeedle);
if (stageWrapperIdx !== -1) {
  const stageCloseIdx = code.indexOf(`{/* SLIDE-UP CSV DATA TABLE DRAWER */}`);
  const stageBlock = code.substring(stageWrapperIdx, stageCloseIdx);

  const newStageBlock = `{/* Scrollable Viewport Stage */}
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
                    scrollLeft: panOffsetRef.current.x,
                    scrollTop: panOffsetRef.current.y,
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
                  transition: isPanningRef.current ? 'none' : 'transform 0.05s ease-out',
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

  code = code.substring(0, stageWrapperIdx) + newStageBlock + code.substring(stageCloseIdx);
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully installed transform-based pan engine.');
