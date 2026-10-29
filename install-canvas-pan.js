const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/page.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Upgrade activeTool useEffect to temporarily toggle object interaction so dragging doesn't move text/shapes
const toolEffectNeedle = `if (activeTool === 'hand') {
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
    }`;

const upgradedToolEffect = `if (activeTool === 'hand') {
      canvas.defaultCursor = 'grab';
      canvas.hoverCursor = 'grab';
      canvas.selection = false;
      canvas.forEachObject((obj: any) => {
        obj.__prevSelectable = obj.selectable;
        obj.__prevEvented = obj.evented;
        obj.selectable = false;
        obj.evented = false;
      });
      canvas.discardActiveObject();
      canvas.renderAll();
      setHasSelection(false);
    } else {
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
      canvas.selection = true;
      canvas.forEachObject((obj: any) => {
        obj.selectable = obj.__prevSelectable ?? true;
        obj.evented = obj.__prevEvented ?? true;
      });
      canvas.renderAll();
    }`;

if (code.includes(toolEffectNeedle)) {
  code = code.replace(toolEffectNeedle, upgradedToolEffect);
}

// 2. Attach mouse:down, mouse:move, and mouse:up directly to Fabric canvas `c`
const selectionClearedNeedle = `c.on('selection:cleared', () => syncToolbarWithActiveObject(null));`;

const mouseListenersInjection = `c.on('selection:cleared', () => syncToolbarWithActiveObject(null));

        // Pan Listeners directly on Fabric Canvas Bus
        c.on('mouse:down', (opt: any) => {
          const isHand = isSpacePressedRef.current || activeToolRef.current === 'hand' || opt.e?.button === 1;
          if (isHand) {
            isPanningRef.current = true;
            const container = viewportScrollContainerRef.current;
            if (container) {
              panStartRef.current = {
                x: opt.e.clientX,
                y: opt.e.clientY,
                scrollLeft: container.scrollLeft,
                scrollTop: container.scrollTop,
              };
              c.defaultCursor = 'grabbing';
              c.hoverCursor = 'grabbing';
              container.style.cursor = 'grabbing';
            }
          }
        });

        c.on('mouse:move', (opt: any) => {
          if (!isPanningRef.current) return;
          const container = viewportScrollContainerRef.current;
          if (!container) return;

          const deltaX = opt.e.clientX - panStartRef.current.x;
          const deltaY = opt.e.clientY - panStartRef.current.y;

          container.scrollLeft = panStartRef.current.scrollLeft - deltaX;
          container.scrollTop = panStartRef.current.scrollTop - deltaY;
          setViewportScroll({ left: container.scrollLeft, top: container.scrollTop });
        });

        c.on('mouse:up', () => {
          if (isPanningRef.current) {
            isPanningRef.current = false;
            const container = viewportScrollContainerRef.current;
            const isHand = isSpacePressedRef.current || activeToolRef.current === 'hand';
            c.defaultCursor = isHand ? 'grab' : 'default';
            c.hoverCursor = isHand ? 'grab' : 'move';
            if (container) container.style.cursor = isHand ? 'grab' : 'default';
          }
        });`;

if (!code.includes("c.on('mouse:down'")) {
  code = code.replace(selectionClearedNeedle, mouseListenersInjection);
}

// 3. Ensure global mouseup on window releases pan grab even if mouse exits the canvas bounds
const windowCleanupNeedle = `const handleKeyDown = (e: KeyboardEvent) => {`;
const globalMouseUpInjection = `const handleGlobalMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        const c = fabricCanvasRef.current;
        const container = viewportScrollContainerRef.current;
        const isHand = isSpacePressedRef.current || activeToolRef.current === 'hand';
        if (c) {
          c.defaultCursor = isHand ? 'grab' : 'default';
          c.hoverCursor = isHand ? 'grab' : 'move';
        }
        if (container) container.style.cursor = isHand ? 'grab' : 'default';
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);

    const handleKeyDown = (e: KeyboardEvent) => {`;

if (!code.includes('handleGlobalMouseUp')) {
  code = code.replace(windowCleanupNeedle, globalMouseUpInjection);
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully wired Fabric canvas mouse events and interaction locking.');
