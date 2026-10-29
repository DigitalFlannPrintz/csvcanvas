const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/page.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Fix premature listener closure around line 1613
code = code.replace(
  `c.on('mouse:down', onCanvasMouseDown);
        c.on('mouse:move', onCanvasMouseMove);
        c.on('mouse:up', onCanvasMouseUp);


      }
    });`,
  `c.on('mouse:down', onCanvasMouseDown);
        c.on('mouse:move', onCanvasMouseMove);
        c.on('mouse:up', onCanvasMouseUp);`
);

// Fallback in case of subtle spacing differences around line 1613
code = code.replace(
  /c\.on\('mouse:up',\s*onCanvasMouseUp\);\s*\}\s*\}\);/g,
  "c.on('mouse:up', onCanvasMouseUp);"
);

// 2. Fix the extra closing brace in onMouseDown around line 2746
const brokenOnMouseDown = `panStartRef.current = {
                    x: e.clientX,
                    y: e.clientY,
                    startPanX: panOffsetRef.current.x,
                    startPanY: panOffsetRef.current.y,
                    scrollLeft: panOffsetRef.current.x,
                    scrollTop: panOffsetRef.current.y,
                  };
                }
                }
              }}`;

const cleanOnMouseDown = `panStartRef.current = {
                    x: e.clientX,
                    y: e.clientY,
                    startPanX: panOffsetRef.current.x,
                    startPanY: panOffsetRef.current.y,
                    scrollLeft: panOffsetRef.current.x,
                    scrollTop: panOffsetRef.current.y,
                  };
                }
              }}`;

if (code.includes(brokenOnMouseDown)) {
  code = code.replace(brokenOnMouseDown, cleanOnMouseDown);
} else {
  // Regex pattern matching double closing braces before }}
  code = code.replace(
    /(scrollTop:\s*panOffsetRef\.current\.y,\s*\}\s*;\s*\})\s*\}\s*\}\}/g,
    "$1\n              }}"
  );
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Fixed bracket mismatch and premature closure.');
