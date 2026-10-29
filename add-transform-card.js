const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/page.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. ADD STATE HOOKS (after const [hasSelection, setHasSelection] = useState...)
const hasSelectionNeedle = 'const [hasSelection, setHasSelection] = useState<boolean>(false);';
const transformStates = `const [hasSelection, setHasSelection] = useState<boolean>(false);
  const [transformX, setTransformX] = useState<number>(0);
  const [transformY, setTransformY] = useState<number>(0);
  const [transformW, setTransformW] = useState<number>(0);
  const [transformH, setTransformH] = useState<number>(0);
  const [transformAngle, setTransformAngle] = useState<number>(0);
  const [isRatioLocked, setIsRatioLocked] = useState<boolean>(false);`;

code = code.replace(hasSelectionNeedle, transformStates);

// 2. ENHANCE syncToolbarWithActiveObject & ADD TRANSFORM MUTATORS
const syncNeedle = 'const syncToolbarWithActiveObject = (obj: any) => {';
const syncReplacement = `const syncTransformValues = (obj: any) => {
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
    syncTransformValues(obj);`;

code = code.replace(syncNeedle, syncReplacement);

// 3. ATTACH TRANSFORM SYNC TO CANVAS LISTENERS
const listenerNeedle = "c.on('object:moving', handleObjectMoving);";
const listenerReplacement = `c.on('object:moving', (e: any) => {
          handleObjectMoving(e);
          syncTransformValues(c.getActiveObject());
        });
        c.on('object:scaling', () => {
          updateSelectionBounds();
          syncTransformValues(c.getActiveObject());
        });
        c.on('object:rotating', () => {
          syncTransformValues(c.getActiveObject());
        });`;

code = code.replace(listenerNeedle, listenerReplacement);

// 4. INJECT TRANSFORM CARD IN RIGHT INSPECTOR (Right above CARD 1: ARTBOARD ALIGNMENT)
const cardNeedle = '{/* CARD 1: ARTBOARD ALIGNMENT */}';
const transformCardJSX = `{/* CARD 0: EXACT TRANSFORM */}
              <div className={\`p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-2.5 transition-all duration-150 \${hasSelection ? 'opacity-100 ring-1 ring-cyan-500/40' : 'opacity-35 pointer-events-none select-none'}\`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Transform</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsRatioLocked(!isRatioLocked)}
                      className={\`px-1.5 py-0.5 text-[10px] font-bold rounded border transition cursor-pointer flex items-center gap-1 \${
                        isRatioLocked
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-xs'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border-slate-800'
                      }\`}
                      title="Lock aspect ratio when resizing"
                    >
                      <span>{isRatioLocked ? '🔒' : '🔓'}</span>
                      <span>Lock Ratio</span>
                    </button>
                    {!hasSelection && <span className="text-[9px] text-slate-500 font-medium">No selection</span>}
                  </div>
                </div>

                {/* X and Y Position */}
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

              {/* CARD 1: ARTBOARD ALIGNMENT */}`;

code = code.replace(cardNeedle, transformCardJSX);

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully added Transform Card and synchronizers to page.tsx');
