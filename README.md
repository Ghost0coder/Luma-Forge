# LumaForge — Professional Non-Destructive Photo Editor

LumaForge is a high-performance, non-destructive, Lightroom-inspired photo editing web application designed for mobile photographers, enthusiasts, and creative professionals. It provides studio-grade raw precision color science, interactive monotone cubic spline tone curves, an 8-channel HSL color mixer, local gradient and brush masks, local visual saliency subject isolation, and multi-photo batch processing — operating 100% locally in-browser with zero external AI API dependencies.

---

## Key Capabilities

### 1. Non-Destructive Photographic Pipeline
- **Original Asset Preservation**: Your source image remains completely untouched. The canvas is rendered in real time through an ordered adjustment stack.
- **Full-Resolution Export**: Previews are rendered efficiently for 60fps interactivity, while final exports process the 100% full-resolution image without intermediate compression artifacts.
- **Complete Undo/Redo & Edit History**: Step back or forward through any point in time with the interactive visual history stack.

### 2. Light & Exposure Control
- Exposure compensation (-5.0 to +5.0 EV)
- Highlights recovery & Shadows lift with soft-knee tonality
- Whites expansion & Blacks threshold pinning
- Contrast & Brightness
- White Balance (Kelvin color temperature & tint correction)

### 3. Precision Color & Tone Curves
- **Monotone Cubic Spline RGB Tone Curves**: Master RGB, plus independent Red, Green, and Blue channel curves with interactive control points.
- **8-Channel HSL Color Mixer**: Isolate and tune Hue, Saturation, and Luminance across Red, Orange, Yellow, Green, Aqua, Blue, Purple, and Magenta.
- **Color Grading & Split Toning**: Independent 3-way color wheels for shadows, midtones, and highlights with balance control.
- **Vibrance & Saturation**: Smart vibrance algorithm that boosts muted colors while preventing skin tone over-saturation.

### 4. Detail, Effects & Geometry
- High-frequency unsharp masking sharpening
- Clarity & Dehaze edge contrast boosting
- Film Grain simulation with customizable grain size and intensity
- Radial Vignette shading with midpoint and feather controls
- Crop overlay with Rule-of-Thirds grid lines and aspect ratio presets (Original, 1:1, 4:3, 16:9, 3:2, Free)
- Step rotation (90° / -90°), fine straightening (-45° to +45°), and horizontal/vertical flips.

### 5. Local Adjustment Masks
- **Radial Gradient Masks**: Elliptical vignette and subject spotlighting.
- **Linear Gradient Masks**: Sky darkening and ground balance.
- **Brush Masks**: Freeform painting directly onto the image canvas.
- **Visual Saliency Subject & Background Masks**: Multi-seed spatial contrast mask generation for instant local adjustments.
- Independent local exposure, contrast, saturation, and temperature adjustments with invert toggle.

### 6. Local Heuristic Analysis & Auto-Enhancement
- **100% Offline Heuristic Auto-Enhance**: Local gray-world color balance and 256-bin luminance histogram dynamic range equalization.
- Operates entirely client-side without external network calls or server latency.

### 7. Presets Engine & Batch Editing
- 8 Curated Built-in Presets: *Cinematic Teal & Orange*, *Editorial Portrait Glow*, *Alpine Vivid Landscape*, *High Contrast Monochrome*, *Golden Hour Glow*, *Analog Kodachrome 1974*, *Moody Twilight Street*, and *Scandinavian Minimal*.
- **Adjustable Preset Strength**: Scale any preset from 0% to 200%.
- Custom preset creation, deletion, and JSON export/import.
- **Batch Processing**: Synchronize adjustment looks across multiple photos and batch export with bounded concurrency to protect device memory.

### 8. Privacy & Storage
- **100% Client-Side Processing**: Your photos are processed directly in your browser using Canvas 2D and typed array pixel pipelines.
- **IndexedDB Persistence**: Saved projects and custom presets stay stored safely in your browser.
- **Installable PWA**: Works offline, installable to Android home screen or desktop.

---

## Technical Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Motion.
- **Backend / Deployment**: Node.js, Express, tsx.
- **Color Engine**: Monotone cubic spline interpolation (Fritsch-Carlson), Rec.709 luminance weighting, sRGB/HSL bi-directional conversions.
- **Storage**: IndexedDB (`LumaForgeDB`).

---

## Quickstart & Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 3. Run Automated Test Suite
```bash
npm test
```

### 4. Production Build
```bash
npm run build
npm start
```
