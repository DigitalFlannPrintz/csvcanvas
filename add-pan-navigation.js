const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/page.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add tool mode and pan state right after viewportScroll state
const viewportScrollNeedle = `const [viewportScroll, setViewportScroll] = useState<{ left: number; top: number }>({ left: 0, top: 0 });`;
const panStateInjection = `const [viewportScroll, setViewportScroll] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [activeTool, setActiveTool] = useState<'select' | 'hand'>('select');
  const activeToolRef = useRef<'select' | 'hand'>('select');
  const isSpacePressedRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });`;

if (!code.includes('activeToolRef')) {
  code = code.replace(viewportScrollNeedle, panStateInjection);
}

// 2. Add keyboard listeners and Fabric pan interceptors
const panLogicHookNeedle = `  // Keyboard Shortcuts (Undo, Redo, Delete, Arrow Keys)`;
const panLogicImplementation = `  // Sync activeTool state with ref
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

  // Spacebar Hand Tool Toggle & Window Drag Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, or contentEditable
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
        const container = viewportScrollContainerRef.current;
        if (container) container.style.cursor = 'grab';
      }

      // Quick hotkeys: V for select, H for hand
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
        const isHandMode = activeToolRef.current === 'hand';

        if (canvas) {
          canvas.defaultCursor = isHandMode ? 'grab' : 'default';
          canvas.hoverCursor = isHandMode ? 'grab' : 'move';
          canvas.selection = !isHandMode;
        }
        const container = viewportScrollContainerRef.current;
        if (container) container.style.cursor = isHandMode ? 'grab' : 'default';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Fabric Canvas Pan Event Listeners
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const onMouseDown = (opt: any) => {
      const isHandOrSpace = isSpacePressedRef.current || activeToolRef.current === 'hand';
      // Allow panning if hand mode / spacebar is active, or middle mouse button (button 2) is clicked
      if (isHandOrSpace || opt.e.button === 1) {
        isPanningRef.current = true;
        const container = viewportScrollContainerRef.current;
        if (!container) return;

        panStartRef.current = {
          x: opt.e.clientX,
          y: opt.e.clientY,
          scrollLeft: container.scrollLeft,
          scrollTop: container.scrollTop,
        };

        canvas.defaultCursor = 'grabbing';
        canvas.hoverCursor = 'grabbing';
        container.style.cursor = 'grabbing';
      }
    };

    const onMouseMove = (opt: any) => {
      if (!isPanningRef.current) return;
      const container = viewportScrollContainerRef.current;
      if (!container) return;

      const deltaX = opt.e.clientX - panStartRef.current.x;
      const deltaY = opt.e.clientY - panStartRef.current.y;

      container.scrollLeft = panStartRef.current.scrollLeft - deltaX;
      container.scrollTop = panStartRef.current.scrollTop - deltaY;
      setViewportScroll({ left: container.scrollLeft, top: container.scrollTop });
    };

    const onMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        const isHandOrSpace = isSpacePressedRef.current || activeToolRef.current === 'hand';
        canvas.defaultCursor = isHandOrSpace ? 'grab' : 'default';
        canvas.hoverCursor = isHandOrSpace ? 'grab' : 'move';
        const container = viewportScrollContainerRef.current;
        if (container) container.style.cursor = isHandOrSpace ? 'grab' : 'default';
      }
    };

    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);

    return () => {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
    };
  }, [canvasWidth, canvasHeight]);

  // Keyboard Shortcuts (Undo, Redo, Delete, Arrow Keys)`;

if (!code.includes('activeToolRef.current = activeTool')) {
  code = code.replace(panLogicHookNeedle, panLogicImplementation);
}

// 3. Add Tool Mode Toggle into the Top Control Shelf
const topShelfToolNeedle = `{/* Zoom Controls */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">`;

const toolModeButtons = `{/* Tool Selection: Select vs Hand (Pan) */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTool('select')}
                  className={\`px-2.5 py-1 text-[11px] font-semibold rounded transition cursor-pointer flex items-center gap-1.5 \${
                    activeTool === 'select'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-850'
                  }\`}
                  title="Select Tool (V)"
                >
                  <span>↖</span> Select
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTool('hand')}
                  className={\`px-2.5 py-1 text-[11px] font-semibold rounded transition cursor-pointer flex items-center gap-1.5 \${
                    activeTool === 'hand'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-850'
                  }\`}
                  title="Hand / Pan Tool (H or hold Spacebar)"
                >
                  <span>✋</span> Hand
                </button>
              </div>

              <div className="h-4 w-px bg-slate-800 mx-0.5" />

              {/* Zoom Controls */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">`;

if (!code.includes('Select Tool (V)')) {
  code = code.replace(topShelfToolNeedle, toolModeButtons);
}

// 4. Also enable native container drag panning when clicking outside the canvas on the background stage
const viewportStageContainerNeedle = `onScroll={(e) => {
                const target = e.currentTarget;
                setViewportScroll({ left: target.scrollLeft, top: target.scrollTop });
                fabricCanvasRef.current?.calcOffset();
              }}`;

const viewportStageContainerReplacement = `onScroll={(e) => {
                const target = e.currentTarget;
                setViewportScroll({ left: target.scrollLeft, top: target.scrollTop });
                fabricCanvasRef.current?.calcOffset();
              }}
              onMouseDown={(e) => {
                const isHandOrSpace = isSpacePressedRef.current || activeToolRef.current === 'hand';
                if (isHandOrSpace || e.button === 1) {
                  isPanningRef.current = true;
                  const container = viewportScrollContainerRef.current;
                  if (!container) return;
                  panStartRef.current = {
                    x: e.clientX,
                    y: e.clientY,
                    scrollLeft: container.scrollLeft,
                    scrollTop: container.scrollTop,
                  };
                  container.style.cursor = 'grabbing';
                }
              }}
              onMouseMove={(e) => {
                if (!isPanningRef.current) return;
                const container = viewportScrollContainerRef.current;
                if (!container) return;
                const deltaX = e.clientX - panStartRef.current.x;
                const deltaY = e.clientY - panStartRef.current.y;
                container.scrollLeft = panStartRef.current.scrollLeft - deltaX;
                container.scrollTop = panStartRef.current.scrollTop - deltaY;
                setViewportScroll({ left: container.scrollLeft, top: container.scrollTop });
              }}
              onMouseUp={() => {
                if (isPanningRef.current) {
                  isPanningRef.current = false;
                  const container = viewportScrollContainerRef.current;
                  const isHandOrSpace = isSpacePressedRef.current || activeToolRef.current === 'hand';
                  if (container) container.style.cursor = isHandOrSpace ? 'grab' : 'default';
                }
              }}`;

if (!code.includes('panStartRef.current = {')) {
  code = code.replace(viewportStageContainerNeedle, viewportStageContainerReplacement);
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully implemented click-and-grab panning system with Spacebar and Hand tool.');
