const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/page.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// Identify start of Row 2 Floating Studio Toolbar comment
const startMarker = '{/* Row 2 Floating Studio Toolbar: Alignment, Typography, and Image Mask */}';
const endMarker = '{/* 3. MODALS & OVERLAYS */}';

const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Failed to locate inspector boundaries');
  process.exit(1);
}

// Locate the closing of the inspector aside right before modals
const asideClosingIdx = code.lastIndexOf('</aside>', endIdx);
if (asideClosingIdx === -1 || asideClosingIdx < startIdx) {
  console.error('Failed to locate aside closing tag');
  process.exit(1);
}

const beforeInspector = code.substring(0, startIdx);
const afterInspector = code.substring(asideClosingIdx);

const replacement = `{/* Structured Vertical Inspector Cards */}
            <div className="flex flex-col gap-3.5">
              
              {/* CARD 1: ARTBOARD ALIGNMENT */}
              <div className={\`p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-2 transition-all duration-150 \${hasSelection ? 'opacity-100 ring-1 ring-cyan-500/40' : 'opacity-35 pointer-events-none select-none'}\`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Artboard Align</span>
                  {!hasSelection && <span className="text-[9px] text-slate-500 font-medium">No selection</span>}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => alignSelectedToArtboard('left')}
                    className="py-1 px-1.5 text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg cursor-pointer text-center"
                    title="Align Left"
                  >
                    ⇤ Left
                  </button>
                  <button
                    type="button"
                    onClick={() => alignSelectedToArtboard('centerH')}
                    className="py-1 px-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/60 rounded-lg cursor-pointer text-center"
                    title="Center Horizontally"
                  >
                    ⇥ Center ⇤
                  </button>
                  <button
                    type="button"
                    onClick={() => alignSelectedToArtboard('right')}
                    className="py-1 px-1.5 text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg cursor-pointer text-center"
                    title="Align Right"
                  >
                    Right ⇥
                  </button>
                  <button
                    type="button"
                    onClick={() => alignSelectedToArtboard('top')}
                    className="py-1 px-1.5 text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg cursor-pointer text-center"
                    title="Align Top"
                  >
                    ⤊ Top
                  </button>
                  <button
                    type="button"
                    onClick={() => alignSelectedToArtboard('centerV')}
                    className="py-1 px-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/60 rounded-lg cursor-pointer text-center"
                    title="Center Vertically"
                  >
                    Center V
                  </button>
                  <button
                    type="button"
                    onClick={() => alignSelectedToArtboard('bottom')}
                    className="py-1 px-1.5 text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg cursor-pointer text-center"
                    title="Align Bottom"
                  >
                    ⤋ Bottom
                  </button>
                </div>
              </div>

              {/* CARD 2: BARCODE & QR CODE PROPERTIES */}
              <div className={\`p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-2.5 transition-all duration-150 \${selectedBarcode ? 'opacity-100 ring-1 ring-cyan-500/40' : 'opacity-35 pointer-events-none select-none'}\`}>
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
              <div className={\`p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-2.5 transition-all duration-150 \${selectedTag ? 'opacity-100 ring-1 ring-cyan-500/40' : 'opacity-35 pointer-events-none select-none'}\`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Typography & Style</span>
                  {!selectedTag && <span className="text-[9px] text-slate-500 font-medium">Select a text field</span>}
                </div>

                {/* Font Selector & Upload */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400">Font Family:</span>
                    <label
                      className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                      title="Upload custom .ttf or .otf file"
                    >
                      + Custom Font
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

                {/* Size, Color & Formatting */}
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
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => handleColorChange(e.target.value)}
                        className="w-full h-[29px] p-0.5 border border-slate-800 rounded-lg bg-slate-950 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Alignment & Style Buttons */}
                <div className="flex items-center justify-between gap-1 pt-1">
                  <div className="flex items-center border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                    <button
                      type="button"
                      onClick={() => handleAlignChange('left')}
                      className={\`px-2.5 py-1 text-xs font-semibold \${
                        textAlign === 'left' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                      }\`}
                      title="Align Left"
                    >
                      L
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAlignChange('center')}
                      className={\`px-2.5 py-1 text-xs font-semibold border-x border-slate-800 \${
                        textAlign === 'center' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                      }\`}
                      title="Align Center"
                    >
                      C
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAlignChange('right')}
                      className={\`px-2.5 py-1 text-xs font-semibold \${
                        textAlign === 'right' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                      }\`}
                      title="Align Right"
                    >
                      R
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleBoldToggle}
                      className={\`px-2.5 py-1 text-xs font-bold rounded-lg border transition \${
                        isBold ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white'
                      }\`}
                      title="Bold"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={handleItalicToggle}
                      className={\`px-2.5 py-1 text-xs italic font-serif font-bold rounded-lg border transition \${
                        isItalic ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white'
                      }\`}
                      title="Italic"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={handleUppercaseToggle}
                      className={\`px-2 py-1 text-xs font-black tracking-tight rounded-lg border transition \${
                        isUppercase ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white'
                      }\`}
                      title="Uppercase"
                    >
                      TT
                    </button>
                  </div>
                </div>

                {/* Conditional Rules CTA */}
                <button
                  type="button"
                  onClick={() => setShowRulesModal(true)}
                  className={\`w-full mt-1 py-1.5 px-3 text-xs font-bold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1.5 \${
                    currentTagRules.length > 0
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60 hover:bg-indigo-900/60'
                  }\`}
                >
                  <span>⚡</span> Conditional Rules ({currentTagRules.length})
                </button>
              </div>

              {/* CARD 4: IMAGE CROP & MASK */}
              <div className={\`p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col gap-2 transition-all duration-150 \${selectedImage ? 'opacity-100 ring-1 ring-cyan-500/40' : 'opacity-35 pointer-events-none select-none'}\`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Image Shape Mask</span>
                  {!selectedImage && <span className="text-[9px] text-slate-500 font-medium">Select an image</span>}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyImageMask('circle')}
                    className={\`py-1 px-2 text-xs font-bold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1.5 \${
                      selectedImageMask === 'circle'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                    }\`}
                  >
                    ◯ Circle
                  </button>
                  <button
                    type="button"
                    onClick={() => applyImageMask('rounded')}
                    className={\`py-1 px-2 text-xs font-bold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1.5 \${
                      selectedImageMask === 'rounded'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                    }\`}
                  >
                    ▢ Rounded
                  </button>
                  <button
                    type="button"
                    onClick={() => applyImageMask('square')}
                    className={\`py-1 px-2 text-xs font-bold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1.5 \${
                      selectedImageMask === 'square'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                    }\`}
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
          </div>
        `;

const finalCode = beforeInspector + replacement + afterInspector;
fs.writeFileSync(filePath, finalCode, 'utf8');
console.log('Successfully refactored inspector into clean vertical cards.');
