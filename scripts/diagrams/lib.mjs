/**
 * Общая библиотека рендера схем BookBox.
 *
 * Модель диаграммы:
 *   { width, height, title, nodes: [...], edges: [...] }
 *
 * Даёт два представления из одной модели:
 *   - SVG  (для PNG через headless Chrome);
 *   - draw.io mxGraph XML (редактируемый исходник).
 *
 * Экспортируется всё, что нужно builders.mjs и render.mjs.
 */

/* ------------------------------------------------------------------ */
/* Палитра                                                             */
/* ------------------------------------------------------------------ */

export const C = {
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

export const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Перенос строк по ширине (оценка ширины символа). */
export function wrap(text, width, fontSize) {
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

export function textHeight(node) {
  const size = node.fontSize || 12;
  const lh = size + 3;
  const label = wrap(node.label || "", node.w, size);
  let h = label.length * lh;
  if (node.desc) h += wrap(node.desc, node.w, size - 1).length * (size + 1) + 4;
  return h;
}

/** Авто-высота узла, если не задана. */
export function autoHeight(node) {
  if (node.h) return node.h;
  return Math.max(28, textHeight(node) + 12);
}

/* ------------------------------------------------------------------ */
/* SVG                                                                 */
/* ------------------------------------------------------------------ */

export function renderSvg(model) {
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
    const strokeW = n.strokeWidth || 1.3;
    if (n.shape === "diamond") {
      const cx = n.x + n.w / 2;
      const cy = n.y + n.h / 2;
      const pts = `${cx},${n.y} ${n.x + n.w},${cy} ${cx},${n.y + n.h} ${n.x},${cy}`;
      parts.push(
        `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"${dash}/>`
      );
    } else {
      parts.push(
        `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"${dash}/>`
      );
    }

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

export function midPoint(points) {
  const i = Math.floor((points.length - 1) / 2);
  const a = points[i];
  const b = points[i + 1];
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/* ------------------------------------------------------------------ */
/* draw.io (mxGraph)                                                   */
/* ------------------------------------------------------------------ */

export function renderDrawio(model, name) {
  const { width, height, nodes, edges } = model;
  const cells = [];
  const ids = new Map();
  nodes.forEach((n, i) => ids.set(n.id, `n${i + 1}`));

  cells.push(`<mxCell id="0"/>`, `<mxCell id="1" parent="0"/>`);

  for (const n of nodes) {
    const style = [
      n.shape === "diamond" ? "rhombus" : "rounded=" + (n.square ? "0" : "1"),
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
export function layoutTree(root, opts = {}) {
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
