# VIGIA Studio
### Geospatial Intelligence IDE

A production-grade VS Code–inspired geospatial intelligence interface.

---

## ⚡ Quick Start

```bash
# 1. Create project folder and enter it
mkdir vigia-studio && cd vigia-studio

# 2. Copy all project files here (see folder structure below)

# 3. Install dependencies
npm install

# 4. Start development server
npm run dev

# 5. Open in browser
open http://localhost:3000
```

---

## 📁 Folder Structure

```
vigia-studio/
├── app/
│   ├── globals.css          ← Global styles, fonts, MapLibre overrides
│   ├── layout.tsx           ← Root HTML layout
│   └── page.tsx             ← Entry point
│
├── components/
│   ├── Layout.tsx           ← Root orchestrator, wires all panels
│   ├── TopBar.tsx           ← Menu bar + system status indicators
│   ├── Sidebar.tsx          ← Geo Explorer with city tree + activity bar
│   ├── TabBar.tsx           ← VS Code tabs with right-click context menu
│   ├── SplitView.tsx        ← Dual-pane split workspace container
│   ├── MapPane.tsx          ← Single map workspace pane
│   ├── MapLibreMap.tsx      ← MapLibre GL JS map (dynamic import, SSR-safe)
│   ├── RoutePanel.tsx       ← Route form + ETA/risk results display
│   ├── Terminal.tsx         ← Bottom terminal panel with live logs
│   └── StatusBar.tsx        ← VS Code–style bottom status bar
│
├── hooks/
│   ├── useTabs.ts           ← Tab lifecycle + split pane state
│   ├── useTerminal.ts       ← Live log simulation with interval
│   └── useResize.ts         ← Drag-to-resize vertical panel hook
│
├── types/
│   ├── index.ts             ← All TypeScript interfaces
│   └── maplibre.d.ts        ← MapLibre GL type declarations
│
├── lib/
│   └── mockData.ts          ← Cities, log templates, route generators
│
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
└── package.json
```

---

## 🎮 Usage

### Opening a City
Click any city in the **Geo Explorer** sidebar (left panel). It opens as a tab in the left pane.

### Split View
Right-click any tab → **"Split Right"** to open a second independent map pane.  
Each pane has its own tab stack and route state. Close the right pane with the × in its top-right corner.

### Route Calculation
In any open map pane, fill in the **FROM** and **TO** fields in the toolbar and click **Calculate Route**.  
After ~1 second, two routes appear on the map:
- **Blue solid** = Fastest route
- **Green dashed** = Safest route  
An ETA + Risk Score panel appears below the inputs.

### Terminal
The bottom terminal auto-streams live Hazard, Swarm, Ledger, and System logs.  
- Click tabs to filter by category  
- Drag the handle at the top to resize  
- Pause/Resume or Clear with the toolbar buttons

---

## 🏗 Architecture Notes

- **No global state manager** — all state lives in custom hooks (`useTabs`, `useTerminal`)
- **MapLibre loaded with `dynamic(..., { ssr: false })`** — prevents SSR crash since MapLibre uses browser APIs
- **Split pane** is purely React state — `rightPane: PaneState | null`; no external library needed
- **Terminal** uses `setInterval` inside `useEffect` with proper cleanup — no memory leaks
- **Resize** uses raw `mousemove`/`mouseup` on `window` via a dedicated hook
- **Context menu** is DOM-driven (ref + style toggling) to avoid re-render costs on every mouse move

---

## 🎨 Design System

| Token | Value |
|---|---|
| Background | `#0E1117` |
| Sidebar | `#161B22` |
| Panel | `#1F242D` |
| Border | `rgba(255,255,255,0.08)` |
| Accent Blue | `#2563EB` / `#3B82F6` |
| Success | `#10B981` |
| Hazard | `#EF4444` |
| Warning | `#F59E0B` |
| UI Font | Inter |
| Mono Font | JetBrains Mono |
| Border Radius | max 4–6px |
| No gradients, no heavy shadows, no rounded cards |
