#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const usage = `Inspect a device manual without changing the source PDF.

node pdf-reference.mjs --pdf manual.pdf --out scratch/manual --pages 1,9-10 [--images] [--deps tooling-directory]

Writes manual.txt, selected page PNGs, manifest.json, and optional embedded image PNGs.
Page numbers are one-based PDF viewer numbers, not printed page labels.
Dependencies: pdfjs-dist and @napi-rs/canvas, installed in --deps or the current project.
Use --help to show this message. This helper does not crop images or perform OCR.
`;

function parseArgs(argv) {
  const options = { images: false, pages: '1' };
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (key === '--help' || key === '-h') return { help: true };
    if (key === '--images') { options.images = true; continue; }
    if (!['--pdf', '--out', '--pages', '--deps'].includes(key)) throw new Error(`Unknown option: ${key}`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    options[key.slice(2)] = value;
  }
  if (!options.pdf || !options.out) throw new Error('Both --pdf and --out are required.');
  return options;
}

function pageNumbers(value, count) {
  const numbers = new Set();
  for (const segment of value.split(',')) {
    if (!/^\d+(?:-\d+)?$/.test(segment)) throw new Error(`Invalid page selection: ${segment}`);
    const [first, last = first] = segment.split('-').map(Number);
    if (first < 1 || last > count || last < first) throw new Error(`Pages must be between 1 and ${count}: ${segment}`);
    for (let page = first; page <= last; page++) numbers.add(page);
  }
  return [...numbers].sort((a, b) => a - b);
}

/** Expand PDF.js RGB, RGBA, or packed monochrome image data into a standalone canvas. */
function imageCanvas(image, canvasLibrary, imageKinds) {
  if (!image?.width || !image?.height) throw new Error('Image dimensions unavailable.');
  const output = canvasLibrary.createCanvas(image.width, image.height);
  const context = output.getContext('2d');
  if (image.bitmap) { context.drawImage(image.bitmap, 0, 0); return output; }
  if (!image.data) throw new Error('Image data unavailable; inspect the rendered page instead.');
  const pixels = new Uint8ClampedArray(image.width * image.height * 4);
  const data = image.data;
  for (let index = 0; index < image.width * image.height; index++) {
    const target = index * 4;
    if (image.kind === imageKinds.RGBA_32BPP) pixels.set(data.subarray(target, target + 4), target);
    else if (image.kind === imageKinds.RGB_24BPP) {
      pixels[target] = data[index * 3]; pixels[target + 1] = data[index * 3 + 1]; pixels[target + 2] = data[index * 3 + 2]; pixels[target + 3] = 255;
    } else if (image.kind === imageKinds.GRAYSCALE_1BPP) {
      const x = index % image.width, y = Math.floor(index / image.width);
      const byte = data[y * Math.ceil(image.width / 8) + Math.floor(x / 8)];
      const value = byte & (128 >> (x % 8)) ? 255 : 0;
      pixels[target] = value; pixels[target + 1] = value; pixels[target + 2] = value; pixels[target + 3] = 255;
    } else throw new Error(`Unsupported image kind ${image.kind}; inspect the rendered page instead.`);
  }
  context.putImageData(new canvasLibrary.ImageData(pixels, image.width, image.height), 0, 0);
  return output;
}

/** Extract searchable text, render selected pages, and optionally export image objects after rendering resolves them. */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write(usage); return; }
  const input = path.resolve(args.pdf), out = path.resolve(args.out);
  const dependencyRoot = path.resolve(args.deps ?? process.cwd());
  const requireDependency = createRequire(path.join(dependencyRoot, 'package.json'));
  let canvasLibrary, pdfjsEntry;
  try {
    canvasLibrary = requireDependency('@napi-rs/canvas');
    pdfjsEntry = requireDependency.resolve('pdfjs-dist/legacy/build/pdf.mjs');
  } catch {
    throw new Error('PDF dependencies were not found. Install pdfjs-dist and @napi-rs/canvas with npm --prefix TOOL_DIR, then pass --deps TOOL_DIR.');
  }
  // PDF.js can use these web primitives while running in Node.
  for (const key of ['DOMMatrix', 'ImageData', 'Path2D']) if (!globalThis[key] && canvasLibrary[key]) globalThis[key] = canvasLibrary[key];
  const pdfjs = await import(pathToFileURL(pdfjsEntry).href);
  const pdfRoot = path.dirname(requireDependency.resolve('pdfjs-dist/package.json'));
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync(input)),
    useSystemFonts: true,
    standardFontDataUrl: path.join(pdfRoot, 'standard_fonts').replaceAll('\\', '/') + '/',
    cMapUrl: path.join(pdfRoot, 'cmaps').replaceAll('\\', '/') + '/',
    cMapPacked: true,
    isImageDecoderSupported: false,
  });
  const pdf = await loadingTask.promise;
  try {
    const selected = pageNumbers(args.pages, pdf.numPages);
    fs.mkdirSync(out, { recursive: true });
    const manifest = { source: path.basename(input), pageCount: pdf.numPages, renderedPages: [], images: [], warnings: [] };
    const text = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number), content = await page.getTextContent();
      text.push(`\n\n--- PDF PAGE ${number} ---\n` + content.items.filter(item => typeof item.str === 'string').map(item => item.str + (item.hasEOL ? '\n' : ' ')).join(''));
    }
    fs.writeFileSync(path.join(out, 'manual.txt'), text.join(''), 'utf8');
    for (const number of selected) {
      const page = await pdf.getPage(number), prefix = `page-${String(number).padStart(3, '0')}`;
      const viewport = page.getViewport({ scale: 1.5 });
      const output = canvasLibrary.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: output.getContext('2d'), viewport }).promise;
      const file = `${prefix}.png`;
      fs.writeFileSync(path.join(out, file), output.toBuffer('image/png'));
      manifest.renderedPages.push({ page: number, file });
      if (!args.images) continue;
      const operators = await page.getOperatorList(), seen = new Set();
      for (let index = 0; index < operators.fnArray.length; index++) {
        const operation = operators.fnArray[index], values = operators.argsArray[index];
        if (![pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject].includes(operation)) continue;
        const name = operation === pdfjs.OPS.paintImageXObject ? values[0] : `inline-${index}`;
        if (seen.has(name)) continue;
        seen.add(name);
        try {
          const image = operation === pdfjs.OPS.paintInlineImageXObject ? values[0] : await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Image object did not resolve; inspect the rendered page instead.')), 5000);
            (String(name).startsWith('g_') ? page.commonObjs : page.objs).get(name, data => { clearTimeout(timeout); resolve(data); });
          });
          const extracted = imageCanvas(image, canvasLibrary, pdfjs.ImageKind);
          const imageFile = `${prefix}-image-${String(seen.size).padStart(2, '0')}.png`;
          fs.writeFileSync(path.join(out, imageFile), extracted.toBuffer('image/png'));
          manifest.images.push({ page: number, file: imageFile, width: image.width, height: image.height, object: name });
        } catch (error) { manifest.warnings.push(`Page ${number}, ${name}: ${error.message}`); }
      }
    }
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    process.stdout.write(JSON.stringify({ out, pageCount: pdf.numPages, renderedPages: selected, extractedImages: manifest.images.length, warnings: manifest.warnings }, null, 2) + '\n');
  } finally { await loadingTask.destroy(); }
}

main().catch(error => { process.stderr.write(`pdf-reference: ${error.message}\n`); process.exitCode = 1; });
