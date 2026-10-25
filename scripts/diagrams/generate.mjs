#!/usr/bin/env node
/**
 * Генератор схем для лабораторной работы №2 (BookBox).
 *
 * Для каждой схемы создаёт:
 *   - .svg  — векторный исходник (используется для рендера PNG);
 *   - .png  — растровая версия для отчёта (рендерится отдельно через Chrome);
 *   - .drawio — файл в формате draw.io (mxGraph), открывается и редактируется в draw.io.
 *
 * Запуск:  node scripts/diagrams/generate.mjs
 * Рендер:  scripts/diagrams/render.sh
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../docs/images/lab2");

/* ------------------------------------------------------------------ */
/* Палитра                                                             */
/* ------------------------------------------------------------------ */

const C = {
  ink: "#1F2937",
  muted: "#6B7280",
  line: "#B9B3A7",
  white: "#FFFFFF",
  root: { fill: "#2F5D62", stroke: "#24494D", color: "#FFFFFF" },
  catalog: { fill: "#E8F1F2", stroke: "#2F5D62", color: "#1F3E42" },
  book: { fill: "#FDF3E7", stroke: "#B87333", color: "#6B4416" },
  profile: { fill: "#EDF2FB", stroke: "#3B5BA5", color: "#243A6B" },
  help: { fill: "#F5F1F7", stroke: "#7A5C9E", color: "#4A3563" },
  admin: { fill: "#FBEFEF", stroke: "#A44A4A", color: "#6B2C2C" },
  search: { fill: "#EEF7F0", stroke: "#3F7D58", color: "#274F37" },
  aux: { fill: "#F7F6F3", stroke: "#9C968A", color: "#4B5563" },
  accent: { fill: "#F4E3C1", stroke: "#B08D57", color: "#6B4E1F" },
  plain: { fill: "#FFFFFF", stroke: "#C9C2B6", color: "#1F2937" },
};

/* ------------------------------------------------------------------ */
/* Утилиты                                                             */
/* ------------------------------------------------------------------ */

const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Перенос строк по ширине (оценка ширины символа). */
function wrap(text, width, fontSize) {
  const charW = fontSize * 0.56;
  const max = Math.max(6, Math.floor((width - 16) / charW));
  const out = [];
  for (const raw of String(text).split("\n")) {
    const words = raw.split(/\s+/);
    let line = "";
    for (const w of words) {
      const next = line ? line + " " + w : w;
      if (next.length > max && line) {
        out.push(line);
        line = w;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
}

function textHeight(node) {
  const size = node.fontSize || 12;
  const lh = size + 3;
  const label = wrap(node.label || "", node.w, size);
  let h = label.length * lh;
  if (node.desc) h += wrap(node.desc, node.w, size - 1).length * (size + 1) + 4;
  return h;
}

/** Авто-высота узла, если не задана. */
function autoHeight(node) {
  if (node.h) return node.h;
  return Math.max(28, textHeight(node) + 12);
}

/* ------------------------------------------------------------------ */
/* SVG                                                                 */
/* ------------------------------------------------------------------ */

function renderSvg(model) {
  const { width, height, nodes, edges, title } = model;
  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#FFFFFF"/>`
  );
  if (title) {
    parts.push(
      `<text x="40" y="34" font-family="Helvetica, Arial, sans-serif" font-size="17" font-weight="700" fill="#1F2937">${esc(title)}</text>`
    );
  }

  // рёбра под узлами
  for (const e of edges) {
    const pts = e.points;
    if (!pts || pts.length < 2) continue;
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
    const dash = e.dashed ? ` stroke-dasharray="6 5"` : "";
    const marker = e.arrow
      ? ` marker-end="url(#arrow-${(e.color || C.line).slice(1)})"`
      : "";
    const markerStart = e.startArrow
      ? ` marker-start="url(#arrow-${(e.color || C.line).slice(1)})"`
      : "";
    parts.push(
      `<path d="${d}" fill="none" stroke="${e.color || C.line}" stroke-width="${e.width || 1.4}"${dash}${marker}${markerStart}/>`
    );
  }
  // маркеры стрелок
  const colors = [...new Set(edges.filter((e) => e.arrow).map((e) => e.color || C.line))];
  parts.push(`<defs>`);
  for (const c of colors) {
    parts.push(
      `<marker id="arrow-${c.slice(1)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${c}"/></marker>`
    );
  }
  parts.push(`</defs>`);

  // подписи рёбер
  for (const e of edges) {
    if (!e.label || !e.points || e.points.length < 2) continue;
    const [lx, ly] = e.labelAt || midPoint(e.points);
    const fs = e.labelSize || 10.5;
    const lines = String(e.label).split("\n");
    const w = Math.max(...lines.map((l) => l.length)) * fs * 0.55 + 10;
    const h = lines.length * (fs + 2) + 4;
    parts.push(
      `<rect x="${lx - w / 2}" y="${ly - h / 2}" width="${w}" height="${h}" rx="3" fill="#FFFFFF" opacity="0.94"/>`
    );
    lines.forEach((l, i) => {
      parts.push(
        `<text x="${lx}" y="${ly - h / 2 + 4 + i * (fs + 2) + fs * 0.75}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${fs}" fill="${e.labelColor || C.muted}">${esc(l)}</text>`
      );
    });
  }

  // узлы
  for (const n of nodes) {
    const fill = n.fill || C.plain.fill;
    const stroke = n.stroke || C.plain.stroke;
    const color = n.color || C.plain.color;
    const radius = n.square ? 0 : n.radius ?? 7;
    const dash = n.dashed ? ` stroke-dasharray="5 4"` : "";
    parts.push(
      `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${n.strokeWidth || 1.3}"${dash}/>`
    );

    const fs = n.fontSize || 12;
    const lh = fs + 3;
    const labelLines = wrap(n.label || "", n.w, fs);
    const total = textHeight(n);
    const align = n.align || "center";
    const tx = align === "left" ? n.x + 10 : n.x + n.w / 2;
    const anchor = align === "left" ? "start" : "middle";
    let y = n.meta ? n.y + 20 : n.y + (n.h - total) / 2 + fs;
    for (const line of labelLines) {
      parts.push(
        `<text x="${tx}" y="${y}" text-anchor="${anchor}" font-family="Helvetica, Arial, sans-serif" font-size="${fs}" font-weight="${n.bold ? 700 : 400}" fill="${color}">${esc(line)}</text>`
      );
      y += lh;
    }
    if (n.desc && !n.meta) {
      y += 1;
      const dfs = fs - 1;
      for (const line of wrap(n.desc, n.w, dfs)) {
        parts.push(
          `<text x="${tx}" y="${y}" text-anchor="${anchor}" font-family="Helvetica, Arial, sans-serif" font-size="${dfs}" fill="${n.descColor || "#5B6472"}">${esc(line)}</text>`
        );
        y += dfs + 3;
      }
    }
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}

function midPoint(points) {
  const i = Math.floor((points.length - 1) / 2);
  const a = points[i];
  const b = points[i + 1];
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/* ------------------------------------------------------------------ */
/* draw.io (mxGraph)                                                   */
/* ------------------------------------------------------------------ */

function renderDrawio(model, name) {
  const { width, height, nodes, edges } = model;
  const cells = [];
  const ids = new Map();
  nodes.forEach((n, i) => ids.set(n.id, `n${i + 1}`));

  cells.push(`<mxCell id="0"/>`, `<mxCell id="1" parent="0"/>`);

  for (const n of nodes) {
    const style = [
      "rounded=" + (n.square ? "0" : "1"),
      "whiteSpace=wrap",
      "html=1",
      `fillColor=${n.fill || C.plain.fill}`,
      `strokeColor=${n.stroke || C.plain.stroke}`,
      `fontColor=${n.color || C.plain.color}`,
      `fontSize=${n.fontSize || 12}`,
      n.bold ? "fontStyle=1" : "fontStyle=0",
      n.align === "left" ? "align=left;spacingLeft=10" : "align=center",
      n.meta ? "verticalAlign=top;spacingTop=8" : "",
      "arcSize=8",
      n.dashed ? "dashed=1" : "",
    ]
      .filter(Boolean)
      .join(";");
    const labelHtml = String(n.label || "").replace(/\n/g, "<br>");
    const descHtml = String(n.desc || "").replace(/\n/g, "<br>");
    const html = n.desc
      ? `<b>${labelHtml}</b><br><font style="font-size:${(n.fontSize || 12) - 1}px" color="#5B6472">${descHtml}</font>`
      : labelHtml;
    const value = esc(html);
    cells.push(
      `<mxCell id="${ids.get(n.id)}" value="${value}" style="${style}" vertex="1" parent="1"><mxGeometry x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" as="geometry"/></mxCell>`
    );
  }

  edges.forEach((e, i) => {
    const pts = e.points || [];
    const inner = pts.slice(1, -1);
    const style = [
      "edgeStyle=orthogonalEdgeStyle",
      "rounded=0",
      "html=1",
      e.arrow ? "endArrow=classic" : "endArrow=none",
      e.startArrow ? "startArrow=classic" : "startArrow=none",
      `strokeColor=${e.color || C.line}`,
      `strokeWidth=${e.width || 1.4}`,
      e.dashed ? "dashed=1" : "",
      e.label ? "labelBackgroundColor=#FFFFFF" : "",
      `fontSize=${e.labelSize || 10.5}`,
      `fontColor=${e.labelColor || C.muted}`,
    ]
      .filter(Boolean)
      .join(";");
    const geo = [`<mxGeometry relative="1" as="geometry">`];
    if (!e.from || !ids.get(e.from)) {
      const p0 = pts[0] || [0, 0];
      const pn = pts[pts.length - 1] || [0, 0];
      geo.push(`<mxPoint as="sourcePoint" x="${p0[0]}" y="${p0[1]}"/>`);
      geo.push(`<mxPoint as="targetPoint" x="${pn[0]}" y="${pn[1]}"/>`);
    }
    if (inner.length) {
      geo.push(`<Array as="points">`);
      inner.forEach((p) => geo.push(`<mxPoint x="${p[0]}" y="${p[1]}"/>`));
      geo.push(`</Array>`);
    }
    geo.push(`</mxGeometry>`);
    const ends = [
      ids.get(e.from) ? `source="${ids.get(e.from)}"` : "",
      ids.get(e.to) ? `target="${ids.get(e.to)}"` : "",
    ]
      .filter(Boolean)
      .join(" ");
    cells.push(
      `<mxCell id="e${i + 1}" value="${esc(e.label || "")}" style="${style}" edge="1" parent="1" ${ends}>${geo.join("")}</mxCell>`
    );
  });

  return `<mxfile host="app.diagrams.net" modified="2026-10-26T00:00:00.000Z" agent="BookBox diagrams" version="24.7.17" type="device">
  <diagram id="${name}" name="${name}">
    <mxGraphModel dx="1200" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${Math.ceil(width)}" pageHeight="${Math.ceil(height)}" math="0" shadow="0">
      <root>
        ${cells.join("\n        ")}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`;
}

/* ------------------------------------------------------------------ */
/* Раскладки                                                           */
/* ------------------------------------------------------------------ */

/** Горизонтальное дерево: корень слева, потомки правее. */
function layoutTree(root, opts = {}) {
  const {
    nodeW = 210,
    gapY = 9,
    gapX = 80,
    padX = 40,
    padY = 90,
    align = "center",
  } = opts;

  let cursor = padY;
  let maxDepth = 0;
  const nodes = [];

  function walk(node, depth, parent) {
    maxDepth = Math.max(maxDepth, depth);
    node.w = node.w || nodeW;
    node.h = node.h || autoHeight({ ...node, w: node.w });
    node.depth = depth;
    node.parent = parent;
    node.x = padX + depth * (nodeW + gapX);

    if (!node.children || node.children.length === 0) {
      node.y = cursor;
      cursor += node.h + gapY;
    } else {
      for (const child of node.children) walk(child, depth + 1, node);
      const first = node.children[0];
      const last = node.children[node.children.length - 1];
      const center = (first.y + first.h / 2 + last.y + last.h / 2) / 2;
      node.y = center - node.h / 2;
    }

    nodes.push(node);
  }

  walk(root, 0, null);

  // связи строим после раскладки: координаты родителей уже известны
  const edges = [];
  for (const node of nodes) {
    const parent = node.parent;
    if (!parent) continue;
    const midX = parent.x + parent.w + gapX / 2;
    edges.push({
      from: parent.id,
      to: node.id,
      color: node.edgeColor || null,
      width: 1.15,
      points: [
        [parent.x + parent.w, parent.y + parent.h / 2],
        [midX, parent.y + parent.h / 2],
        [midX, node.y + node.h / 2],
        [node.x, node.y + node.h / 2],
      ],
    });
  }

  const width = padX * 2 + (maxDepth + 1) * nodeW + maxDepth * gapX;
  const height = cursor + 40;

  return { width, height, nodes, edges, align };
}

/** Точка на границе узла в направлении другого узла. */
function anchor(a, b) {
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2;
  const by = b.y + b.h / 2;
  const dx = bx - ax;
  const dy = by - ay;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0
      ? [a.x + a.w, a.y + a.h / 2]
      : [a.x, a.y + a.h / 2];
  }
  return dy > 0
    ? [ax, a.y + a.h]
    : [ax, a.y];
}

/* ------------------------------------------------------------------ */
/* 1. Карта сайта                                                      */
/* ------------------------------------------------------------------ */

function sitemap() {
  let seq = 0;
  const mk = (label, style = "plain", extra = {}) => ({
    id: "s" + ++seq,
    label,
    fill: C[style].fill,
    stroke: C[style].stroke,
    color: C[style].color,
    edgeColor: C[style].stroke,
    fontSize: 11.5,
    ...extra,
  });

  const root = mk("BookBox", "root", { bold: true, fontSize: 14, w: 150 });

  const cache = {};

  root.children = [
    mk("Главная", "aux"),
    (cache.catalog = mk("Каталог", "catalog", { bold: true })),
    (cache.book = mk("Книга (карточка)", "book", { bold: true })),
    (cache.authors = mk("Авторы", "catalog")),
    (cache.publishers = mk("Издательства", "catalog")),
    (cache.series = mk("Серии", "catalog")),
    (cache.collections = mk("Подборки", "accent", { bold: true })),
    mk("Поиск", "search"),
    mk("Корзина", "book"),
    (cache.checkout = mk("Оформление заказа", "book", { bold: true })),
    (cache.account = mk("Личный кабинет", "profile", { bold: true })),
    (cache.help = mk("Помощь", "help", { bold: true })),
    (cache.about = mk("О нас", "help")),
    (cache.admin = mk("Админ-панель", "admin", { bold: true })),
    (cache.service = mk("Служебные страницы", "aux")),
  ];

  cache.catalog.children = [
    mk("Художественная литература", "catalog", {
      bold: true,
      children: [
        mk("Классика", "catalog"),
        mk("Фэнтези", "catalog"),
        mk("Детективы", "catalog"),
        mk("… ещё 9 жанров", "catalog", { dashed: true }),
      ],
    }),
    mk("Научная и учебная", "catalog", {
      children: [
        mk("Математика", "catalog"),
        mk("Физика", "catalog"),
        mk("… ещё 9 жанров", "catalog", { dashed: true }),
      ],
    }),
    mk("Детская литература", "catalog"),
    mk("Бизнес и саморазвитие", "catalog"),
    mk("Психология", "catalog"),
    mk("Компьютерная литература", "catalog"),
    mk("История и публицистика", "catalog"),
    mk("Подарочные издания", "catalog"),
    mk("Комиксы и манга", "catalog"),
  ];

  cache.book.children = [
    mk("Описание", "book"),
    mk("Характеристики", "book"),
    mk("Отзывы", "book"),
    mk("Похожие книги", "book"),
    mk("Другие книги автора", "book"),
  ];

  cache.authors.children = [
    mk("Автор", "catalog", {
      children: [mk("Книги автора", "catalog")],
    }),
  ];

  cache.publishers.children = [
    mk("Издательство", "catalog", {
      children: [mk("Книги издательства", "catalog")],
    }),
  ];

  cache.series.children = [mk("Серия", "catalog")];

  cache.collections.children = [
    mk("Скидки студентам", "accent"),
    mk("Новинки месяца", "accent"),
    mk("Топ-10", "accent"),
    mk("Книжный клуб", "accent"),
    mk("Подарки", "accent"),
  ];

  cache.checkout.children = [
    mk("1. Адрес", "book"),
    mk("2. Доставка", "book"),
    mk("3. Оплата", "book"),
    mk("4. Подтверждение", "book"),
  ];

  cache.account.children = [
    mk("Профиль", "profile"),
    mk("Адреса доставки", "profile"),
    mk("Мои заказы", "profile", {
      children: [mk("Заказ", "profile")],
    }),
    mk("Избранное", "profile"),
    mk("Мои отзывы", "profile"),
    mk("Подписки", "profile"),
    mk("Уведомления", "profile"),
  ];

  cache.help.children = [
    mk("Доставка", "help"),
    mk("Оплата", "help"),
    mk("Возврат и обмен", "help"),
    mk("FAQ", "help"),
    mk("Контакты", "help"),
  ];

  cache.about.children = [mk("О компании", "help"), mk("Блог", "help"), mk("Вакансии", "help")];

  cache.admin.children = [
    mk("Каталог", "admin", {
      children: [
        mk("Книги", "admin", {
          children: [mk("Добавить книгу", "admin"), mk("Редактирование", "admin")],
        }),
        mk("Жанры", "admin"),
        mk("Авторы", "admin"),
        mk("Издательства", "admin"),
        mk("Серии", "admin"),
      ],
    }),
    mk("Заказы", "admin"),
    mk("Пользователи", "admin"),
    mk("Отзывы", "admin"),
    mk("Подборки и акции", "admin"),
    mk("Аналитика", "admin"),
    mk("Настройки", "admin"),
  ];

  cache.service.children = [
    mk("Карта сайта", "aux"),
    mk("Политика конфиденциальности", "aux"),
    mk("Пользовательское соглашение", "aux"),
    mk("404 / 500", "aux"),
  ];

  const model = layoutTree(root, { nodeW: 190, gapX: 68, gapY: 4, padY: 100 });
  model.title = "Карта сайта BookBox (sitemap), 4 уровня вложенности";
  model.name = "sitemap";
  return model;
}

/* ------------------------------------------------------------------ */
/* 2. Граф состояний меню                                              */
/* ------------------------------------------------------------------ */

function menuStates() {
  const W = 230;
  const H = 96;
  const nodes = [];
  const by = {};

  const state = (id, x, y, label, desc, style = "plain") => {
    const n = {
      id,
      x,
      y,
      w: W,
      h: H,
      label,
      desc,
      fill: C[style].fill,
      stroke: C[style].stroke,
      color: C[style].color,
      bold: true,
      fontSize: 13,
      descColor: "#5B6472",
    };
    nodes.push(n);
    by[id] = n;
    return n;
  };

  state("S0", 685, 80, "S0. Гость, главная", "Каталог · Новинки · Скидки · Подборки\nДоставка · О нас · Поиск · Корзина · Войти", "catalog");
  state("S1", 200, 250, "S1. Гость, каталог", "Глобальное меню + фасеты и сортировка\n«В корзину» → «Войти»", "catalog");
  state("S2", 520, 250, "S2. Гость, книга", "Избранное и «Купить сейчас» просят вход\nКорзина доступна", "book");
  state("S7", 840, 250, "S7. Помощь / инфо", "Полное глобальное меню\nДоставка, оплата, возврат, FAQ", "help");
  state("S8", 1160, 250, "S8. Вход / регистрация", "Только логотип и «Назад»\nГлобальное меню скрыто", "aux");
  state("S3", 685, 420, "S3. Авторизован", "Все пункты + Избранное + Профиль\nКорзина со счётчиком", "profile");
  state("S4", 350, 590, "S4. Корзина / checkout", "Меню и footer скрыты\nСтеппер 1 → 2 → 3 → 4, «Назад»", "book");
  state("S5", 685, 590, "S5. Личный кабинет", "Табы: Профиль · Адреса · Заказы\nИзбранное · Отзывы · Подписки", "profile");
  state("S6", 1030, 590, "S6. Админ-панель", "Своё меню: Каталог · Заказы · Пользователи\nОтзывы · Подборки · Аналитика · Настройки", "admin");

  const edges = [
    { from: "S0", to: "S1", label: "Каталог", labelAt: [560, 198],
      points: [[760, 176], [760, 205], [315, 205], [315, 250]] },
    { from: "S0", to: "S7", label: "Помощь", labelAt: [877, 208],
      points: [[800, 176], [800, 215], [955, 215], [955, 250]] },
    { from: "S0", to: "S8", label: "Войти", labelAt: [1065, 224],
      points: [[860, 176], [860, 232], [1275, 232], [1275, 250]] },
    { from: "S1", to: "S2", label: "Книга", labelAt: [475, 287],
      points: [[430, 298], [520, 298]] },
    { from: "S2", to: "S8", label: "Войти", labelAt: [920, 359],
      points: [[635, 346], [635, 368], [1215, 368], [1215, 346]] },
    { from: "S8", to: "S3", label: "Успешный вход", labelAt: [1060, 391],
      points: [[1335, 346], [1335, 400], [800, 400], [800, 420]] },
    { from: "S3", to: "S4", label: "В корзину", labelAt: [615, 546],
      points: [[760, 516], [760, 555], [465, 555], [465, 590]] },
    { from: "S3", to: "S5", label: "Профиль", labelAt: [872, 552],
      points: [[800, 516], [800, 590]] },
    { from: "S4", to: "S5", label: "Заказ / Назад", labelAt: [632, 619],
      points: [[580, 638], [685, 638]], startArrow: true },
    { from: "S5", to: "S6", label: "Админ-доступ", labelAt: [972, 619],
      points: [[915, 638], [1030, 638]] },
  ];

  return {
    name: "menu-states",
    title: "Граф состояний главного меню: вершины — состояния, дуги — команды меню",
    width: 1430,
    height: 750,
    nodes,
    edges,
  };
}

/* ------------------------------------------------------------------ */
/* 3. Карта навигации                                                  */
/* ------------------------------------------------------------------ */

function navigationMap() {
  const nodes = [];
  const by = {};
  const add = (id, x, y, w, h, label, style, extra = {}) => {
    const n = {
      id,
      x,
      y,
      w,
      h,
      label,
      fill: C[style].fill,
      stroke: C[style].stroke,
      color: C[style].color,
      fontSize: 12,
      bold: true,
      ...extra,
    };
    nodes.push(n);
    by[id] = n;
    return n;
  };

  // Левая колонка — уровни навигации
  add("panel", 40, 80, 250, 500, "", "aux", {
    fill: "#FAF9F6",
    stroke: "#DDD7CB",
    bold: false,
  });

  const levels = [
    ["Глобальная", "header (6 пунктов + каскад) и footer (5 колонок)", 96],
    ["Локальная", "табы раздела, фасеты, степпер checkout", 208],
    ["Контекстная", "«Похожие», «Другие книги автора», «Из этой серии»", 320],
    ["Вспомогательная", "крошки, карта сайта, указатель, пагинация, «наверх»", 432],
  ];
  levels.forEach(([t, d, y], i) => {
    add("lv" + i, 56, y, 218, 92, t, "plain", {
      desc: d,
      fill: "#FFFFFF",
      stroke: C.aux.stroke,
      color: C.ink,
      fontSize: 12,
      descColor: "#5B6472",
    });
  });

  // Граф страниц
  add("home", 600, 80, 170, 44, "Главная", "catalog");
  add("collections", 300, 210, 170, 44, "Подборки", "accent");
  add("catalog", 600, 210, 170, 44, "Каталог", "catalog");
  add("search", 900, 210, 170, 44, "Поиск", "search");
  add("book", 600, 340, 190, 50, "Страница книги", "book");
  add("cart", 900, 340, 170, 44, "Корзина", "book");
  add("checkout", 600, 470, 190, 50, "Оформление заказа", "book");
  add("account", 300, 600, 170, 44, "Личный кабинет", "profile");
  add("order", 300, 700, 170, 44, "Заказ (статус)", "profile");
  add("admin", 900, 600, 190, 44, "Админ-панель", "admin", {
    desc: "отдельный layout /admin",
    h: 60,
    dashed: true,
  });

  const edges = [
    {
      from: "home",
      to: "collections",
      label: "Подборки",
      labelAt: [500, 152],
      points: [[655, 124], [655, 160], [385, 160], [385, 210]],
    },
    {
      from: "home",
      to: "catalog",
      label: "Каталог",
      labelAt: [697, 172],
      labelColor: C.muted,
      points: [[685, 124], [685, 210]],
    },
    {
      from: "home",
      to: "search",
      label: "Поиск",
      labelAt: [840, 182],
      points: [[715, 124], [715, 182], [985, 182], [985, 210]],
    },
    {
      from: "collections",
      to: "book",
      label: "M3",
      labelAt: [520, 292],
      points: [[385, 254], [385, 300], [660, 300], [660, 340]],
    },
    {
      from: "catalog",
      to: "book",
      label: "M1",
      labelAt: [697, 296],
      points: [[685, 254], [685, 340]],
    },
    {
      from: "search",
      to: "book",
      label: "M1",
      labelAt: [880, 312],
      points: [[985, 254], [985, 320], [750, 320], [750, 340]],
    },
    {
      from: "book",
      to: "cart",
      label: "В корзину",
      labelAt: [845, 355],
      points: [[790, 365], [900, 365]],
    },
    {
      from: "book",
      to: "checkout",
      label: "M2 · Купить сейчас",
      labelAt: [695, 430],
      points: [[695, 390], [695, 470]],
      dashed: true,
      color: "#B87333",
    },
    {
      from: "cart",
      to: "checkout",
      label: "Оформить",
      labelAt: [870, 422],
      points: [[985, 384], [985, 440], [745, 440], [745, 495]],
    },
    {
      from: "checkout",
      to: "account",
      label: "Заказ оформлен",
      labelAt: [540, 552],
      points: [[695, 520], [695, 560], [385, 560], [385, 600]],
    },
    {
      from: "account",
      to: "order",
      label: "M4",
      labelAt: [400, 672],
      points: [[385, 644], [385, 700]],
    },
  ];

  return {
    name: "navigation-map",
    title: "Карта навигации BookBox: 4 уровня навигации и маршруты M1–M6",
    width: 1150,
    height: 790,
    nodes,
    edges: edges.map((e) => ({ arrow: true, ...e })),
  };
}

/* ------------------------------------------------------------------ */
/* 4. Схема метаданных поиска                                          */
/* ------------------------------------------------------------------ */

function searchMetadata() {
  const nodes = [];
  const edges = [];

  const card = (id, x, y, w, title, lines, style, badge) => {
    const h = 46 + lines.length * 17;
    const n = {
      id,
      x,
      y,
      w,
      h,
      label: title,
      fill: C[style].fill,
      stroke: C[style].stroke,
      color: C[style].color,
      bold: true,
      fontSize: 12.5,
      align: "left",
      meta: lines,
    };
    nodes.push(n);
    return n;
  };

  const book = [
    "title — 10 · isbn — 10 · author — 8",
    "publisher — 4 · series — 3 · genres — 3",
    "tags — 2 · year — 2 · description — 1",
    "",
    "Фильтры: жанр, автор, издательство, язык,",
    "формат, переплёт, возраст, цена, год,",
    "наличие, рейтинг, скидка, новинка",
    "Сортировка: цена, новизна, рейтинг",
  ];
  const author = ["name — 10", "bio — 1", "books_count → сортировка"];
  const genre = ["name — 8", "parent → иерархия", "description — 1"];
  const publisher = ["name — 8", "country, site → фильтр"];
  const series = ["name — 6", "publisher → фильтр", "books_count → сортировка"];
  const review = ["text — 1", "rating, created_at", "book.title — 2", "поиск только в админ-модерации"];
  const order = ["number — 10 (точное)", "email — 8 · phone — 8", "status → фильтр", "created_at → сортировка"];
  const collection = ["title — 6", "description — 2", "books → связи"];

  const c1 = card("bookCard", 40, 90, 330, "Книга", book, "book");
  const c2 = card("authorCard", 400, 90, 250, "Автор", author, "catalog");
  const c3 = card("genreCard", 680, 90, 220, "Жанр", genre, "catalog");
  const c4 = card("publisherCard", 930, 90, 220, "Издательство", publisher, "catalog");
  const c5 = card("seriesCard", 40, 350, 250, "Серия", series, "accent");
  const c6 = card("reviewCard", 320, 350, 250, "Отзыв", review, "help");
  const c7 = card("orderCard", 600, 350, 250, "Заказ", order, "admin");
  const c8 = card("collectionCard", 880, 350, 250, "Подборка", collection, "accent");

  const index = {
    id: "index",
    x: 40,
    y: 570,
    w: 420,
    h: 70,
    label: "Полнотекстовый индекс + фасетный индекс",
    desc: "Взвешенный поиск по полям · подсветка совпадений · опечатки 1–2 · синонимы",
    fill: C.root.fill,
    stroke: C.root.stroke,
    color: "#FFFFFF",
    bold: true,
    fontSize: 13,
    descColor: "#DCE9EA",
  };
  nodes.push(index);

  for (const c of [c1, c2, c3, c4, c5, c6, c7, c8]) {
    edges.push({
      from: c.id,
      to: "index",
      points: [
        [c.x, c.y + c.h / 2],
        [20, c.y + c.h / 2],
        [20, 545],
        [250, 545],
        [250, index.y],
      ],
      color: "#CFC8BA",
      width: 1.1,
    });
  }

  return {
    name: "search-metadata",
    title: "Схема метаданных поиска: поля, веса и фильтры по типам контента",
    width: 1190,
    height: 680,
    nodes,
    edges,
    kind: "meta",
  };
}

/* ------------------------------------------------------------------ */
/* 5. Дендрограмма карточной сортировки                                 */
/* ------------------------------------------------------------------ */

function cardSorting() {
  const clusters = [
    {
      name: "Книги и каталог — 100 %",
      color: C.catalog,
      items: ["Главная", "Каталог", "Жанры", "Новинки", "Страница книги", "Карточка книги", "Авторы", "Издательства", "Серии", "Отзывы", "Рейтинг"],
    },
    {
      name: "Корзина и заказ — 100 %",
      color: C.book,
      items: ["Корзина", "Оформление заказа", "Доставка", "Оплата", "Способы получения"],
    },
    {
      name: "Мой профиль — 88 %",
      color: C.profile,
      items: ["Избранное", "Мои заказы", "История заказов", "Адреса доставки", "Подписки", "Уведомления", "Вход и регистрация"],
    },
    {
      name: "Поиск и фильтры — 75 %",
      color: C.search,
      items: ["Поиск", "Расширенный поиск", "Фильтры", "Сортировка"],
    },
    {
      name: "Помощь и информация — 75 %",
      color: C.help,
      items: ["FAQ", "Контакты", "Возврат и обмен", "О нас", "Блог"],
    },
    {
      name: "Подборки и акции — 75 %",
      color: C.accent,
      items: ["Скидки", "Подборки", "Книжный клуб", "Бонусы студентам"],
    },
  ];

  const leafH = 22;
  const gap = 5;
  const labelW = 190;
  const step = 62;
  const top = 110;

  const nodes = [];
  const edges = [];
  let y = top;
  let maxX = 0;

  clusters.forEach((cl, ci) => {
    const count = cl.items.length;
    const startY = y;
    const centers = [];

    cl.items.forEach((item) => {
      const n = {
        id: `leaf-${ci}-${item}`,
        x: 40,
        y,
        w: labelW,
        h: leafH,
        label: item,
        fill: "#FFFFFF",
        stroke: cl.color.stroke,
        color: C.ink,
        fontSize: 10.5,
        align: "left",
      };
      nodes.push(n);
      centers.push(y + leafH / 2);
      y += leafH + gap;
    });

    const leafRight = 40 + labelW;
    const mergeX = leafRight + 34 + ci * 4;
    const clusterX = leafRight + 34 + 250;

    // линии от листьев к первому уровню
    centers.forEach((cy, i) => {
      edges.push({
        points: [
          [leafRight, cy],
          [mergeX, cy],
        ],
        color: "#D8D2C6",
        width: 1.1,
      });
    });

    edges.push({
      points: [
        [mergeX, centers[0]],
        [mergeX, centers[count - 1]],
      ],
      color: "#CFC8BA",
      width: 1.2,
    });

    const midY = (centers[0] + centers[count - 1]) / 2;
    const n = {
      id: `cl-${ci}`,
      x: clusterX,
      y: midY - 22,
      w: 250,
      h: 44,
      label: cl.name,
      fill: cl.color.fill,
      stroke: cl.color.stroke,
      color: cl.color.color,
      bold: true,
      fontSize: 11.5,
    };
    nodes.push(n);
    maxX = Math.max(maxX, clusterX + n.w);

    edges.push({
      points: [
        [mergeX, midY],
        [clusterX, midY],
      ],
      color: "#CFC8BA",
      width: 1.4,
    });

    y += 18;
  });

  // корень
  const rootY = (top + y) / 2;
  const rootX = maxX + 30;
  nodes.push({
    id: "root",
    x: rootX,
    y: rootY - 30,
    w: 110,
    h: 60,
    label: "Все\nразделы",
    fill: C.root.fill,
    stroke: C.root.stroke,
    color: "#FFFFFF",
    bold: true,
    fontSize: 12,
  });

  const clusterNodes = nodes.filter((n) => n.id.startsWith("cl-"));
  for (const cn of clusterNodes) {
    edges.push({
      points: [
        [cn.x + cn.w, cn.y + cn.h / 2],
        [rootX - 20, cn.y + cn.h / 2],
        [rootX - 20, rootY],
        [rootX, rootY],
      ],
      color: "#CFC8BA",
      width: 1.3,
    });
  }

  return {
    name: "cardsorting",
    title: "Дендрограмма открытой карточной сортировки (OptimalSort, 8 респондентов, 36 карточек)",
    width: rootX + 150,
    height: y + 40,
    nodes,
    edges,
    kind: "cardsort",
  };
}

/* ------------------------------------------------------------------ */
/* Дополнительный рендер для карточек метаданных и дендрограммы          */
/* ------------------------------------------------------------------ */

/** Для схемы метаданных: строки полей внутри карточки. */
function svgMetaOverlay(model) {
  const parts = [];
  for (const n of model.nodes) {
    if (!n.meta) continue;
    let y = n.y + 44;
    for (const line of n.meta) {
      if (line) {
        parts.push(
          `<text x="${n.x + 12}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="10.5" fill="#374151">${esc(line)}</text>`
        );
      }
      y += 17;
    }
  }
  return parts.join("\n");
}

/* ------------------------------------------------------------------ */
/* Запись                                                              */
/* ------------------------------------------------------------------ */

mkdirSync(OUT, { recursive: true });

const models = [sitemap(), menuStates(), navigationMap(), searchMetadata(), cardSorting()];

for (const model of models) {
  let svg = renderSvg(model);
  if (model.kind === "meta") {
    svg = svg.replace("</svg>", svgMetaOverlay(model) + "\n</svg>");
  }
  writeFileSync(join(OUT, `${model.name}.svg`), svg);

  let xml = renderDrawio(model, model.name);
  if (model.kind === "meta") {
    // добавляем поля карточек как отдельные текстовые блоки
    const extra = [];
    let i = 500;
    for (const n of model.nodes) {
      if (!n.meta) continue;
      const value = n.meta.map((l) => (l ? esc(l) : "")).join("&lt;br&gt;");
      extra.push(
        `<mxCell id="m${i++}" value="${value}" style="text;html=1;align=left;verticalAlign=top;spacingLeft=0;fontSize=10.5;fontColor=#374151;" vertex="1" parent="1"><mxGeometry x="${n.x + 12}" y="${n.y + 24}" width="${n.w - 24}" height="${n.h - 30}" as="geometry"/></mxCell>`
      );
    }
    xml = xml.replace("</root>", extra.join("\n        ") + "\n      </root>");
  }
  writeFileSync(join(OUT, `${model.name}.drawio`), xml);

  console.log(
    `${model.name}: ${model.width}×${model.height}, узлов ${model.nodes.length}, связей ${model.edges.length}`
  );
}
