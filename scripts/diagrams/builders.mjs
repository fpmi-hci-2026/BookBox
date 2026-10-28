/**
 * Билдеры моделей диаграмм BookBox.
 *
 * Спека (JSON) описывает содержание, билдер считает геометрию.
 * Поддерживаются типы:
 *   - tree       — иерархия (карта сайта), авто-раскладка layoutTree;
 *   - flow       — узлы и рёбра с явными координатами (граф меню, навигация);
 *   - cards      — карточки с полями + общая шина (метаданные поиска);
 *   - dendrogram — кластеры и скобки (карточная сортировка).
 */

import { C, autoHeight, layoutTree } from "./lib.mjs";

/* ------------------------------------------------------------------ */
/* Стили                                                               */
/* ------------------------------------------------------------------ */

export function styleOf(name) {
  return C[name] || C.plain;
}

/** Раскрывает `style: "catalog"` в конкретные цвета, не затирая явные. */
function withStyle(node) {
  const s = styleOf(node.style);
  return {
    fill: s.fill,
    stroke: s.stroke,
    color: s.color,
    edgeColor: s.stroke,
    ...node,
  };
}

/* ------------------------------------------------------------------ */
/* tree                                                                */
/* ------------------------------------------------------------------ */

function buildTree(spec) {
  let seq = 0;

  const mk = (raw) => {
    const node = withStyle(raw);
    node.id = "s" + ++seq;
    node.fontSize = node.fontSize ?? 11.5;
    node.h = node.h ?? autoHeight({ ...node, w: node.w || spec.layout.nodeW });
    if (node.children) node.children = node.children.map(mk);
    return node;
  };

  const root = mk(spec.root);
  const model = layoutTree(root, spec.layout);
  model.title = spec.title;
  model.name = spec.name;
  return model;
}

/* ------------------------------------------------------------------ */
/* flow                                                                */
/* ------------------------------------------------------------------ */

function buildFlow(spec) {
  const nodes = spec.nodes.map((raw) => {
    const node = withStyle(raw);
    node.fontSize = node.fontSize ?? 12;
    node.bold = node.bold ?? true;
    node.h = node.h ?? autoHeight(node);
    return node;
  });

  const edges = spec.edges.map((e) => ({
    arrow: false,
    ...e,
    points: e.points.map((p) => [p[0], p[1]]),
  }));

  return {
    name: spec.name,
    title: spec.title,
    width: spec.width,
    height: spec.height,
    nodes,
    edges,
  };
}

/* ------------------------------------------------------------------ */
/* cards                                                               */
/* ------------------------------------------------------------------ */

function buildCards(spec) {
  const nodes = [];
  const edges = [];

  const cards = spec.cards.map((c) => {
    const s = styleOf(c.style);
    const node = {
      id: c.id,
      x: c.x,
      y: c.y,
      w: c.w,
      h: 46 + c.lines.length * 17,
      label: c.title,
      fill: s.fill,
      stroke: s.stroke,
      color: s.color,
      bold: true,
      fontSize: 12.5,
      align: "left",
      meta: c.lines,
    };
    nodes.push(node);
    return node;
  });

  const index = {
    id: "index",
    x: spec.index.x,
    y: spec.index.y,
    w: spec.index.w,
    h: spec.index.h,
    label: spec.index.label,
    desc: spec.index.desc,
    fill: C.root.fill,
    stroke: C.root.stroke,
    color: "#FFFFFF",
    bold: true,
    fontSize: 13,
    descColor: "#DCE9EA",
  };
  nodes.push(index);

  for (const c of cards) {
    edges.push({
      from: c.id,
      to: "index",
      behind: true,
      points: [
        [c.x, c.y + c.h / 2],
        [20, c.y + c.h / 2],
        [20, spec.busY],
        [spec.busX, spec.busY],
        [spec.busX, index.y],
      ],
      color: "#CFC8BA",
      width: 1.1,
    });
  }

  return {
    name: spec.name,
    title: spec.title,
    width: spec.width,
    height: spec.height,
    nodes,
    edges,
    kind: "meta",
  };
}

/* ------------------------------------------------------------------ */
/* dendrogram                                                          */
/* ------------------------------------------------------------------ */

function buildDendrogram(spec) {
  const leafH = 22;
  const gap = 5;
  const labelW = 190;
  const top = 110;

  const nodes = [];
  const edges = [];
  let y = top;
  let maxX = 0;

  spec.clusters.forEach((cluster, ci) => {
    const s = styleOf(cluster.style);
    const startY = y;
    const centers = [];

    cluster.items.forEach((item) => {
      nodes.push({
        id: `leaf-${ci}-${item}`,
        x: 40,
        y,
        w: labelW,
        h: leafH,
        label: item,
        fill: "#FFFFFF",
        stroke: s.stroke,
        color: C.ink,
        fontSize: 10.5,
        align: "left",
      });
      centers.push(y + leafH / 2);
      y += leafH + gap;
    });

    const leafRight = 40 + labelW;
    const mergeX = leafRight + 34 + ci * 4;
    const clusterX = leafRight + 34 + 250;

    centers.forEach((cy) => {
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
        [mergeX, centers[centers.length - 1]],
      ],
      color: "#CFC8BA",
      width: 1.2,
    });

    const midY = (centers[0] + centers[centers.length - 1]) / 2;
    const node = {
      id: `cl-${ci}`,
      x: clusterX,
      y: midY - 22,
      w: 250,
      h: 44,
      label: cluster.name,
      fill: s.fill,
      stroke: s.stroke,
      color: s.color,
      bold: true,
      fontSize: 11.5,
    };
    nodes.push(node);
    maxX = Math.max(maxX, clusterX + node.w);

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

  for (const node of nodes.filter((n) => n.id.startsWith("cl-"))) {
    edges.push({
      points: [
        [node.x + node.w, node.y + node.h / 2],
        [rootX - 20, node.y + node.h / 2],
        [rootX - 20, rootY],
        [rootX, rootY],
      ],
      color: "#CFC8BA",
      width: 1.3,
    });
  }

  return {
    name: spec.name,
    title: spec.title,
    width: rootX + 150,
    height: y + 40,
    nodes,
    edges,
    kind: "cardsort",
  };
}

/* ------------------------------------------------------------------ */
/* swimlane                                                            */
/* ------------------------------------------------------------------ */

function buildSwimlane(spec) {
  const x0 = 40;
  const labelW = 170;
  const colW = 150;
  const headerH = 44;
  const rowH = 88;
  const cellW = 140;
  const cellH = 64;
  const top = 96;
  const gridX = x0 + labelW;

  const nodes = [];
  const edges = [];
  const shared = new Set(spec.shared || []);

  spec.stages.forEach((stage, i) => {
    nodes.push({
      id: `h${i}`,
      x: gridX + i * colW,
      y: top,
      w: cellW,
      h: 30,
      label: stage,
      fill: "#F7F6F3",
      stroke: "#DDD7CB",
      color: C.ink,
      bold: true,
      fontSize: 11.5,
    });
  });

  spec.personas.forEach((persona, r) => {
    const s = styleOf(persona.style);
    const y = top + headerH + r * rowH;

    nodes.push({
      id: `p${r}`,
      x: x0,
      y: y + (cellH - 56) / 2,
      w: labelW - 16,
      h: 56,
      label: persona.name,
      fill: s.fill,
      stroke: s.stroke,
      color: s.color,
      bold: true,
      fontSize: 12,
    });

    persona.cells.forEach((cell, i) => {
      if (!cell) return;
      const isShared = [...shared].some((token) => cell.startsWith(token));
      nodes.push({
        id: `c${r}-${i}`,
        x: gridX + i * colW,
        y,
        w: cellW,
        h: cellH,
        label: cell,
        fill: "#FFFFFF",
        stroke: isShared ? "#B08D57" : s.stroke,
        strokeWidth: isShared ? 2.2 : 1.2,
        color: C.ink,
        fontSize: 10.5,
        bold: isShared,
      });
      if (i > 0 && cell && persona.cells[i - 1]) {
        edges.push({
          from: `c${r}-${i - 1}`,
          to: `c${r}-${i}`,
          arrow: true,
          color: s.stroke,
          width: 1.2,
          points: [
            [gridX + (i - 1) * colW + cellW, y + cellH / 2],
            [gridX + i * colW, y + cellH / 2],
          ],
        });
      }
    });
  });

  const width = gridX + spec.stages.length * colW + 40;
  const height = top + headerH + spec.personas.length * rowH + 20;

  return {
    name: spec.name,
    title: spec.title,
    width,
    height,
    nodes,
    edges,
    kind: "swimlane",
  };
}

/* ------------------------------------------------------------------ */
/* Диспетчер                                                           */
/* ------------------------------------------------------------------ */

export function buildModel(spec) {
  switch (spec.type) {
    case "tree":
      return buildTree(spec);
    case "flow":
      return buildFlow(spec);
    case "cards":
      return buildCards(spec);
    case "dendrogram":
      return buildDendrogram(spec);
    case "swimlane":
      return buildSwimlane(spec);
    default:
      throw new Error(`Неизвестный тип спеки: ${spec.type}`);
  }
}

/** Текст полей карточек рисуется поверх прямоугольников. */
export function metaOverlaySvg(model) {
  if (model.kind !== "meta") return "";
  const parts = [];
  for (const n of model.nodes) {
    if (!n.meta) continue;
    let y = n.y + 44;
    for (const line of n.meta) {
      if (line) {
        parts.push(
          `<text x="${n.x + 12}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="10.5" fill="#374151">${line
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")}</text>`
        );
      }
      y += 17;
    }
  }
  return parts.join("\n");
}

/** Дополнительные текстовые ячейки в draw.io для полей карточек. */
export function metaOverlayDrawio(model) {
  if (model.kind !== "meta") return "";
  const extra = [];
  let i = 500;
  for (const n of model.nodes) {
    if (!n.meta) continue;
    const value = n.meta
      .map((l) =>
        l ? l.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") : ""
      )
      .join("&lt;br&gt;");
    extra.push(
      `<mxCell id="m${i++}" value="${value}" style="text;html=1;align=left;verticalAlign=top;spacingLeft=0;fontSize=10.5;fontColor=#374151;" vertex="1" parent="1"><mxGeometry x="${n.x + 12}" y="${n.y + 24}" width="${n.w - 24}" height="${n.h - 30}" as="geometry"/></mxCell>`
    );
  }
  return extra.join("\n        ");
}
