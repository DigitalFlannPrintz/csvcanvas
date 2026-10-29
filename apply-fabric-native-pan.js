const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/page.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add activeTool state & spacebar tracker right after guideBounds
const guideBoundsDeclaration = `const [guideBounds, setGuideBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);`;
const toolStateAdditions = `const [guideBounds, setGuideBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'hand'>('select');
  const activeToolRef = useRef<'select' | 'hand'>('select');
  const isSpacePressedRef = useRef<boolean>(false);
  const [rulerOffset, setRulerOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });`;

if (!code.includes('const [activeTool, setActiveTool]')) {
  code = code.replace(guideBoundsDeclaration, toolStateAdditions);
}

// 2. Add Spacebar and Tool mode synchronizer
const shortcutsAnchor = `  // Keyboard Shortcuts (Undo, Redo, Delete, Arrow Keys)`;
const toolListeners = `  // Native Pan Mode & Spacebar Listeners
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
        const canvas = fabricCanvasRef.current;
        const isHand = activeToolRef.current === 'hand';
        if (canvas) {
          canvas.defaultCursor = isHand ? 'grab' : 'default';
          canvas.hoverCursor = isHand ? 'grab' : 'move';
          canvas.selection = !isHand;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
`;

if (!code.includes('// Native Pan Mode & Spacebar Listeners')) {
  code = code.replace(shortcutsAnchor, `${toolListeners}\n${shortcutsAnchor}`);
}

// 3. Attach Fabric's native relativePan directly inside canvas initialization
const saveStateCall = `saveState(c);`;
const nativePanListeners = `saveState(c);

        let isDraggingViewport = false;
        let lastPosX = 0;
        let lastPosY = 0;

        c.on('mouse:down', (opt: any) => {
          const isHand = isSpacePressedRef.current || activeToolRef.current === 'hand' || opt.e?.button === 1;
          if (isHand) {
            isDraggingViewport = true;
            lastPosX = opt.e.clientX;
            lastPosY = opt.e.clientY;
            c.defaultCursor = 'grabbing';
            c.hoverCursor = 'grabbing';
            c.selection = false;
          }
        });

        c.on('mouse:move', (opt: any) => {
          if (!isDraggingViewport) return;
          const deltaX = opt.e.clientX - lastPosX;
          const deltaY = opt.e.clientY - lastPosY;
          lastPosX = opt.e.clientX;
          lastPosY = opt.e.clientY;

          c.relativePan(new fb.Point(deltaX, deltaY));

          const vpt = c.viewportTransform;
          if (vpt) {
            setRulerOffset({ x: vpt[4], y: vpt[5] });
          }
        });

        c.on('mouse:up', () => {
          if (isDraggingViewport) {
            isDraggingViewport = false;
            c.setViewportTransform(c.viewportTransform);
            const isHand = isSpacePressedRef.current || activeToolRef.current === 'hand';
            c.defaultCursor = isHand ? 'grab' : 'default';
            c.hoverCursor = isHand ? 'grab' : 'move';
            c.selection = !isHand;
          }
        });`;

if (!code.includes('c.relativePan')) {
  code = code.replace(saveStateCall, nativePanListeners);
}

// 4. Inject Select & Hand toggle buttons into the top toolbar
const zoomControlComment = `{/* Zoom Controls */}`;
const topBarToolButtons = `{/* Select / Hand Navigation */}
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
                  title="Hand Tool (H or hold Spacebar)"
                >
                  <span className="text-xs">✋</span> Hand
                </button>
              </div>

              <div className="h-4 w-px bg-slate-800 mx-0.5" />

              {/* Zoom Controls */}`;

if (!code.includes('Hand Tool (H or hold Spacebar)')) {
  code = code.replace(zoomControlComment, topBarToolButtons);
}

// 5. Connect rulers to Fabric's viewport transform offset
code = code.replace(
  /transform:\s*`translateX\([^`]+\)`/g,
  "transform: `translateX(${rulerOffset.x}px)`"
);
code = code.replace(
  /transform:\s*`translateY\([^`]+\)`/g,
  "transform: `translateY(${rulerOffset.y}px)`"
);

fs.writeFileSync(filePath, code, 'utf8');
console.log('Applied Fabric native relativePan implementation.');
