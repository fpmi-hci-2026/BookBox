/**
 * Рендер схем из JSON-спек.
 *
 *   node scripts/diagrams/render.mjs --all
 *   node scripts/diagrams/render.mjs scripts/diagrams/spec/menu-states.json
 *
 * Для каждой спеки пишет в docs/images/lab2:
 *   <name>.svg    — вектор для PNG;
 *   <name>.drawio — редактируемый исходник.
 *
 * Флаги:
 *   --all        все спеки из scripts/diagrams/spec
 *   --no-check   не валидировать геометрию
 *   --force      писать файлы даже при ошибках валидации
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { renderSvg, renderDrawio } from "./lib.mjs";
import { buildModel, metaOverlaySvg, metaOverlayDrawio } from "./builders.mjs";
import { checkModel } from "./check.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../../docs/images/lab2");
const SPEC_DIR = join(HERE, "spec");

export function renderSpec(spec, { outDir = OUT, check = true, force = false, quiet = false } = {}) {
  const model = buildModel(spec);
  const name = spec.name || "diagram";

  let errors = [];
  let warnings = [];
  if (check) {
    ({ errors, warnings } = checkModel(model));
    if (!quiet) {
      console.log(`${name}: ${errors.length} errors, ${warnings.length} warnings`);
      for (const e of errors) console.log(`  ✗ ${e}`);
      for (const w of warnings) console.log(`  ! ${w}`);
    }
    if (errors.length && !force) {
      console.error(`${name}: рендер остановлен (ошибки геометрии). Используй --force, чтобы записать всё равно.`);
      return { name, ok: false, errors, warnings };
    }
  }

  let svg = renderSvg(model);
  const svgExtra = metaOverlaySvg(model);
  if (svgExtra) {
    svg = svg.replace("</svg>", svgExtra + "\n</svg>");
  }

  let xml = renderDrawio(model, name);
  const drawioExtra = metaOverlayDrawio(model);
  if (drawioExtra) {
    xml = xml.replace("</root>", drawioExtra + "\n      </root>");
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${name}.svg`), svg);
  writeFileSync(join(outDir, `${name}.drawio`), xml);
  if (!quiet) {
    console.log(`  → ${name}.svg, ${name}.drawio (${model.width}×${model.height})`);
  }

  return { name, ok: true, errors, warnings };
}

export function renderAll(opts = {}) {
  const files = readdirSync(SPEC_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const results = files.map((file) => {
    const spec = JSON.parse(readFileSync(join(SPEC_DIR, file), "utf8"));
    return renderSpec(spec, opts);
  });

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`\nНе отрендерено: ${failed.map((r) => r.name).join(", ")}`);
    return false;
  }
  if (!opts.quiet) console.log(`\nГотово: ${results.length} схем.`);
  return true;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const args = process.argv.slice(2);
  const opts = {
    check: !args.includes("--no-check"),
    force: args.includes("--force"),
  };
  const paths = args.filter((a) => !a.startsWith("--"));

  let ok;
  if (args.includes("--all") || paths.length === 0) {
    ok = renderAll(opts);
  } else {
    const results = paths.map((p) => {
      const spec = JSON.parse(readFileSync(p, "utf8"));
      return renderSpec(spec, opts);
    });
    ok = results.every((r) => r.ok);
  }
  process.exit(ok ? 0 : 1);
}
