# ЛР4, задание 4. Mock-сервер и проверка API

## Что сделано

- Разработан контракт [OpenAPI 3.0.3](openapi.yaml) для всех маршрутов задания 3.
- Для каждого POST, PUT и PATCH определены тело запроса, схема успешного ответа, примеры и коды ошибок.
- Поднят Mock-сервер на основе контракта и прогнаны 43 проверки: успешные и ошибочные сценарии поиска, аккаунта, корзины, заказа, оплаты, предзаказа, отзывов, администрирования и аналитики.
- Все 43 проверки пройдены; машинный протокол сохранён в [mock-test-results.json](mock-test-results.json).

## Выбранный инструмент

Использован **Prism 5.16.0** — Mock-сервер, который читает OpenAPI-файл и отвечает примерами из спецификации. Такой вариант выбран потому, что он:

- не требует внешней учётной записи и работает локально;
- использует тот же контракт, который можно импортировать в SwaggerHub, Postman или Bruno;
- проверяет запросы по схемам и возвращает `422` при нарушении валидации;
- позволяет воспроизвести нужный код ответа заголовком `Prefer: code=...`.

Контракт совместим со SwaggerHub и Bruno; порядок импорта описан ниже.

## Запуск

Требования: Node.js 24+, npm 11+.

```bash
npm install
npm run mock:api
```

Mock-сервер запускается на `http://127.0.0.1:4010`. Во втором терминале:

```bash
npm run test:api
```

Команда `test:api` сама запускает Mock-сервер, выполняет 43 запроса, печатает таблицу `PASS/FAIL` и перезаписывает [mock-test-results.json](mock-test-results.json). Если Mock-сервер уже запущен вручную, второй экземпляр не нужен: остановите его перед запуском теста, чтобы порт `4010` был свободен.

Интерактивная документация:

```bash
python -m http.server 8080 -d docs
```

Затем откройте `http://localhost:8080/lab4/api.html`. На GitHub Pages после публикации ветки: `https://fpmi-hci-2026.github.io/BookBox/lab4/api.html`.

## Импорт контракта в SwaggerHub / Bruno / Postman

### SwaggerHub

1. Создать аккаунт и нажать **Create New API** → **Import API**.
2. Выбрать OpenAPI 3.0 и загрузить [openapi.yaml](openapi.yaml).
3. Владелец и имя API: например, `bookbox-api`, версия `1.0.0`.
4. Включить **Auto Mocking**. SwaggerHub создаст Mock-сервер и покажет базовый URL вида `https://virtserver.swaggerhub.com/<owner>/bookbox-api/1.0.0`.
5. Проверить запросы в разделе **Mock Server** или через `curl`, подставив URL SwaggerHub.

### Bruno

1. Установить Bruno и создать коллекцию **BookBox API**.
2. **Import Collection** → **OpenAPI** → выбрать `docs/lab4/openapi.yaml`.
3. Создать окружение с `baseUrl = http://127.0.0.1:4010` (или URL Mock-сервера Bruno).
4. Включить Mock Server для коллекции и выполнить запросы из папок `Catalog`, `Auth`, `Orders`, `Admin`, `Analytics`.

### Postman

1. **Import** → **OpenAPI 3.0** → выбрать `openapi.yaml`.
2. Создать Mock Server из импортированной коллекции: **Collections** → **Mock** → **Create Mock Server**.
3. Заменить `baseUrl` на выданный Mock URL и выполнить запросы.

## Примеры запросов

### Поиск книг

```bash
curl "http://127.0.0.1:4010/books?q=булгаков&inStock=true&sort=price_asc"
```

Ожидается `200` и список книг с издательством, авторами, жанрами, ценой, остатком и рейтингом.

### Регистрация и вход

```bash
curl -X POST http://127.0.0.1:4010/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"anna@example.com","password":"CorrectHorse42","displayName":"Анна Смирнова"}'
```

```bash
curl -X POST http://127.0.0.1:4010/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"anna@example.com","password":"CorrectHorse42"}'
```

Ожидается `201` для регистрации и `200` для входа; в ответе JWT и профиль без пароля.

### Корзина

```bash
curl -X PUT http://127.0.0.1:4010/me/cart/items/3f2b6c1e-8a4d-4c7e-9b1a-2d5e8f7a6c01 \
  -H "Authorization: Bearer mock-buyer-token" \
  -H "Content-Type: application/json" \
  -d '{"quantity":2}'
```

Ожидается `200` и корзина с пересчитанными `lineTotal` и `subtotal`.

### Оформление заказа

```bash
curl -X POST http://127.0.0.1:4010/me/orders \
  -H "Authorization: Bearer mock-buyer-token" \
  -H "Content-Type: application/json" \
  -d '{"delivery":{"method":"courier","city":"Москва","street":"Тверская","house":"12","apartment":"34","recipientName":"Анна Смирнова"},"giftWrap":true}'
```

Ожидается `201` и заказ в статусе `pending_payment`. Ошибочный сценарий нехватки остатка воспроизводится заголовком `Prefer: code=409` и возвращает `application/problem+json` со списком `unavailableItems`.

### Оплата и повтор оплаты

```bash
curl -X POST http://127.0.0.1:4010/me/orders/d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70/payment-attempts \
  -H "Authorization: Bearer mock-buyer-token" \
  -H "Idempotency-Key: 1f0e9d8c-7b6a-4c5d-8e9f-0a1b2c3d4e5f" \
  -H "Content-Type: application/json" \
  -d '{"method":"card","returnUrl":"https://bookbox.example/orders/d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70"}'
```

Первый запрос — `201`, повтор с тем же `Idempotency-Key` — `200` и заголовок `Idempotent-Replayed: true`. В Mock-сервере повтор воспроизводится через `Prefer: code=200`; реальную идемпотентность обеспечивает серверная транзакция.

### Предзаказ

```bash
curl -X POST http://127.0.0.1:4010/me/preorders \
  -H "Authorization: Bearer mock-buyer-token" \
  -H "Content-Type: application/json" \
  -d '{"bookId":"4a3c7d2f-9b5e-4d8f-8c2b-3e6f907182b3"}'
```

Ожидается `201`; повторный активный предзаказ — `409`, книга без `preorderEnabled` — `409`.

### Запрет административного доступа

```bash
curl -X POST http://127.0.0.1:4010/admin/books \
  -H "Authorization: Bearer mock-buyer-token" \
  -H "Prefer: code=403" \
  -H "Content-Type: application/json" \
  -d '{"title":"Запрещённая операция","publisherId":"7c9e2d4a-1b3f-4e5a-8c6d-9f0a1b2c3d4e","price":100,"stock":1}'
```

Ожидается `403` и `application/problem+json` с кодом `forbidden`.

### Аналитика и CSV

```bash
curl "http://127.0.0.1:4010/analytics/sales?from=2026-11-01&to=2026-11-30&groupBy=day" \
  -H "Authorization: Bearer mock-analyst-token"
```

```bash
curl "http://127.0.0.1:4010/analytics/sales/export?from=2026-11-01&to=2026-11-30&groupBy=day" \
  -H "Authorization: Bearer mock-analyst-token"
```

Первая команда возвращает JSON-отчёт, вторая — `text/csv` с теми же периодом и группировкой.

## Результаты проверки

Дата прогона: **25 ноября 2026 года**. Окружение: Windows 11, Node.js 24.10.0, npm 11.11.0, Prism 5.16.0. Итог: **43 из 43 проверок пройдены**.

| Поток | Успешный сценарий | Ошибочный сценарий | Результат |
|---|---|---|---|
| Поиск и каталог | `GET /books?q=...` → 200 | `GET /books/{id}` несуществующей книги → 404 | PASS |
| Справочники | `GET /genres`, `GET /publishers` → 200 | — | PASS |
| Регистрация | `POST /auth/register` → 201 | повтор email → 409 | PASS |
| Вход | `POST /auth/login` → 200 | неверный пароль → 401 | PASS |
| Профиль | `GET /me`, `PATCH /me` → 200 | — | PASS |
| Корзина | `PUT /me/cart/items/{bookId}` → 200 | — | PASS |
| Избранное | `PUT /me/favorites/{bookId}` → 204 | — | PASS |
| Создание заказа | `POST /me/orders` → 201 | нехватка остатка → 409 | PASS |
| История и детали | `GET /me/orders`, `GET /me/orders/{id}` → 200 | — | PASS |
| Оплата | `POST .../payment-attempts` → 201 | заказ уже оплачен → 409 | PASS |
| Повтор оплаты | тот же `Idempotency-Key` → 200 | — | PASS |
| Результат провайдера | `POST /payments/{id}/result` → 200 | — | PASS |
| Предзаказ | `POST /me/preorders` → 201 | дубликат → 409 | PASS |
| Отмена предзаказа | `DELETE /me/preorders/{id}` → 204 | — | PASS |
| Уведомления | `GET`, `PATCH /me/notifications/{id}` → 200 | — | PASS |
| Отзывы | `POST /books/{id}/reviews` → 201 | оценка 6 → 422 | PASS |
| Модерация | `GET /admin/reviews`, `PATCH /admin/reviews/{id}` → 200 | — | PASS |
| Администрирование | `POST /admin/books` → 201, `PATCH` → 200 | роль покупателя → 403 | PASS |
| Доставка | `POST /admin/orders/{id}/ship` → 200; повтор → 200 | — | PASS |
| Аналитика | `GET /analytics/sales` → 200 | период из будущего в прошлое → 400; роль покупателя → 403 | PASS |
| Экспорт CSV | `GET /analytics/sales/export` → 200, `text/csv` | — | PASS |

<details>
<summary>Полный протокол: 43 проверки</summary>

| # | Поток | Запрос | Ожидался | Получен | Результат |
|---|---|---|---|---|---|
| 1 | Поиск | `GET /books?q=булгаков&inStock=true&sort=price_asc` | 200 | 200 | PASS |
| 2 | Карточка книги | `GET /books/3f2b6c1e-8a4d-4c7e-9b1a-2d5e8f7a6c01` | 200 | 200 | PASS |
| 3 | Карточка книги | `GET /books/00000000-0000-4000-8000-000000000000` | 404 | 404 | PASS |
| 4 | Отзывы книги | `GET /books/3f2b6c1e-8a4d-4c7e-9b1a-2d5e8f7a6c01/reviews` | 200 | 200 | PASS |
| 5 | Справочники | `GET /genres` | 200 | 200 | PASS |
| 6 | Справочники | `GET /publishers` | 200 | 200 | PASS |
| 7 | Регистрация | `POST /auth/register` | 201 | 201 | PASS |
| 8 | Регистрация | `POST /auth/register` | 409 | 409 | PASS |
| 9 | Вход | `POST /auth/login` | 200 | 200 | PASS |
| 10 | Вход | `POST /auth/login` | 401 | 401 | PASS |
| 11 | Профиль | `GET /me` | 200 | 200 | PASS |
| 12 | Профиль | `PATCH /me` | 200 | 200 | PASS |
| 13 | Корзина | `GET /me/cart` | 200 | 200 | PASS |
| 14 | Корзина | `PUT /me/cart/items/{bookId}` | 200 | 200 | PASS |
| 15 | Избранное | `PUT /me/favorites/{bookId}` | 204 | 204 | PASS |
| 16 | Избранное | `GET /me/favorites` | 200 | 200 | PASS |
| 17 | История заказов | `GET /me/orders?status=pending_payment` | 200 | 200 | PASS |
| 18 | Оформление заказа | `POST /me/orders` | 201 | 201 | PASS |
| 19 | Оформление заказа | `POST /me/orders` | 409 | 409 | PASS |
| 20 | Детали заказа | `GET /me/orders/{orderId}` | 200 | 200 | PASS |
| 21 | Оплата | `POST /me/orders/{orderId}/payment-attempts` | 201 | 201 | PASS |
| 22 | Повтор оплаты | `POST /me/orders/{orderId}/payment-attempts` | 200 | 200 | PASS |
| 23 | Результат провайдера | `POST /payments/{paymentAttemptId}/result` | 200 | 200 | PASS |
| 24 | Оплата | `POST /me/orders/{orderId}/payment-attempts` | 409 | 409 | PASS |
| 25 | Предзаказы | `GET /me/preorders?status=waiting` | 200 | 200 | PASS |
| 26 | Предзаказ | `POST /me/preorders` | 201 | 201 | PASS |
| 27 | Предзаказ | `POST /me/preorders` | 409 | 409 | PASS |
| 28 | Предзаказ | `DELETE /me/preorders/{preorderId}` | 204 | 204 | PASS |
| 29 | Уведомления | `GET /me/notifications?unreadOnly=true` | 200 | 200 | PASS |
| 30 | Уведомления | `PATCH /me/notifications/{notificationId}` | 200 | 200 | PASS |
| 31 | Отзыв | `POST /books/{bookId}/reviews` | 201 | 201 | PASS |
| 32 | Отзыв | `POST /books/{bookId}/reviews` (rating 6) | 422 | 422 | PASS |
| 33 | Модерация | `GET /admin/reviews?moderationStatus=pending` | 200 | 200 | PASS |
| 34 | Модерация | `PATCH /admin/reviews/{reviewId}` | 200 | 200 | PASS |
| 35 | Администрирование | `POST /admin/books` | 201 | 201 | PASS |
| 36 | Запрет доступа | `POST /admin/books` (роль покупателя) | 403 | 403 | PASS |
| 37 | Администрирование | `PATCH /admin/books/{bookId}` | 200 | 200 | PASS |
| 38 | Передача в доставку | `POST /admin/orders/{orderId}/ship` | 200 | 200 | PASS |
| 39 | Передача в доставку | повтор `POST /admin/orders/{orderId}/ship` | 200 | 200 | PASS |
| 40 | Аналитика | `GET /analytics/sales?from=...&to=...` | 200 | 200 | PASS |
| 41 | Аналитика | `GET /analytics/sales?from=2026-12-01&to=2026-11-01` | 400 | 400 | PASS |
| 42 | Аналитика | `GET /analytics/sales` (роль покупателя) | 403 | 403 | PASS |
| 43 | Экспорт CSV | `GET /analytics/sales/export?from=...&to=...` | 200 | 200 | PASS |

</details>

Полные ответы и превью тел запросов доступны в [mock-test-results.json](mock-test-results.json).

## Ограничения Mock-проверки

- Внешняя учётная запись SwaggerHub, Postman или Bruno не создавалась: в среде выполнения нет доступа к аккаунту. Контракт проверен локальным Prism; спецификация готова к импорту в любой из этих сервисов по инструкции выше.
- Prism не хранит состояние: он не проверяет реальный остаток, уникальность email, владельца заказа и подпись провайдера. Эти проверки описывает контракт, но выполняет сервер.
- Коды `401`, `403`, `404`, `409` и `400` в ошибочных сценариях выбираются через `Prefer: code=...`, потому что Mock-сервер не умеет отклонять запрос по бизнес-правилу. Для оплаты с двумя успешными кодами Prism по умолчанию выбирает `200`, поэтому создание новой попытки в проверке вызывается с `Prefer: code=201`.
- `422` для отзыва с оценкой 6 получен настоящей валидацией Prism по JSON-схеме, а не подменой кода.
- Реальная идемпотентность оплаты и доставки должна проверяться интеграционными тестами сервера; здесь проверен только контракт ответов `200`/`201` и заголовок `Idempotent-Replayed`.

## Ссылки

- [Интерактивная документация (Swagger UI)](api.html)
- [OpenAPI 3.0.3 контракт](openapi.yaml)
- [Маршруты и коды ответов](routes.md)
- [Протокол проверки](mock-test-results.json)
- [Скрипт проверки](../../scripts/lab4/run-mock-tests.mjs)
- [SwaggerHub: создание API](https://support.smartbear.com/swaggerhub/docs/en/manage-apis/creating-a-new-api.html)
- [SwaggerHub: Auto Mocking](https://support.smartbear.com/swaggerhub/docs/en/integrations/api-auto-mocking.html)
- [Bruno: Mock Servers](https://docs.usebruno.com/mock-server/overview)
- [Swagger Petstore OpenAPI 3.0](https://petstore3.swagger.io/)
