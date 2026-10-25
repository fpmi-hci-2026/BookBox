#!/usr/bin/env node
/**
 * Лист пиктограмм BookBox для п. 6.2.4 (система меток).
 * Выход: docs/images/lab2/icons.svg (PNG рендерится scripts/diagrams/render.sh).
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../docs/images/lab2");

const ICONS = [
  {
    name: "Поиск",
    svg: `<circle cx="19" cy="18" r="9"/><path d="M26 25 L34 33"/>`,
  },
  {
    name: "Корзина",
    svg: `<path d="M8 12 h24 l-3 17 h-18 z"/><path d="M15 12 a5 5 0 0 1 10 0"/><circle cx="15" cy="34" r="1.6"/><circle cx="25" cy="34" r="1.6"/>`,
  },
  {
    name: "Избранное",
    svg: `<path d="M20 34 C6 24 8 10 20 16 C32 10 34 24 20 34 Z"/>`,
  },
  {
    name: "Профиль",
    svg: `<circle cx="20" cy="14" r="6"/><path d="M8 34 c0-7 5-10 12-10 s12 3 12 10"/>`,
  },
  {
    name: "Каталог",
    svg: `<rect x="8" y="8" width="10" height="10" rx="1.5"/><rect x="22" y="8" width="10" height="10" rx="1.5"/><rect x="8" y="22" width="10" height="10" rx="1.5"/><rect x="22" y="22" width="10" height="10" rx="1.5"/>`,
  },
  {
    name: "Фильтры",
    svg: `<path d="M6 12 h28 M6 20 h28 M6 28 h28"/><circle cx="26" cy="12" r="2.6"/><circle cx="14" cy="20" r="2.6"/><circle cx="22" cy="28" r="2.6"/>`,
  },
  {
    name: "Сортировка",
    svg: `<path d="M14 32 V8 M10 12 L14 8 L18 12"/><path d="M26 8 V32 M22 28 L26 32 L30 28"/>`,
  },
  {
    name: "Рейтинг",
    svg: `<path d="M20 6 L24 16 L35 16 L26 23 L29 34 L20 27 L11 34 L14 23 L5 16 L16 16 Z"/>`,
  },
  {
    name: "Доставка",
    svg: `<rect x="5" y="12" width="18" height="13" rx="1.5"/><path d="M23 17 h6 l4 6 v2 h-10 z"/><circle cx="12" cy="30" r="2.6"/><circle cx="28" cy="30" r="2.6"/>`,
  },
  {
    name: "В наличии",
    svg: `<circle cx="20" cy="20" r="13"/><path d="M13 20 L18 25 L27 15"/>`,
  },
  {
    name: "Закрыть",
    svg: `<path d="M12 12 L28 28 M28 12 L12 28"/>`,
  },
  {
    name: "Сканер ISBN",
    svg: `<path d="M8 14 V8 h6 M26 8 h6 v6 M34 26 v6 h-6 M14 32 H8 v-6"/><path d="M6 20 h28"/>`,
  },
  {
    name: "Голос",
    svg: `<rect x="16" y="6" width="8" height="16" rx="4"/><path d="M11 20 a9 9 0 0 0 18 0"/><path d="M20 29 v5"/>`,
  },
  {
    name: "Уведомления",
    svg: `<path d="M11 27 h18 v-5 c0-5-3-8-9-8 s-9 3-9 8 z"/><path d="M17 30 a3 3 0 0 0 6 0"/>`,
  },
  {
    name: "Наверх",
    svg: `<path d="M20 32 V8 M12 16 L20 8 L28 16"/>`,
  },
];

const COLS = 5;
const CELL_W = 150;
const CELL_H = 118;
const PAD = 30;
const TITLE_H = 56;

const rows = Math.ceil(ICONS.length / COLS);
const width = PAD * 2 + COLS * CELL_W;
const height = TITLE_H + rows * CELL_H + PAD;

const parts = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  `<rect width="${width}" height="${height}" fill="#FFFFFF"/>`,
  `<text x="${PAD}" y="34" font-family="Helvetica, Arial, sans-serif" font-size="17" font-weight="700" fill="#1F2937">Пиктограммы BookBox: набор 24×24, линейный стиль, 1 цвет + акцент</text>`,
];

ICONS.forEach((icon, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const x = PAD + col * CELL_W;
  const y = TITLE_H + row * CELL_H;

  parts.push(`<g transform="translate(${x + CELL_W / 2 - 20}, ${y + 14})" stroke="#2F5D62" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">`);
  parts.push(icon.svg);
  parts.push(`</g>`);
  parts.push(
    `<text x="${x + CELL_W / 2}" y="${y + 82}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#374151">${icon.name}</text>`
  );
  parts.push(
    `<text x="${x + CELL_W / 2}" y="${y + 98}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="9.5" fill="#8A8F98">24 × 24</text>`
  );
});

parts.push(`</svg>`);

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "icons.svg"), parts.join("\n"));
console.log(`icons: ${width}×${height}, ${ICONS.length} пиктограмм`);
