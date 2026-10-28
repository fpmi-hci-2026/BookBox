#!/usr/bin/env node
/**
 * Рендер макетов BookBox: HTML → PNG через headless Chrome.
 *
 *   node mockups/render.mjs            # все цели
 *   node mockups/render.mjs catalog    # только цели, где в имени есть "catalog"
 *
 * Перед рендером в HTML подставляется спрайт иконок (<!--ICONS-->),
 * потому что <use href="file.svg#id"> не работает на file://.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const ICONS = readFileSync(join(HERE, "icons.svg"), "utf8");
const PARTIALS = {
  "<!--HEADER-->": "partials/header.html",
  "<!--HEADER-MOBILE-->": "partials/header-mobile.html",
  "<!--FOOTER-->": "partials/footer.html",
  "<!--TABBAR-->": "partials/tabbar.html",
  "<!--INIT-->": "partials/init.html",
};

/** Цели рендера: src относительно mockups/, размеры и выходной путь. */
export const TARGETS = [
  // пилот
  { name: "catalog-wire", src: "web/catalog.html?theme=wire", width: 1440, height: 1620, out: "preview/catalog-wire.png" },
  { name: "catalog-hifi", src: "web/catalog.html?theme=hifi", width: 1440, height: 1620, out: "preview/catalog-hifi.png" },

  // веб-каркасы
  { name: "wire-web-index", autoHeight: true, src: "web/index.html?theme=wire", width: 1440, height: 1560, out: "../docs/images/lab2/wire-web-index.png" },
  { name: "wire-web-catalog", src: "web/catalog.html?theme=wire", width: 1440, height: 1620, out: "../docs/images/lab2/wire-web-catalog.png" },
  { name: "wire-web-book", autoHeight: true, src: "web/book.html?theme=wire", width: 1440, height: 1800, out: "../docs/images/lab2/wire-web-book.png" },
  { name: "wire-web-search", autoHeight: true, src: "web/search.html?theme=wire", width: 1440, height: 1180, out: "../docs/images/lab2/wire-web-search.png" },
  { name: "wire-web-cart", autoHeight: true, src: "web/cart.html?theme=wire", width: 1440, height: 1020, out: "../docs/images/lab2/wire-web-cart.png" },
  { name: "wire-web-checkout", autoHeight: true, src: "web/checkout.html?theme=wire", width: 1440, height: 1420, out: "../docs/images/lab2/wire-web-checkout.png" },
  { name: "wire-web-account", autoHeight: true, src: "web/account.html?theme=wire", width: 1440, height: 1000, out: "../docs/images/lab2/wire-web-account.png" },
  { name: "wire-web-admin", autoHeight: true, src: "web/admin.html?theme=wire", width: 1440, height: 1000, out: "../docs/images/lab2/wire-web-admin.png" },

  // мобильные каркасы
  { name: "wire-mobile-index", windowWidth: 500, cropWidth: 375, src: "mobile/index.html?theme=wire", width: 375, height: 670, out: "../docs/images/lab2/wire-mobile-index.png" },
  { name: "wire-mobile-catalog", windowWidth: 500, cropWidth: 375, src: "mobile/catalog.html?theme=wire", width: 375, height: 670, out: "../docs/images/lab2/wire-mobile-catalog.png" },
  { name: "wire-mobile-filters", windowWidth: 500, cropWidth: 375, src: "mobile/filters.html?theme=wire", width: 375, height: 670, out: "../docs/images/lab2/wire-mobile-filters.png" },
  { name: "wire-mobile-book", windowWidth: 500, cropWidth: 375, src: "mobile/book.html?theme=wire", width: 375, height: 670, out: "../docs/images/lab2/wire-mobile-book.png" },
  { name: "wire-mobile-search", windowWidth: 500, cropWidth: 375, src: "mobile/search.html?theme=wire", width: 375, height: 670, out: "../docs/images/lab2/wire-mobile-search.png" },
  { name: "wire-mobile-cart", windowWidth: 500, cropWidth: 375, src: "mobile/cart.html?theme=wire", width: 375, height: 670, out: "../docs/images/lab2/wire-mobile-cart.png" },

  { name: "contact-sheet", src: "preview/contact-sheet.html", width: 1440, height: 2400, out: "preview/contact-sheet.png" },

  // карты влияния и CJM
  { name: "impact-business", autoHeight: true, src: "../maps/impact-business.html", width: 1600, height: 900, out: "../docs/images/lab2/impact-business.png" },
  { name: "impact-user", autoHeight: true, src: "../maps/impact-user.html", width: 1600, height: 800, out: "../docs/images/lab2/impact-user.png" },
  { name: "cjm-anya", autoHeight: true, src: "../maps/cjm-anya.html", width: 1600, height: 900, out: "../docs/images/lab2/cjm-anya.png" },
  { name: "cjm-dmitry", autoHeight: true, src: "../maps/cjm-dmitry.html", width: 1600, height: 900, out: "../docs/images/lab2/cjm-dmitry.png" },
  { name: "cjm-olga", autoHeight: true, src: "../maps/cjm-olga.html", width: 1600, height: 900, out: "../docs/images/lab2/cjm-olga.png" },
  { name: "cjm-sergey", autoHeight: true, src: "../maps/cjm-sergey.html", width: 1600, height: 900, out: "../docs/images/lab2/cjm-sergey.png" },
  { name: "cjm-irina", autoHeight: true, src: "../maps/cjm-irina.html", width: 1600, height: 900, out: "../docs/images/lab2/cjm-irina.png" },
  { name: "cjm-viktor", autoHeight: true, src: "../maps/cjm-viktor.html", width: 1600, height: 900, out: "../docs/images/lab2/cjm-viktor.png" },
  { name: "maps-contact", src: "preview/maps-contact-sheet.html", width: 1440, height: 1700, out: "preview/maps-contact-sheet.png" },

  // раскадровки и совокупная диаграмма
  { name: "story-anya", autoHeight: true, src: "../storyboards/anya.html", width: 1600, height: 900, out: "../docs/images/lab2/story-anya.png" },
  { name: "story-dmitry", autoHeight: true, src: "../storyboards/dmitry.html", width: 1600, height: 900, out: "../docs/images/lab2/story-dmitry.png" },
  { name: "story-olga", autoHeight: true, src: "../storyboards/olga.html", width: 1600, height: 900, out: "../docs/images/lab2/story-olga.png" },
  { name: "story-sergey", autoHeight: true, src: "../storyboards/sergey.html", width: 1600, height: 900, out: "../docs/images/lab2/story-sergey.png" },
  { name: "story-irina", autoHeight: true, src: "../storyboards/irina.html", width: 1600, height: 900, out: "../docs/images/lab2/story-irina.png" },
  { name: "story-viktor", autoHeight: true, src: "../storyboards/viktor.html", width: 1600, height: 900, out: "../docs/images/lab2/story-viktor.png" },
  { name: "storyboards-contact", src: "preview/storyboards-contact-sheet.html", width: 1440, height: 1950, out: "preview/storyboards-contact-sheet.png" },

  // этап 7: UI-kit, сетки, цветные и тёмные макеты
  { name: "kit", autoHeight: true, src: "kit.html?theme=hifi", width: 1440, height: 1200, out: "../docs/images/lab2/kit.png" },
  { name: "grid-web", src: "web/catalog.html?theme=hifi&grid=1", width: 1440, height: 1200, out: "../docs/images/lab2/grid-web.png" },
  { name: "grid-tablet", src: "web/catalog.html?theme=hifi&grid=1", width: 980, height: 1100, out: "../docs/images/lab2/grid-tablet.png" },
  { name: "grid-mobile", windowWidth: 500, cropWidth: 375, src: "mobile/catalog.html?theme=hifi&grid=1", width: 375, height: 670, out: "../docs/images/lab2/grid-mobile.png" },

  { name: "hifi-web-index", autoHeight: true, src: "web/index.html?theme=hifi", width: 1440, height: 1500, out: "../docs/images/lab2/hifi-web-index.png" },
  { name: "hifi-web-catalog", autoHeight: true, src: "web/catalog.html?theme=hifi", width: 1440, height: 1620, out: "../docs/images/lab2/hifi-web-catalog.png" },
  { name: "hifi-web-book", autoHeight: true, src: "web/book.html?theme=hifi", width: 1440, height: 1800, out: "../docs/images/lab2/hifi-web-book.png" },
  { name: "hifi-web-checkout", autoHeight: true, src: "web/checkout.html?theme=hifi", width: 1440, height: 1400, out: "../docs/images/lab2/hifi-web-checkout.png" },
  { name: "hifi-web-account", autoHeight: true, src: "web/account.html?theme=hifi", width: 1440, height: 1000, out: "../docs/images/lab2/hifi-web-account.png" },

  { name: "hifi-mobile-index", windowWidth: 500, cropWidth: 375, src: "mobile/index.html?theme=hifi", width: 375, height: 670, out: "../docs/images/lab2/hifi-mobile-index.png" },
  { name: "hifi-mobile-catalog", windowWidth: 500, cropWidth: 375, src: "mobile/catalog.html?theme=hifi", width: 375, height: 670, out: "../docs/images/lab2/hifi-mobile-catalog.png" },
  { name: "hifi-mobile-book", windowWidth: 500, cropWidth: 375, src: "mobile/book.html?theme=hifi", width: 375, height: 670, out: "../docs/images/lab2/hifi-mobile-book.png" },
  { name: "hifi-mobile-search", windowWidth: 500, cropWidth: 375, src: "mobile/search.html?theme=hifi", width: 375, height: 670, out: "../docs/images/lab2/hifi-mobile-search.png" },
  { name: "hifi-mobile-cart", windowWidth: 500, cropWidth: 375, src: "mobile/cart.html?theme=hifi", width: 375, height: 670, out: "../docs/images/lab2/hifi-mobile-cart.png" },

  { name: "dark-web-catalog", autoHeight: true, src: "web/catalog.html?theme=dark", width: 1440, height: 1620, out: "../docs/images/lab2/dark-web-catalog.png" },
  { name: "dark-mobile-book", windowWidth: 500, cropWidth: 375, src: "mobile/book.html?theme=dark", width: 375, height: 670, out: "../docs/images/lab2/dark-mobile-book.png" },

  { name: "stage7-contact", src: "preview/stage7-contact-sheet.html", width: 1440, height: 3000, out: "preview/stage7-contact-sheet.png" },

  // эскизы
  { name: "sketch-index", src: "sketches/index.svg", width: 1000, height: 700, out: "../docs/images/lab2/sketch-index.png" },
  { name: "sketch-catalog", src: "sketches/catalog.svg", width: 1000, height: 700, out: "../docs/images/lab2/sketch-catalog.png" },
  { name: "sketch-book", src: "sketches/book.svg", width: 1000, height: 700, out: "../docs/images/lab2/sketch-book.png" },
  { name: "sketch-cart", src: "sketches/cart.svg", width: 1000, height: 700, out: "../docs/images/lab2/sketch-cart.png" },
  { name: "sketch-checkout", src: "sketches/checkout.svg", width: 1000, height: 700, out: "../docs/images/lab2/sketch-checkout.png" },
];

function buildPage(src) {
  const [file, query] = src.split("?");
  const abs = join(HERE, file);
  if (!existsSync(abs)) throw new Error(`Нет файла: ${abs}`);

  let html = readFileSync(abs, "utf8");
  if (file.endsWith(".svg")) return { path: abs, query: query ? `?${query}` : "" };
  html = html.replaceAll("<!--ICONS-->", ICONS);
  for (const [token, file] of Object.entries(PARTIALS)) {
    if (html.includes(token)) {
      html = html.replaceAll(token, readFileSync(join(HERE, file), "utf8"));
    }
  }

  // пишем рядом с исходником, чтобы относительные пути к CSS и шрифтам работали
  const out = join(dirname(abs), "." + basename(abs));
  writeFileSync(out, html);
  return { path: out, query: query ? `?${query}` : "" };
}

function measureHeight(url, width, height) {
  const dom = execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--allow-file-access-from-files",
      "--hide-scrollbars",
      `--window-size=${width},${height}`,
      "--virtual-time-budget=3000",
      "--dump-dom",
      url,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  );
  const m = dom.match(/H=(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function shoot(target) {
  const { path, query } = buildPage(target.src);
  const out = join(HERE, target.out);
  mkdirSync(dirname(out), { recursive: true });

  const url = pathToFileURL(path).href + query;

  let width = target.width;
  let height = target.height;
  if (target.autoHeight) {
    const sep = query ? "&" : "?";
    const measured = measureHeight(url + sep + "measure=1", target.windowWidth || target.width, target.height);
    if (measured) height = measured + 2;
  }

  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--allow-file-access-from-files",
      "--run-all-compositor-stages-before-draw",
      "--virtual-time-budget=3000",
      "--force-device-scale-factor=2",
      `--window-size=${target.windowWidth || width},${height}`,
      `--screenshot=${out}`,
      url,
    ],
    { stdio: "ignore" }
  );

  if (target.cropWidth) {
    const scale = 2;
    const cropW = target.cropWidth * scale;
    const pngW = (target.windowWidth || width) * scale;
    const offsetX = Math.round((pngW - cropW) / 2);
    execFileSync("sips", ["-c", String(height * scale), String(cropW), "--cropOffset", "0", String(offsetX), out], {
      stdio: "ignore",
    });
  }

  console.log(`${target.name}: ${target.width}×${height} → ${target.out}`);
}

const filters = process.argv.slice(2);
const selected = filters.length
  ? TARGETS.filter((t) => filters.some((f) => t.name.includes(f)))
  : TARGETS;

if (!selected.length) {
  console.error("Ничего не выбрано. Доступно:", TARGETS.map((t) => t.name).join(", "));
  process.exit(1);
}

for (const target of selected) shoot(target);
console.log(`Готово: ${selected.length} шт.`);
