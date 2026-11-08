# Manual inspection and panel calibration

Use the existing PDF tooling if it already supplies readable text and page images. The bundled Node helper is a fallback for extracting text, rendering selected pages, and finding clean embedded artwork. It never modifies the source PDF and does not provide OCR.

## Inspect the reference

1. Confirm the exact model/variant on the title page and panel. A product-family manual may describe controls missing from the owner's unit.
2. Extract searchable text for terminology, menus, ranges/defaults, modes, and operation sequences.
3. Render the front-panel diagram, status-light tables, screen layouts, and relevant menu pages. A text-only extraction can leave these completely blank.
4. Search for discrepancies between the image, operating sections, and tables. Record printed and PDF page numbers separately; do not assume the offset is always one.
5. For artwork, inspect the cover and other pages before using an annotated diagram. Extracted images can contain only part of a panel, an entire product photo, a logo, or a tile; view them before deciding what to use.

A scanned/manual-without-text needs OCR or direct visual inspection using tools available in the environment. An empty `manual.txt` page is not evidence that the page has no useful content. Document-image colours, masks, or unsupported embedded-image encodings may need a rendered-page fallback.

## Bundled PDF helper

Install PDF dependencies in a scratch tooling directory, not the simulator's runtime dependencies. Use a Node version supported by the installed PDF.js package. Resolve the skill directory from the actual installed skill location; the following is the default Windows example:

```powershell
$simSkill = Join-Path $env:USERPROFILE '.codex\skills\hardware-simulator'
$simPdfTools = Join-Path $env:TEMP 'hardware-simulator-pdf-tools'
npm.cmd install --prefix $simPdfTools pdfjs-dist @napi-rs/canvas --no-audit --no-fund

node (Join-Path $simSkill 'scripts\pdf-reference.mjs') `
  --pdf 'C:\reference\device-manual.pdf' `
  --out '.\scratch\manual' --pages '1,9-10' --images --deps $simPdfTools
```

Adapt the input and output paths to the current device. On macOS/Linux use `npm` and corresponding paths. The helper can also resolve dependencies from the current project when `--deps` is omitted, but avoid adding extraction-only packages to the app just for that convenience.

Outputs:

- `manual.txt`: text of every page, labelled with one-based PDF page numbers.
- `page-NNN.png`: rendered selected pages, including annotations and vector labels.
- `page-NNN-image-NN.png`: optional standalone supported raster image objects.
- `manifest.json`: page count, output filenames, image dimensions, and extraction warnings.

Run `--help` for the CLI syntax. Rendering selected pages resolves the image objects before extraction. The helper exports common RGB/RGBA/monochrome images; it does not reconstruct every PDF mask/tile combination. If extraction warns, inspect the rendered page and choose another available extraction tool rather than treating an incomplete image as accurate panel artwork.

## Prepare the physical surface

Choose the cleanest faithful source. Preserve its proportions and labels, and crop empty margins consistently if needed. Do not use generated art to guess unreadable physical labels. If an artwork tool is needed, use the supported tool and verify the result against the reference; choose drawn CSS/SVG for a code-native replica when that better preserves the device geometry.

Inspect the final asset before mapping controls. In the Mixer Plus case, the diagram page was annotated but the cover contained a clean image; the resulting cropped console was 730 by 421 pixels. That size is not a default for a new device.

Convert measured pixel rectangles using:

```text
xPercent = 100 * left / imageWidth
yPercent = 100 * top / imageHeight
wPercent = 100 * width / imageWidth
hPercent = 100 * height / imageHeight
```

Store coordinates for screens, buttons, knobs, faders/joysticks where present, and LEDs. Use a single image container as the coordinate system. Do not calibrate on one crop and render another, or position the overlays relative to the viewport.

Cover photographed screen content completely. Cover baked-in active LEDs with an off-state surface before drawing their live colour. A selected mode marker and an enabled-function LED are different pieces of feedback if the device distinguishes them.

Use a development outline overlay and test at two container sizes. Check edge controls, repeated numbered rows, circular knob hit areas, and centre presses. Let small screens scroll/zoom the console uniformly rather than changing the learned physical layout.
