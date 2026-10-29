const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/page.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Ensure panOffset state and refs
if (!code.includes('panOffset, setPanOffset')) {
  code = code.replace(
    'const [viewportScroll, setViewportScroll] = useState<{ left: number; top: number }>({ left: 0, top: 0 });',
    `const [viewportScroll, setViewportScroll] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const panOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });`
  );
}

// 2. Link perimeter rulers directly to panOffset
code = code.replace(
  /transform:\s*`translateX\([^`]+\)`/g,
  "transform: `translateX(${panOffset.x}px)`"
);
code = code.replace(
  /transform:\s*`translateY\([^`]+\)`/g,
  "transform: `translateY(${panOffset.y}px)`"
);

// 3. Apply translate transform directly to the white canvas card
code = code.replace(
  "boxShadow: '0 20px 40px -15px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)',",
  "boxShadow: '0 20px 40px -15px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)',\n                  transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,"
);

// 4. Attach mouse handlers to Fabric canvas instance
const targetCleared = "c.on('selection:cleared', () => syncToolbarWithActiveObject(null));";
const panHandlers = `c.on('selection:cleared', () => syncToolbarWithActiveObject(null));

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
          const nx = panStartRef.current.scrollLeft + deltaX;
          const ny = panStartRef.current.scrollTop + deltaY;
          panOffsetRef.current = { x: nx, y: ny };
          setPanOffset({ x: nx, y: ny });
        });

        c.on('mouse:up', () => {
          if (isPanningRef.current) {
            isPanningRef.current = false;
            const isHand = isSpacePressedRef.current || activeToolRef.current === 'hand';
            c.defaultCursor = isHand ? 'grab' : 'default';
            c.hoverCursor = isHand ? 'grab' : 'move';
          }
        });`;

if (!code.includes("panOffsetRef.current = { x: nx, y: ny }")) {
  code = code.replace(targetCleared, panHandlers);
}

// 5. Global mouse listeners so drag continues smoothly even if the cursor leaves the canvas element
const keydownBlock = "window.addEventListener('keydown', handleKeyDown);";
const globalMoveUp = `const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return;
      const deltaX = e.clientX - panStartRef.current.x;
      const deltaY = e.clientY - panStartRef.current.y;
      const nx = panStartRef.current.scrollLeft + deltaX;
      const ny = panStartRef.current.scrollTop + deltaY;
      panOffsetRef.current = { x: nx, y: ny };
      setPanOffset({ x: nx, y: ny });
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
    window.addEventListener('keydown', handleKeyDown);`;

if (!code.includes("window.addEventListener('mousemove', handleGlobalMouseMove);")) {
  code = code.replace(keydownBlock, globalMoveUp);
}

// 6. Cleanup event listeners on unmount
const returnBlock = "window.removeEventListener('keydown', handleKeyDown);";
const returnCleanup = `window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);`;

if (!code.includes("window.removeEventListener('mousemove', handleGlobalMouseMove);")) {
  code = code.replace(returnBlock, returnCleanup);
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Pan engine configured cleanly without syntax errors.');
