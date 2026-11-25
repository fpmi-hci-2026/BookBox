import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const spec = path.join(root, 'docs/lab4/openapi.yaml');
const prismBin = path.join(root, 'node_modules/@stoplight/prism-cli/dist/index.js');
const port = Number(process.env.MOCK_PORT || 4010);
const base = `http://127.0.0.1:${port}`;
const resultsFile = path.join(root, 'docs/lab4/mock-test-results.json');

const ids = {
  book: '3f2b6c1e-8a4d-4c7e-9b1a-2d5e8f7a6c01',
  order: 'd4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70',
  payment: 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7081',
  preorder: 'f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192',
  notification: 'a7b8c9d0-e1f2-4a3b-8c4d-5e6f708192a3',
  review: 'b8c9d0e1-f2a3-4b4c-9d5e-6f708192a3b4',
  missing: '00000000-0000-4000-8000-000000000000',
  idempotency: '1f0e9d8c-7b6a-4c5d-8e9f-0a1b2c3d4e5f',
};

const buyerAuth = { Authorization: 'Bearer mock-buyer-token' };
const adminAuth = { Authorization: 'Bearer mock-admin-token' };
const analystAuth = { Authorization: 'Bearer mock-analyst-token' };
const providerAuth = {
  'X-Provider-Signature': 'sha256=8c1f0a9d4e2b7a6c5d3e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c',
};

const orderBody = {
  delivery: {
    method: 'courier',
    city: 'Москва',
    street: 'Тверская',
    house: '12',
    apartment: '34',
    recipientName: 'Анна Смирнова',
  },
  giftWrap: true,
};

const cases = [
  // Каталог и поиск
  { id: 'catalog-search', flow: 'Поиск', method: 'GET', path: '/books?q=булгаков&inStock=true&sort=price_asc', expect: 200 },
  { id: 'catalog-book', flow: 'Карточка книги', method: 'GET', path: `/books/${ids.book}`, expect: 200 },
  { id: 'catalog-not-found', flow: 'Карточка книги', method: 'GET', path: `/books/${ids.missing}`, expect: 404, preferCode: 404 },
  { id: 'catalog-reviews', flow: 'Отзывы книги', method: 'GET', path: `/books/${ids.book}/reviews`, expect: 200 },
  { id: 'catalog-genres', flow: 'Справочники', method: 'GET', path: '/genres', expect: 200 },
  { id: 'catalog-publishers', flow: 'Справочники', method: 'GET', path: '/publishers', expect: 200 },

  // Регистрация и вход
  {
    id: 'auth-register',
    flow: 'Регистрация',
    method: 'POST',
    path: '/auth/register',
    body: { email: 'anna@example.com', password: 'CorrectHorse42', displayName: 'Анна Смирнова', phone: '+7 999 123-45-67' },
    expect: 201,
  },
  {
    id: 'auth-register-conflict',
    flow: 'Регистрация',
    method: 'POST',
    path: '/auth/register',
    body: { email: 'anna@example.com', password: 'CorrectHorse42', displayName: 'Анна Смирнова' },
    expect: 409,
    preferCode: 409,
  },
  {
    id: 'auth-login',
    flow: 'Вход',
    method: 'POST',
    path: '/auth/login',
    body: { email: 'anna@example.com', password: 'CorrectHorse42' },
    expect: 200,
  },
  {
    id: 'auth-login-failed',
    flow: 'Вход',
    method: 'POST',
    path: '/auth/login',
    body: { email: 'anna@example.com', password: 'wrong-password' },
    expect: 401,
    preferCode: 401,
  },
  { id: 'account-me', flow: 'Профиль', method: 'GET', path: '/me', headers: buyerAuth, expect: 200 },
  {
    id: 'account-update',
    flow: 'Профиль',
    method: 'PATCH',
    path: '/me',
    headers: buyerAuth,
    body: { displayName: 'Анна Смирнова', phone: '+7 999 765-43-21' },
    expect: 200,
  },

  // Корзина и избранное
  { id: 'cart-get', flow: 'Корзина', method: 'GET', path: '/me/cart', headers: buyerAuth, expect: 200 },
  {
    id: 'cart-upsert',
    flow: 'Корзина',
    method: 'PUT',
    path: `/me/cart/items/${ids.book}`,
    headers: buyerAuth,
    body: { quantity: 2 },
    expect: 200,
  },
  { id: 'favorites-add', flow: 'Избранное', method: 'PUT', path: `/me/favorites/${ids.book}`, headers: buyerAuth, expect: 204 },
  { id: 'favorites-list', flow: 'Избранное', method: 'GET', path: '/me/favorites', headers: buyerAuth, expect: 200 },

  // Заказы и оплата
  { id: 'orders-list', flow: 'История заказов', method: 'GET', path: '/me/orders?status=pending_payment', headers: buyerAuth, expect: 200 },
  { id: 'orders-create', flow: 'Оформление заказа', method: 'POST', path: '/me/orders', headers: buyerAuth, body: orderBody, expect: 201 },
  {
    id: 'orders-stock-conflict',
    flow: 'Оформление заказа',
    method: 'POST',
    path: '/me/orders',
    headers: buyerAuth,
    body: orderBody,
    expect: 409,
    preferCode: 409,
  },
  { id: 'orders-get', flow: 'Детали заказа', method: 'GET', path: `/me/orders/${ids.order}`, headers: buyerAuth, expect: 200 },
  {
    id: 'payment-create',
    flow: 'Оплата',
    method: 'POST',
    path: `/me/orders/${ids.order}/payment-attempts`,
    headers: { ...buyerAuth, 'Idempotency-Key': ids.idempotency },
    body: { method: 'card', returnUrl: `https://bookbox.example/orders/${ids.order}` },
    expect: 201,
    preferCode: 201,
  },
  {
    id: 'payment-replay',
    flow: 'Повтор оплаты',
    method: 'POST',
    path: `/me/orders/${ids.order}/payment-attempts`,
    headers: { ...buyerAuth, 'Idempotency-Key': ids.idempotency },
    body: { method: 'card', returnUrl: `https://bookbox.example/orders/${ids.order}` },
    expect: 200,
    preferCode: 200,
  },
  {
    id: 'payment-provider-result',
    flow: 'Результат провайдера',
    method: 'POST',
    path: `/payments/${ids.payment}/result`,
    headers: providerAuth,
    body: { status: 'succeeded', providerReference: 'pay_9f8e7d6c5b4a', amount: 2580.0 },
    expect: 200,
  },
  {
    id: 'payment-wrong-state',
    flow: 'Оплата',
    method: 'POST',
    path: `/me/orders/${ids.order}/payment-attempts`,
    headers: { ...buyerAuth, 'Idempotency-Key': ids.idempotency },
    body: { method: 'card' },
    expect: 409,
    preferCode: 409,
  },

  // Предзаказы и уведомления
  { id: 'preorders-list', flow: 'Предзаказы', method: 'GET', path: '/me/preorders?status=waiting', headers: buyerAuth, expect: 200 },
  {
    id: 'preorders-create',
    flow: 'Предзаказ',
    method: 'POST',
    path: '/me/preorders',
    headers: buyerAuth,
    body: { bookId: '4a3c7d2f-9b5e-4d8f-8c2b-3e6f907182b3' },
    expect: 201,
  },
  {
    id: 'preorders-duplicate',
    flow: 'Предзаказ',
    method: 'POST',
    path: '/me/preorders',
    headers: buyerAuth,
    body: { bookId: '4a3c7d2f-9b5e-4d8f-8c2b-3e6f907182b3' },
    expect: 409,
    preferCode: 409,
  },
  { id: 'preorders-cancel', flow: 'Предзаказ', method: 'DELETE', path: `/me/preorders/${ids.preorder}`, headers: buyerAuth, expect: 204 },
  { id: 'notifications-list', flow: 'Уведомления', method: 'GET', path: '/me/notifications?unreadOnly=true', headers: buyerAuth, expect: 200 },
  {
    id: 'notifications-read',
    flow: 'Уведомления',
    method: 'PATCH',
    path: `/me/notifications/${ids.notification}`,
    headers: buyerAuth,
    body: { isRead: true },
    expect: 200,
  },

  // Отзывы и модерация
  {
    id: 'reviews-create',
    flow: 'Отзыв',
    method: 'POST',
    path: `/books/${ids.book}/reviews`,
    headers: buyerAuth,
    body: { rating: 5, body: 'Одна из лучших книг, которые я читала.' },
    expect: 201,
  },
  {
    id: 'reviews-invalid-rating',
    flow: 'Отзыв',
    method: 'POST',
    path: `/books/${ids.book}/reviews`,
    headers: buyerAuth,
    body: { rating: 6, body: 'Оценка вне диапазона' },
    expect: 422,
    validateBody: true,
  },
  { id: 'reviews-moderation-list', flow: 'Модерация', method: 'GET', path: '/admin/reviews?moderationStatus=pending', headers: adminAuth, expect: 200 },
  {
    id: 'reviews-moderate',
    flow: 'Модерация',
    method: 'PATCH',
    path: `/admin/reviews/${ids.review}`,
    headers: adminAuth,
    body: { moderationStatus: 'published' },
    expect: 200,
  },

  // Администрирование
  {
    id: 'admin-book-create',
    flow: 'Администрирование',
    method: 'POST',
    path: '/admin/books',
    headers: adminAuth,
    body: {
      title: 'Тихий Дон',
      isbn: '978-5-17-123456-7',
      publisherId: '7c9e2d4a-1b3f-4e5a-8c6d-9f0a1b2c3d4e',
      authorIds: ['a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'],
      genreIds: ['b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'],
      publicationYear: 2025,
      price: 1450.0,
      stock: 8,
      preorderEnabled: false,
    },
    expect: 201,
  },
  {
    id: 'admin-forbidden',
    flow: 'Запрет доступа',
    method: 'POST',
    path: '/admin/books',
    headers: buyerAuth,
    body: { title: 'Запрещённая операция', publisherId: '7c9e2d4a-1b3f-4e5a-8c6d-9f0a1b2c3d4e', price: 100, stock: 1 },
    expect: 403,
    preferCode: 403,
  },
  {
    id: 'admin-book-update',
    flow: 'Администрирование',
    method: 'PATCH',
    path: `/admin/books/${ids.book}`,
    headers: adminAuth,
    body: { price: 1390.0, stock: 10, preorderEnabled: true },
    expect: 200,
  },
  { id: 'admin-ship', flow: 'Передача в доставку', method: 'POST', path: `/admin/orders/${ids.order}/ship`, headers: adminAuth, expect: 200 },
  { id: 'admin-ship-replay', flow: 'Передача в доставку', method: 'POST', path: `/admin/orders/${ids.order}/ship`, headers: adminAuth, expect: 200 },

  // Аналитика
  { id: 'analytics-report', flow: 'Аналитика', method: 'GET', path: '/analytics/sales?from=2026-11-01&to=2026-11-30&groupBy=day', headers: analystAuth, expect: 200 },
  {
    id: 'analytics-invalid-period',
    flow: 'Аналитика',
    method: 'GET',
    path: '/analytics/sales?from=2026-12-01&to=2026-11-01',
    headers: analystAuth,
    expect: 400,
    preferCode: 400,
  },
  {
    id: 'analytics-forbidden',
    flow: 'Аналитика',
    method: 'GET',
    path: '/analytics/sales?from=2026-11-01&to=2026-11-30',
    headers: buyerAuth,
    expect: 403,
    preferCode: 403,
  },
  {
    id: 'analytics-export',
    flow: 'Экспорт CSV',
    method: 'GET',
    path: '/analytics/sales/export?from=2026-11-01&to=2026-11-30&groupBy=day',
    headers: analystAuth,
    expect: 200,
    expectContentType: 'text/csv',
  },
];

function startMock() {
  const child = spawn(process.execPath, [prismBin, 'mock', spec, '--port', String(port)], {
    cwd: root,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (chunk) => { log += chunk.toString(); });
  child.stderr.on('data', (chunk) => { log += chunk.toString(); });
  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`Mock-сервер завершился с кодом ${code}.\n${log}`);
    }
  });
  return child;
}

async function waitForMock() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${base}/books`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      // Сервер ещё запускается.
    }
    await delay(250);
  }
  throw new Error('Mock-сервер не ответил за 30 секунд.');
}

async function runCase(testCase) {
  const headers = { Accept: 'application/json, application/problem+json, text/csv', ...(testCase.headers || {}) };
  if (testCase.body !== undefined) headers['Content-Type'] = 'application/json';
  if (testCase.preferCode) headers.Prefer = `code=${testCase.preferCode}`;

  const response = await fetch(`${base}${testCase.path}`, {
    method: testCase.method,
    headers,
    body: testCase.body === undefined ? undefined : JSON.stringify(testCase.body),
    signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const statusOk = response.status === testCase.expect;
  const typeOk = !testCase.expectContentType || contentType.toLowerCase().startsWith(testCase.expectContentType);
  return {
    id: testCase.id,
    flow: testCase.flow,
    method: testCase.method,
    path: testCase.path,
    expectedStatus: testCase.expect,
    actualStatus: response.status,
    contentType,
    passed: statusOk && typeOk,
    note: !statusOk
      ? `Ожидался ${testCase.expect}, получен ${response.status}`
      : !typeOk
        ? `Ожидался Content-Type ${testCase.expectContentType}, получен ${contentType}`
        : testCase.validateBody
          ? 'Ошибка валидации тела воспроизведена Mock-сервером'
          : testCase.preferCode
            ? `Статус ${testCase.expect} выбран через Prefer: code=${testCase.preferCode}`
            : 'Успешный сценарий',
    responsePreview: text.slice(0, 240),
  };
}

const mock = startMock();
let exitCode = 0;
try {
  await waitForMock();
  const runStartedAt = new Date().toISOString();
  const results = [];
  for (const testCase of cases) {
    try {
      results.push(await runCase(testCase));
    } catch (error) {
      results.push({
        id: testCase.id,
        flow: testCase.flow,
        method: testCase.method,
        path: testCase.path,
        expectedStatus: testCase.expect,
        actualStatus: null,
        passed: false,
        note: `Ошибка выполнения: ${error.message}`,
        responsePreview: '',
      });
    }
  }

  const failed = results.filter((result) => !result.passed);
  exitCode = failed.length > 0 ? 1 : 0;

  console.log('');
  console.log('| # | Поток | Запрос | Ожидался | Получен | Результат |');
  console.log('|---|---|---|---|---|---|');
  results.forEach((result, index) => {
    console.log(`| ${index + 1} | ${result.flow} | \`${result.method} ${result.path}\` | ${result.expectedStatus} | ${result.actualStatus ?? '—'} | ${result.passed ? 'PASS' : 'FAIL'} |`);
  });
  console.log('');
  console.log(`Всего: ${results.length}; успешно: ${results.length - failed.length}; провалов: ${failed.length}.`);

  const payload = {
    generatedAt: new Date().toISOString(),
    startedAt: runStartedAt,
    mockServer: `Prism 5.16.0, http://127.0.0.1:${port}`,
    spec: 'docs/lab4/openapi.yaml',
    summary: { total: results.length, passed: results.length - failed.length, failed: failed.length },
    results,
  };
  await writeFile(resultsFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Результаты сохранены: ${path.relative(root, resultsFile)}`);
} finally {
  mock.kill();
  await delay(300);
}

process.exitCode = exitCode;
