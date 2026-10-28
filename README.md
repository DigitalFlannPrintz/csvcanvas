# CSVCanvas

**Studio-grade, client-side Variable Data Printing (VDP) workstation.**

CSVCanvas turns static multi-page PDF templates and tabular CSV datasets into personalized, print-ready documents directly inside your browser. No server uploads, no privacy concerns, and no expensive desktop publishing software required.

---

## Key Features

### 1. 100% Client-Side Architecture & Privacy
* **Local In-Memory Execution:** Document assembly, text interpolation, barcode generation, and font embedding run entirely inside the client environment using Web Workers and HTML5 canvas APIs.
* **Zero Data Ingestion:** Sensitive customer datasets, internal certificates, and private credentials never touch an external backend server.

### 2. Studio Layout & Canvas Workspace
* **Interactive Element Positioning:** Drag, resize, rotate, and align variable text tags and graphic assets across multi-page PDF backgrounds.
* **Precision Layout Tools:** Dynamic pixel rulers, custom horizontal and vertical magnetic guidelines, configurable grid-snapping (10px, 20px, or off), and dot overlays.
* **Keyboard Nudge Controls:** Fine-tune element placement with directional arrow keys (`1px` default, `10px` or snap-step when holding `Shift`).
* **Visual Transform Masking:** Crop static images, photos, and badges into circular avatars, rounded badge corners, or 1:1 squares with transparent alpha channels.

### 3. Dynamic Barcodes & QR Codes
* **Integrated Generator:** Instant vector-rendered 1D linear barcodes (`Code 128`) and 2D matrix codes (`QR Code`) generated on-the-fly from mapped CSV data columns via `bwip-js`.
* **Live Dynamic Preview:** Preview real barcode data per record before triggering batch compilation.

### 4. Conditional Formatting & Rule Engine
* Set up dynamic styling rules per text tag without code:
  * **Supported Operators:** `equals`, `does not equal`, `contains`, `> (numeric)`, `< (numeric)`.
  * **Dynamic Reactions:** Override font color, toggle bold weight, or apply italic formatting automatically based on row values (e.g., highlighting VIP passes, distinctions, or departments).

### 5. Multi-Page Deck & Scope Control
* **Multi-Page Template Support:** Place distinct variable layers independently across any page of a multi-page PDF base template.
* **Selective Batch Exports:**
  * Export all records ($1$ to $N$).
  * Export custom row ranges (e.g., `1-10, 15, 20-25`).
  * Export active search-filtered table subsets.
  * Target specific page numbers within multi-page documents.
* **Layout Presets:** Save and restore complete canvas layouts, rules, and image assets via portable JSON presets.

---

## Tech Stack

| Layer | Library / Tool | Purpose |
| :--- | :--- | :--- |
| **Framework** | [Next.js](https://nextjs.org/) (App Router) | Client application scaffolding and fast edge deployment |
| **Canvas Manipulation** | [Fabric.js](http://fabricjs.com/) | Interactive vector canvas, drag-and-drop, bounding boxes |
| **PDF Processing** | [pdf-lib](https://pdf-lib.js.org/) & [fontkit](https://github.com/foliojs/fontkit) | Client-side PDF page replication, drawing, and TTF/OTF embedding |
| **PDF Previews** | [PDF.js](https://mozilla.github.io/pdf.js/) | Fast background rendering of uploaded PDF documents |
| **Data Parsing** | [PapaParse](https://www.papaparse.com/) | Robust, streaming-compatible CSV parser |
| **Barcode Generation** | [bwip-js](https://github.com/metafloor/bwip-js) | Barcode and QR code rendering directly onto canvas |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | Studio-grade dark theme and responsive interface controls |

---

## Getting Started

### Prerequisites
* Node.js 18.x or higher
* npm, yarn, or pnpm

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/csvcanvas.git
   cd csvcanvas
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   Navigate to [http://localhost:3000](http://localhost:3000).

---

## Workflow Guide

```
[ 1. Upload PDF Template ] ───► [ 2. Upload Dataset CSV ] ───► [ 3. Arrange Tags & Assets ]
                                                                             │
[ 5. Download Print PDF ] ◄─── [ 4. Configure Export Scope ] ◄────────────────┘
```

1. **Upload Background PDF:** Select your single-page or multi-page template (e.g., badge backer, certificate, ticket, shipping label).
2. **Upload Dataset CSV:** Upload your data file. Columns appear immediately as clickable badge pills.
3. **Compose Canvas:** Click any column pill to drop a variable tag (e.g., `{{First_Name}}`) onto the canvas. Add static logos, QR codes, or custom fonts as needed.
4. **Inspect Live Data:** Switch `Live Data: ON` to step through records and verify conditional styling rules in real time.
5. **Export:** Click `Export Print PDF`, select your desired page and record range, and compile the final document.

---

## Deployment to Vercel

Because CSVCanvas is client-side and requires no persistent backend storage or heavy server runtimes, it deploys cleanly to Vercel:

1. Push your code to GitHub, GitLab, or Bitbucket.
2. Log into [Vercel](https://vercel.com/) and click **Add New Project**.
3. Select your repository.
4. Keep all default build settings:
   * **Framework Preset:** Next.js
   * **Build Command:** `next build`
   * **Output Directory:** `.next`
5. Click **Deploy**.

---

## License

MIT License. See [LICENSE](LICENSE) for details.