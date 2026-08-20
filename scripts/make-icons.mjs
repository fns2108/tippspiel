import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync("app/icon.svg", "utf8");
const browser = await chromium.launch();

// badge is monochrome-masked by the OS: draw it as a white glyph on transparent.
const badgeSvg = svg
  .replace('fill="#111112"', 'fill="none"')
  .replace('stroke="#FBFBFA"', 'stroke="#FFFFFF"');

const targets = [
  { file: "public/icon-192.png", size: 192, src: svg },
  { file: "public/icon-512.png", size: 512, src: svg },
  { file: "public/apple-icon.png", size: 180, src: svg },
  { file: "public/badge-72.png", size: 72, src: badgeSvg },
];

for (const { file, size, src } of targets) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<html><body style="margin:0"><div style="width:${size}px;height:${size}px">${src.replace(
      "<svg ",
      `<svg width="${size}" height="${size}" `,
    )}</div></body></html>`,
  );
  const buf = await page.screenshot({ omitBackground: true });
  writeFileSync(file, buf);
  await page.close();
  console.log(`${file} (${size}px)`);
}

await browser.close();
