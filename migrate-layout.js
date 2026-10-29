const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/page.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const idxReturn = lines.findIndex((l) => l.includes('return (') && !l.includes('return () =>'));
const idxTopNav = lines.findIndex((l) => l.includes('{/* Sleek Top Navigation Bar'));
const idxDock = lines.findIndex((l) => l.includes('{/* Sticky Floating Controls Dock'));
const idxCsvAccordion = lines.findIndex((l) => l.includes('{/* Expandable CSV Data Preview Accordion'));
const idxShelf1 = lines.findIndex((l) => l.includes('{/* Row 1 Floating Studio Shelf'));
const idxShelf2 = lines.findIndex((l) => l.includes('{/* Row 2 Floating Studio Toolbar'));
const idxChips = lines.findIndex((l) => l.includes('{/* Dynamic Column Chips & Dynamic Barcodes'));
const idxCanvasStage = lines.findIndex((l) => l.includes('{/* Isolated Studio Workarea & Canvas Container'));
const idxModals = lines.findIndex((l) => l.includes('{/* Scope Export Modal'));

const preReturn = lines.slice(0, idxReturn).join('\n');

// Replace the final </main> with </div> in modalsAndFooter
let modalsAndFooter = lines.slice(idxModals).join('\n');
modalsAndFooter = modalsAndFooter.replace(/<\/main>(\s*\);\s*})/g, '</div>$1');

const headerBlock = lines.slice(idxTopNav, idxDock).join('\n');
const dockBlock = lines.slice(idxDock, idxCsvAccordion).join('\n');
const csvTableBlock = lines.slice(idxCsvAccordion, idxShelf1).join('\n');
const shelf1Block = lines.slice(idxShelf1, idxShelf2).join('\n');
const shelf2InspectorBlock = lines.slice(idxShelf2, idxChips).join('\n');
const chipsBlock = lines.slice(idxChips, idxCanvasStage).join('\n');
const canvasStageBlock = lines.slice(idxCanvasStage, idxModals).join('\n');

const newReturnJSX = `  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
      {/* 1. TOP GLOBAL APP HEADER */}
      <div className="shrink-0 z-30">
        ${headerBlock}
      </div>

      {/* 2. THREE-PANE MAIN WORKBENCH */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        
        {/* LEFT PANEL: Ingestion, CSV Chips & Elements (w-80) */}
        <aside className="w-80 shrink-0 border-r border-slate-800/80 bg-slate-900/40 flex flex-col overflow-y-auto p-3.5 gap-4">
          <div className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 px-1">
            Data & Assets
          </div>
          ${dockBlock}
          ${chipsBlock}
          ${csvTableBlock}
        </aside>

        {/* CENTER STAGE: Canvas Viewport */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-hidden relative">
          {/* Top Control Bar: Zoom, Snap, Guides */}
          <div className="shrink-0 border-b border-slate-800/80 bg-slate-900/30 px-3 py-1.5 flex items-center justify-between z-10">
            ${shelf1Block}
          </div>

          {/* Centered Scrollable Canvas Artboard */}
          <div 
            className="flex-1 overflow-auto flex items-center justify-center p-8 relative bg-slate-950/80"
            onScroll={() => fabricCanvasRef.current?.calcOffset()}
          >
            ${canvasStageBlock}
          </div>
        </main>

        {/* RIGHT INSPECTOR: Contextual Properties & Export (w-80) */}
        <aside className="w-80 shrink-0 border-l border-slate-800/80 bg-slate-900/40 flex flex-col justify-between overflow-y-auto p-3.5 gap-4">
          <div className="flex flex-col gap-4">
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 px-1">
              Properties
            </div>
            ${shelf2InspectorBlock}
          </div>
        </aside>
      </div>

      {/* 3. MODALS & OVERLAYS */}
      ${modalsAndFooter}
`;

fs.writeFileSync(filePath, `${preReturn}\n${newReturnJSX}`, 'utf8');
console.log('Successfully updated closing tag and re-migrated page.tsx.');
