/**
 * Геометрическая проверка схемы до рендера.
 *
 * Ошибки (exit 1): дубли id, битые ссылки рёбер, выход за холст,
 * наложение узлов, ребро сквозь чужой узел.
 * Предупреждения (exit 0): текст не влезает, подпись на узле,
 * нулевая длина, дубли рёбер.
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { wrap, textHeight } from "./lib.mjs";
import { buildModel } from "./builders.mjs";

const EPS = 2;

function rectsOverlap(a, b, pad = 0) {
  return (
    a.x + pad < b.x + b.w - pad &&
    a.x + a.w - pad > b.x + pad &&
    a.y + pad < b.y + b.h - pad &&
    a.y + a.h - pad > b.y + pad
  );
}

function pointInRect(px, py, r, pad = 0) {
  return px > r.x + pad && px < r.x + r.w - pad && py > r.y + pad && py < r.y + r.h - pad;
}

/** Пересекает ли отрезок прямоугольник (проверка выборкой по длине). */
function segmentHitsRect(x1, y1, x2, y2, rect, pad = 2) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(2, Math.ceil(len / 3));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (pointInRect(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, rect, pad)) return true;
  }
  return false;
}

function labelBox(e) {
  if (!e.label || !e.points || e.points.length < 2) return null;
  const pts = e.points;
  const midIndex = Math.floor((pts.length - 1) / 2);
  const [ax, ay] = pts[midIndex];
  const [bx, by] = pts[midIndex + 1];
  const [lx, ly] = e.labelAt || [(ax + bx) / 2, (ay + by) / 2];
  const fs = e.labelSize || 10.5;
  const lines = String(e.label).split("\n");
  const w = Math.max(...lines.map((l) => l.length)) * fs * 0.55 + 10;
  const h = lines.length * (fs + 2) + 4;
  return { x: lx - w / 2, y: ly - h / 2, w, h };
}

export function checkModel(model) {
  const errors = [];
  const warnings = [];
  const { width, height, nodes = [], edges = [] } = model;
  const byId = new Map();

  for (const n of nodes) {
    if (byId.has(n.id)) errors.push(`узел с id «${n.id}» встречается дважды`);
    byId.set(n.id, n);
  }

  for (const n of nodes) {
    if (n.x < 0 || n.y < 0 || n.x + n.w > width || n.y + n.h > height) {
      errors.push(
        `узел «${n.label || n.id}» выходит за холст (${n.x},${n.y} ${n.w}×${n.h} при ${width}×${height})`
      );
    }
    const need = textHeight(n);
    if (need > n.h - 4) {
      warnings.push(
        `текст может не влезть в «${(n.label || n.id).split("\n")[0]}»: нужно ${need.toFixed(0)}px, есть ${n.h}px`
      );
    }
    if (n.meta) {
      const needMeta = 44 + n.meta.length * 17;
      if (needMeta > n.h) {
        warnings.push(`поля карточки «${n.label}» выше самой карточки`);
      }
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].container || nodes[j].container) continue;
      if (rectsOverlap(nodes[i], nodes[j], EPS)) {
        errors.push(
          `узлы «${nodes[i].label || nodes[i].id}» и «${nodes[j].label || nodes[j].id}» пересекаются`
        );
      }
    }
  }

  const seen = new Set();

  for (const e of edges) {
    const hasFrom = Boolean(e.from);
    const hasTo = Boolean(e.to);
    if (hasFrom !== hasTo) {
      errors.push(`ребро связывает узел и пустоту: ${e.from || "?"} → ${e.to || "?"}`);
    }
    if (hasFrom && !byId.has(e.from)) errors.push(`ребро ссылается на несуществующий узел «${e.from}»`);
    if (hasTo && !byId.has(e.to)) errors.push(`ребро ссылается на несуществующий узел «${e.to}»`);

    if (hasFrom && hasTo) {
      const key = `${e.from}→${e.to}→${e.label || ""}`;
      if (seen.has(key)) warnings.push(`дубль ребра ${e.from} → ${e.to}`);
      seen.add(key);
    }

    const pts = e.points || [];
    const total = pts.reduce((acc, p, i) => (i ? acc + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
    if (pts.length >= 2 && total < 0.5) {
      warnings.push(`ребро ${e.from || "?"} → ${e.to || "?"} нулевой длины`);
    }
    if (pts.length < 2) {
      errors.push(`у ребра ${e.from || "?"} → ${e.to || "?"} меньше двух точек`);
      continue;
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      if (e.behind) continue;
      for (const n of nodes) {
        if (n.id === e.from || n.id === e.to) continue;
        if (n.meta) continue;
        if (segmentHitsRect(x1, y1, x2, y2, n)) {
          errors.push(
            `ребро ${e.from || "?"} → ${e.to || "?"} проходит сквозь узел «${n.label || n.id}»`
          );
          i = pts.length;
          break;
        }
      }
    }
  }

  const boxes = [];
  for (const e of edges) {
    const box = labelBox(e);
    if (!box) continue;
    for (const n of nodes) {
      if (n.id === e.from || n.id === e.to) continue;
      if (rectsOverlap(box, n, 0)) {
        warnings.push(`подпись «${e.label}» накладывается на узел «${n.label || n.id}»`);
      }
    }
    for (const other of boxes) {
      if (rectsOverlap(box, other, 2)) {
        warnings.push(`подписи рёбер пересекаются (${e.label})`);
      }
    }
    boxes.push(box);
  }

  return { errors, warnings };
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

if (process.argv[1] && process.argv[1].endsWith("check.mjs")) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("Использование: node scripts/diagrams/check.mjs spec/*.json");
    process.exit(2);
  }
  let failed = false;
  for (const file of files) {
    const spec = JSON.parse(readFileSync(file, "utf8"));
    const model = buildModel(spec);
    const { errors, warnings } = checkModel(model);
    const name = spec.name || basename(file, ".json");
    console.log(`${name}: ${errors.length} errors, ${warnings.length} warnings`);
    for (const e of errors) console.log(`  ✗ ${e}`);
    for (const w of warnings) console.log(`  ! ${w}`);
    if (errors.length) failed = true;
  }
  process.exit(failed ? 1 : 0);
}
