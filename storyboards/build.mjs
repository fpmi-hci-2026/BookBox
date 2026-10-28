#!/usr/bin/env node
/**
 * Генератор интерактивных раскадровок BookBox.
 * Выход: storyboards/*.html (рендер — mockups/render.mjs).
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));

const page = (title, body) => `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <link rel="stylesheet" href="../mockups/fonts.css">
  <link rel="stylesheet" href="../mockups/tokens.css">
  <link rel="stylesheet" href="storyboards.css">
</head>
<body>
${body}
<script>
  if (new URLSearchParams(location.search).get("measure") === "1") {
    window.addEventListener("load", function () {
      document.title = "H=" + document.documentElement.scrollHeight;
    });
  }
</script>
</body>
</html>
`;

function screen(s, small = false) {
  const cls = [
    "screen",
    s.kind === "success" ? "screen--success" : "",
    s.kind === "error" ? "screen--error" : "",
    s.kind === "exit" ? "screen--exit" : "",
    s.kind === "admin" ? "screen--admin" : "",
    !small && s.mobile ? "screen--mobile" : "",
  ]
    .filter(Boolean)
    .join(" ");

  let body;
  if (s.kind === "success") body = `<div class="s-check">✓</div>`;
  else if (s.kind === "error") body = `<div class="s-cross">✕</div>`;
  else if (s.kind === "form") {
    body = `<div class="s-body s-body--lines"><i></i><i></i><i></i><i></i></div>`;
  } else {
    body = `<div class="s-body"></div>`;
  }

  return `<div class="${cls}">
      <div class="s-head"><i></i><i></i><i></i><b></b></div>
      <div class="s-title"></div>
      ${body}
      <div class="s-btn"></div>
    </div>`;
}

function stepsHtml(steps) {
  return steps
    .map((s, i) => {
      const arrow =
        i < steps.length - 1
          ? `<div class="arrow">→</div>`
          : "";
      return `<div class="step">
      ${screen(s)}
      <div class="cap"><b>${s.title}</b><span>${s.action || ""}</span></div>
    </div>${arrow}`;
    })
    .join("\n    ");
}

function branchHtml(b) {
  const screens = b.screens
    .map(
      (s, i) =>
        `<div class="b-step">${screen(s, true)}<span class="b-cap">${s.title}</span></div>${
          i < b.screens.length - 1 ? `<div class="arrow">→</div>` : ""
        }`
    )
    .join("");
  const badge = b.type === "alt" ? "Альтернатива" : "Исключение";
  return `<div class="branch">
      <span class="badge badge--${b.type}">${badge}</span>
      <span class="from">из «${b.from}»</span>
      ${screens}
      <span class="note">${b.note}</span>
    </div>`;
}

function storyboard(sb) {
  return `<h1>Раскадровка: ${sb.name}</h1>
<p class="sub">${sb.subtitle}</p>
<div class="meta">${sb.meta.map((m) => `<span>${m}</span>`).join("")}</div>

<div class="path">
    ${stepsHtml(sb.steps)}
</div>

<div class="branches">
  <h3>Альтернативы и исключения</h3>
  ${sb.branches.map(branchHtml).join("\n  ")}
</div>

<div class="legend"><span><b>→</b> основной путь</span><span><b>Альтернатива</b> — другой путь к цели</span><span><b>Исключение</b> — что делать, если что-то пошло не так</span></div>`;
}

/* ------------------------------------------------------------------ */
/* Данные                                                              */
/* ------------------------------------------------------------------ */

const boards = [
  {
    file: "anya",
    name: "Аня",
    subtitle: "студентка, 20 лет · мобильное приложение · цена и скорость",
    meta: ["Мобильное приложение", "Ограниченное время", "Бюджет 30 BYN"],
    steps: [
      { title: "Приложение", action: "запускает", mobile: true },
      { title: "Главная", action: "поиск и скидки", mobile: true },
      { title: "Поиск", action: "«математический анализ»", mobile: true },
      { title: "Выдача", action: "фильтр до 30 BYN", mobile: true },
      { title: "Карточка", action: "описание и отзывы", mobile: true },
      { title: "Корзина", action: "1 книга", mobile: true },
      { title: "Checkout", action: "адрес и карта", kind: "form", mobile: true },
      { title: "Заказ принят", action: "номер заказа", kind: "success", mobile: true },
    ],
    branches: [
      {
        type: "alt",
        from: "Выдача",
        screens: [
          { title: "Скидки студентам" },
          { title: "Карточка" },
        ],
        note: "если книги до 30 BYN нет — смотрит подборку со скидкой.",
      },
      {
        type: "exc",
        from: "Карточка",
        screens: [
          { title: "Нет в наличии", kind: "error" },
          { title: "Подписка" },
        ],
        note: "сообщим, когда книга появится.",
      },
      {
        type: "exc",
        from: "Checkout",
        screens: [
          { title: "Нет интернета", kind: "error" },
          { title: "Офлайн-корзина" },
        ],
        note: "заказ можно завершить позже.",
      },
    ],
  },
  {
    file: "dmitry",
    name: "Дмитрий",
    subtitle: "менеджер, 30 лет · веб-версия · подарок за пару минут",
    meta: ["Ноутбук", "Вечер дома", "Готов платить за удобство"],
    steps: [
      { title: "Главная", action: "открывает веб" },
      { title: "Подборки", action: "идея подарка" },
      { title: "Карточка", action: "рейтинг и отзывы" },
      { title: "Корзина", action: "1 книга" },
      { title: "Checkout", action: "упаковка", kind: "form" },
      { title: "Адрес", action: "адрес коллеги", kind: "form" },
      { title: "Оплата", action: "картой", kind: "form" },
      { title: "Заказ принят", action: "уведомление", kind: "success" },
    ],
    branches: [
      {
        type: "alt",
        from: "Карточка",
        screens: [{ title: "Checkout" }, { title: "Заказ принят", kind: "success" }],
        note: "«Купить в 1 клик» — без корзины и повторного ввода.",
      },
      {
        type: "exc",
        from: "Оплата",
        screens: [
          { title: "Ошибка оплаты", kind: "error" },
          { title: "Другой способ" },
        ],
        note: "пробует ЕРИП или оплату при получении.",
      },
    ],
  },
  {
    file: "olga",
    name: "Ольга Петровна",
    subtitle: "преподаватель, 48 лет · веб-версия · точный поиск и предзаказ",
    meta: ["Ноутбук", "Проводной интернет", "Есть время"],
    steps: [
      { title: "Главная", action: "открывает веб" },
      { title: "Расширенный поиск", action: "автор", kind: "form" },
      { title: "Фильтры", action: "издательство и год", kind: "form" },
      { title: "Выдача", action: "список" },
      { title: "Карточка", action: "характеристики" },
      { title: "Предзаказ", action: "нет в наличии", kind: "form" },
      { title: "Уведомление", action: "о поступлении" },
      { title: "Оплата", action: "и получение", kind: "success" },
    ],
    branches: [
      {
        type: "exc",
        from: "Карточка",
        screens: [
          { title: "Не издаётся", kind: "error" },
          { title: "Электронная версия" },
        ],
        note: "предлагаем доступную альтернативу.",
      },
      {
        type: "alt",
        from: "Карточка",
        screens: [{ title: "Подписка" }],
        note: "подписка на новинки жанра вместо разового заказа.",
      },
    ],
  },
  {
    file: "sergey",
    name: "Сергей",
    subtitle: "администратор, 33 года · админ-панель · каталог и заказы",
    meta: ["Два монитора", "Офис", "Плотный поток"],
    steps: [
      { title: "/admin", action: "вход", kind: "admin" },
      { title: "Книги", action: "список", kind: "admin" },
      { title: "Добавить", action: "поля и обложка", kind: "form" },
      { title: "Валидация", action: "жанр, ISBN, цена", kind: "form" },
      { title: "Сохранено", action: "книга в каталоге", kind: "success" },
    ],
    branches: [
      {
        type: "alt",
        from: "/admin",
        screens: [
          { title: "Заказы", kind: "admin" },
          { title: "Заказ", kind: "admin" },
          { title: "Подтвердить", kind: "admin" },
          { title: "В доставку", kind: "success" },
        ],
        note: "вторая ветка — обработка заказов.",
      },
      {
        type: "exc",
        from: "Валидация",
        screens: [
          { title: "Ошибка", kind: "error" },
          { title: "Подсветка поля" },
        ],
        note: "исправляет и сохраняет повторно.",
      },
    ],
  },
  {
    file: "irina",
    name: "Ирина",
    subtitle: "владелец, 41 год · аналитика · решения по ассортименту",
    meta: ["Ноутбук", "Редкие сессии", "Нужны цифры"],
    steps: [
      { title: "/admin", action: "вход", kind: "admin" },
      { title: "Аналитика", action: "раздел", kind: "admin" },
      { title: "Период", action: "месяц", kind: "form" },
      { title: "Отчёт", action: "продажи и топы" },
      { title: "Экспорт", action: "CSV для команды" },
    ],
    branches: [
      {
        type: "alt",
        from: "Отчёт",
        screens: [{ title: "Решения" }],
        note: "если экспорт не нужен — сразу решения.",
      },
      {
        type: "exc",
        from: "Отчёт",
        screens: [{ title: "Нет данных", kind: "error" }],
        note: "сменить период или проверить заказы.",
      },
    ],
  },
  {
    file: "viktor",
    name: "Виктор",
    subtitle: "инженер, 38 лет · анти-персонаж · без онлайн-оплаты",
    meta: ["Старый компьютер", "Недоверие", "Оплата при получении"],
    steps: [
      { title: "Сайт", action: "заходит" },
      { title: "Поиск", action: "книга" },
      { title: "Карточка", action: "цена" },
      { title: "Оплата", action: "способы", kind: "form" },
      { title: "Заказ", action: "оплата при получении", kind: "form" },
      { title: "Получение", action: "платит курьеру", kind: "success" },
    ],
    branches: [
      {
        type: "exc",
        from: "Оплата",
        screens: [
          { title: "Нет оплаты при получении", kind: "error" },
          { title: "Уход", kind: "exit" },
        ],
        note: "ищет другой магазин — единственная точка удержания.",
      },
      {
        type: "alt",
        from: "Заказ",
        screens: [{ title: "Получение", kind: "success" }],
        note: "без онлайн-оплаты заказ завершается.",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Запись                                                              */
/* ------------------------------------------------------------------ */

for (const b of boards) {
  writeFileSync(
    join(OUT, `${b.file}.html`),
    page(`BookBox — раскадровка: ${b.name}`, storyboard(b))
  );
  console.log(`storyboard: ${b.file}.html`);
}

const hub = `<h1>Интерактивные раскадровки</h1>
<p class="sub">Шесть ключевых сценариев по персонажам. Каждый экран связан с соседним переходом; альтернативы и исключения показаны отдельными ветками. Исходники кликабельны.</p>
<div class="hub">
${boards
  .map(
    (b) =>
      `<a href="${b.file}.html"><h3>${b.name}</h3><p>${b.subtitle}</p></a>`
  )
  .join("\n")}
</div>`;

writeFileSync(join(OUT, "index.html"), page("BookBox — раскадровки", hub));
console.log("storyboard: index.html");
