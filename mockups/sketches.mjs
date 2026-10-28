#!/usr/bin/env node
/**
 * Эскизы BookBox: быстрые наброски «от руки» в SVG.
 * Выход: mockups/sketches/*.svg, PNG рендерится mockups/render.mjs.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "sketches");
mkdirSync(OUT, { recursive: true });

const STROKE = "#6b7280";
const TEXT = "#4b5563";
const FONT = "'Bradley Hand', 'Comic Sans MS', 'Segoe Print', cursive";

let seed = 7;
function rnd() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}

function rect(x, y, w, h, label, opts = {}) {
  const rot = (rnd() - 0.5) * 1.2;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const fs = opts.fs || 13;
  const fill = opts.fill || "none";
  const dash = opts.dash ? ` stroke-dasharray="6 5"` : "";
  const lines = String(label || "").split("\n");
  const text = lines
    .map((l, i) => {
      const ty = cy + (i - (lines.length - 1) / 2) * (fs + 4) + fs * 0.35;
      return `<text x="${cx}" y="${ty}" text-anchor="middle" font-family="${FONT}" font-size="${fs}" fill="${TEXT}">${l
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")}</text>`;
    })
    .join("");
  return `<g transform="rotate(${rot.toFixed(2)} ${cx} ${cy})">
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${opts.rx || 6}" fill="${fill}" stroke="${STROKE}" stroke-width="${opts.sw || 2}"${dash}/>
  ${text}
</g>`;
}

function line(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${STROKE}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
}

function svg(title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700" viewBox="0 0 1000 700">
<rect width="1000" height="700" fill="#ffffff"/>
<text x="42" y="46" font-family="${FONT}" font-size="26" fill="#1f2937">${title}</text>
${body}
</svg>`;
}

/* 1. Главная */
const index = svg(
  "Эскиз 1. Главная",
  [
    rect(40, 70, 920, 56, "шапка: логотип · меню · поиск · корзина · профиль"),
    rect(40, 150, 520, 210, "баннер: заголовок + кнопка", { fs: 15 }),
    rect(590, 150, 110, 210, "обложка", { dash: true }),
    rect(710, 150, 110, 210, "обложка", { dash: true }),
    rect(830, 150, 130, 210, "обложка", { dash: true }),
    rect(40, 390, 920, 34, "Подборки — 3 плитки"),
    rect(40, 440, 290, 120, "плитка"),
    rect(355, 440, 290, 120, "плитка"),
    rect(670, 440, 290, 120, "плитка"),
    rect(40, 580, 920, 34, "Новинки — 4 карточки"),
    rect(40, 630, 210, 44, "карточка"),
    rect(270, 630, 210, 44, "карточка"),
    rect(500, 630, 210, 44, "карточка"),
    rect(730, 630, 230, 44, "карточка"),
  ].join("\n")
);

/* 2. Каталог */
const catalog = svg(
  "Эскиз 2. Каталог",
  [
    rect(40, 70, 920, 48, "шапка"),
    rect(40, 128, 920, 26, "крошки"),
    rect(40, 170, 220, 420, "фильтры:\nраздел · жанр\nцена · автор", { fs: 14 }),
    rect(280, 170, 680, 34, "чипы фильтров + сортировка"),
    rect(280, 214, 210, 260, "книга", { dash: true }),
    rect(500, 214, 210, 260, "книга", { dash: true }),
    rect(720, 214, 210, 260, "книга", { dash: true }),
    rect(280, 490, 210, 260, "книга", { dash: true }),
    rect(500, 490, 210, 260, "книга", { dash: true }),
    rect(720, 490, 210, 260, "книга", { dash: true }),
    rect(280, 620, 680, 34, "пагинация"),
  ].join("\n")
);

/* 3. Книга */
const book = svg(
  "Эскиз 3. Страница книги",
  [
    rect(40, 70, 920, 48, "шапка"),
    rect(40, 128, 920, 26, "крошки"),
    rect(40, 170, 330, 420, "обложка 3:4", { dash: true, fs: 16 }),
    rect(400, 170, 560, 40, "название"),
    rect(400, 220, 360, 26, "автор · издательство"),
    rect(400, 258, 240, 24, "★ 4.9 · 128 отзывов"),
    rect(400, 300, 560, 76, "цена · наличие · «В корзину» / «Купить сейчас»"),
    rect(400, 390, 560, 34, "вкладки: описание · характеристики · отзывы"),
    rect(400, 436, 560, 150, "текст описания"),
    rect(40, 610, 920, 34, "похожие книги"),
    rect(40, 650, 210, 40, "книга"),
    rect(270, 650, 210, 40, "книга"),
    rect(500, 650, 210, 40, "книга"),
    rect(730, 650, 230, 40, "книга"),
  ].join("\n")
);

/* 4. Корзина */
const cart = svg(
  "Эскиз 4. Корзина",
  [
    rect(40, 70, 920, 48, "шапка"),
    rect(40, 140, 300, 34, "Корзина · 3 книги"),
    rect(40, 190, 620, 110, "позиция: обложка · название · количество · цена"),
    rect(40, 310, 620, 110, "позиция"),
    rect(40, 430, 620, 110, "позиция"),
    rect(680, 190, 280, 350, "итог:\nтовары\nскидка\nдоставка\nпромокод\n«Оформить заказ»", { fs: 14 }),
  ].join("\n")
);

/* 5. Checkout */
const checkout = svg(
  "Эскиз 5. Оформление заказа",
  [
    rect(40, 70, 920, 48, "шапка (упрощённая)"),
    rect(40, 140, 620, 40, "степпер: 1 адрес → 2 доставка → 3 оплата → 4 подтверждение"),
    rect(40, 200, 620, 180, "форма адреса: имя · телефон · город · улица · дом"),
    rect(40, 395, 620, 100, "доставка: курьер / самовывоз / почта"),
    rect(40, 510, 620, 100, "оплата: карта / ЕРИП / при получении"),
    rect(680, 200, 280, 410, "итог заказа:\n2 книги\nдоставка\nитого\n«Перейти к оплате»", { fs: 14 }),
  ].join("\n")
);

for (const [name, content] of Object.entries({ index, catalog, book, cart, checkout })) {
  writeFileSync(join(OUT, `${name}.svg`), content);
  console.log(`sketch: ${name}.svg`);
}
