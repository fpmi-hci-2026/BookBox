# ЛР4, задание 3. Маршруты и спецификация API

## Назначение и границы

Документ фиксирует ресурсные маршруты, HTTP-методы, аутентификацию, тела запросов, успешные ответы и ошибки для API BookBox. Источником требований служат [API-FR-01–API-FR-12 и UC-01–UC-14](requirements.md), источником данных — [физическая модель](physical-model.md) и [SQL-схема](schema.sql). Машиночитаемый контракт — [openapi.yaml](openapi.yaml) (OpenAPI 3.0.3); интерактивная документация — [api.html](api.html).

Границы текущего этапа:

- контракт описывает API, но не реализацию сервера;
- данные и примеры в спецификации — правдоподобные mock-значения;
- реальная проверка ролей, остатков и идемпотентности выполняется сервером, Mock-сервер лишь воспроизводит контракт (см. [отчёт о Mock-проверке](mock-testing.md)).

## Базовые соглашения

| Соглашение | Решение |
|---|---|
| Базовый URL | `https://api.bookbox.example/v1`; локальный Mock-сервер — `http://localhost:4010` |
| Формат данных | JSON (`application/json`), ошибки — `application/problem+json` (RFC 7807) |
| Идентификаторы | UUID v4 |
| Деньги | JSON-число с двумя знаками после запятой, валюта проекта — RUB |
| Дата и время | RFC 3339 в UTC, например `2026-11-24T18:25:00Z` |
| Пагинация | `page` (с 1) и `pageSize` (1–100, по умолчанию 20); ответ содержит `items`, `page`, `pageSize`, `total` |
| Сортировка и фильтры | query-параметры, перечисленные в каждом методе спецификации |
| Аутентификация | `Authorization: Bearer <JWT>`; токен выдаётся `POST /auth/login` и `POST /auth/register` |
| Роли | `buyer`, `admin`, `analyst`; один аккаунт может иметь несколько ролей |
| Идемпотентность | повторная оплата защищена заголовком `Idempotency-Key`, передача заказа в доставку идемпотентна по статусу |
| Ограничение частоты | ошибка `429` при превышении лимита; конкретные значения лимита задаются инфраструктурой |

## Сущности, таблицы и корневые маршруты

| Сущность | Таблица БД | Корневой маршрут | Назначение |
|---|---|---|---|
| Книга | `books` | `/books` | Каталог, поиск, карточка, административное изменение |
| Жанр | `genres` | `/genres` | Справочник для фильтров |
| Издательство | `publishers` | `/publishers` | Справочник для фильтров |
| Аккаунт | `accounts`, `account_roles` | `/me`, `/auth/register`, `/auth/login` | Регистрация, вход, профиль |
| Корзина | `carts`, `cart_items` | `/me/cart` | Текущая корзина покупателя |
| Избранное | `favorites` | `/me/favorites` | Текущее избранное покупателя |
| Заказ | `customer_orders`, `order_items` | `/me/orders` | Создание, история и детали заказов |
| Попытка оплаты | `payment_attempts` | `/me/orders/{orderId}/payment-attempts` | Оплата и повтор оплаты |
| Предзаказ | `preorders` | `/me/preorders` | Заявки на книги с предзаказом |
| Уведомление | `notifications` | `/me/notifications` | Персональные уведомления |
| Отзыв | `reviews` | `/books/{bookId}/reviews`, `/admin/reviews` | Публикация и модерация отзывов |
| Аналитика | `customer_orders`, `order_items`, `books` | `/analytics/sales` | Агрегаты продаж и CSV-выгрузка |

## Реестр маршрутов и конечных точек

### Каталог

| Метод | Маршрут | Use Case | Аутентификация | Успех | Назначение |
|---|---|---|---|---|---|
| GET | `/books` | UC-01, UC-02 | нет | 200 | Список книг, поиск `q`, фильтры по жанру, издательству, цене, наличию, сортировка |
| GET | `/books/{bookId}` | UC-01 | нет | 200 | Карточка книги с описанием, авторами, жанрами и рейтингом |
| GET | `/genres` | UC-01, UC-02 | нет | 200 | Справочник жанров для фильтров |
| GET | `/publishers` | UC-01, UC-02 | нет | 200 | Справочник издательств для фильтров |

### Аккаунт и аутентификация

| Метод | Маршрут | Use Case | Аутентификация | Успех | Назначение |
|---|---|---|---|---|---|
| POST | `/auth/register` | UC-03 | нет | 201 | Создать аккаунт покупателя и получить JWT |
| POST | `/auth/login` | UC-03 | нет | 200 | Проверить учётные данные и получить JWT |
| GET | `/me` | UC-03 | Bearer | 200 | Профиль текущего аккаунта |
| PATCH | `/me` | UC-03 | Bearer | 200 | Изменить имя и телефон текущего аккаунта |

### Корзина и избранное

| Метод | Маршрут | Use Case | Аутентификация | Успех | Назначение |
|---|---|---|---|---|---|
| GET | `/me/cart` | UC-04 | Bearer, `buyer` | 200 | Получить корзину с позициями и суммой |
| DELETE | `/me/cart` | UC-04 | Bearer, `buyer` | 204 | Очистить корзину |
| PUT | `/me/cart/items/{bookId}` | UC-04 | Bearer, `buyer` | 200 | Добавить книгу или установить количество |
| DELETE | `/me/cart/items/{bookId}` | UC-04 | Bearer, `buyer` | 204 | Удалить книгу из корзины |
| GET | `/me/favorites` | UC-04 | Bearer, `buyer` | 200 | Получить избранные книги |
| PUT | `/me/favorites/{bookId}` | UC-04 | Bearer, `buyer` | 204 | Добавить книгу в избранное идемпотентно |
| DELETE | `/me/favorites/{bookId}` | UC-04 | Bearer, `buyer` | 204 | Удалить книгу из избранного |

### Заказы и оплата

| Метод | Маршрут | Use Case | Аутентификация | Успех | Назначение |
|---|---|---|---|---|---|
| GET | `/me/orders` | UC-07 | Bearer, `buyer` | 200 | История заказов текущего покупателя с фильтром по статусу |
| POST | `/me/orders` | UC-05 | Bearer, `buyer` | 201 | Создать заказ из корзины после проверки остатков |
| GET | `/me/orders/{orderId}` | UC-07 | Bearer, `buyer` | 200 | Детали только своего заказа |
| POST | `/me/orders/{orderId}/payment-attempts` | UC-06 | Bearer, `buyer` | 201, 200 при повторе | Создать попытку оплаты или повторить оплату |
| POST | `/payments/{paymentAttemptId}/result` | UC-06 | подпись провайдера | 200 | Принять результат оплаты от платёжного провайдера |

### Предзаказы и уведомления

| Метод | Маршрут | Use Case | Аутентификация | Успех | Назначение |
|---|---|---|---|---|---|
| GET | `/me/preorders` | UC-08 | Bearer, `buyer` | 200 | Список предзаказов с фильтром по статусу |
| POST | `/me/preorders` | UC-08 | Bearer, `buyer` | 201 | Оформить предзаказ на книгу с `preorderEnabled` |
| DELETE | `/me/preorders/{preorderId}` | UC-08 | Bearer, `buyer` | 204 | Отменить предзаказ |
| GET | `/me/notifications` | UC-09 | Bearer | 200 | Уведомления текущего аккаунта, фильтр `unreadOnly` |
| PATCH | `/me/notifications/{notificationId}` | UC-09 | Bearer | 200 | Отметить уведомление прочитанным |

### Отзывы

| Метод | Маршрут | Use Case | Аутентификация | Успех | Назначение |
|---|---|---|---|---|---|
| GET | `/books/{bookId}/reviews` | UC-12 | нет | 200 | Только опубликованные отзывы и сводка оценок |
| POST | `/books/{bookId}/reviews` | UC-12 | Bearer, `buyer` | 201 | Отправить отзыв на модерацию |
| GET | `/admin/reviews` | UC-13 | Bearer, `admin` | 200 | Отзывы для модерации с фильтром по статусу |
| PATCH | `/admin/reviews/{reviewId}` | UC-13 | Bearer, `admin` | 200 | Опубликовать или отклонить отзыв |

### Администрирование и аналитика

| Метод | Маршрут | Use Case | Аутентификация | Успех | Назначение |
|---|---|---|---|---|---|
| POST | `/admin/books` | UC-10 | Bearer, `admin` | 201 | Создать книгу |
| PATCH | `/admin/books/{bookId}` | UC-10 | Bearer, `admin` | 200 | Изменить данные или доступность книги |
| POST | `/admin/orders/{orderId}/ship` | UC-11 | Bearer, `admin` | 200 | Передать оплаченный заказ в доставку |
| GET | `/analytics/sales` | UC-14 | Bearer, `analyst` или `admin` | 200 | Агрегаты продаж за период |
| GET | `/analytics/sales/export` | UC-14 | Bearer, `analyst` или `admin` | 200, `text/csv` | CSV-выгрузка того же периода и набора заказов |

## Тела запросов, успешные ответы и ошибки

Для каждого метода, меняющего состояние, ниже зафиксированы обязательные поля и коды. Полные JSON-схемы и примеры — в [openapi.yaml](openapi.yaml).

| Метод и маршрут | Тело / заголовки | Успех | Основные ошибки |
|---|---|---|---|
| POST `/auth/register` | `email`, `password` (8–128), `displayName`; `phone` опционально | 201 + JWT и профиль | 409 email занят; 422 невалидные поля |
| POST `/auth/login` | `email`, `password` | 200 + JWT и профиль | 400 неверный формат; 401 неверные данные; 422 пустые поля |
| PATCH `/me` | хотя бы одно из `displayName`, `phone` | 200 + профиль | 400 пустое тело; 401; 422 невалидное поле |
| PUT `/me/cart/items/{bookId}` | `quantity` (1–99) | 200 + корзина | 401; 403; 404 книга не найдена; 422 неверное количество |
| PUT `/me/favorites/{bookId}` | без тела | 204 | 401; 403; 404 книга не найдена |
| POST `/me/orders` | `delivery` (`method`, `city`, `street`, `house`, `recipientName`; `apartment` опционально), `giftWrap` | 201 + заказ | 409 нет остатка или пустая корзина; 422 невалидный адрес |
| POST `/me/orders/{orderId}/payment-attempts` | `method` (`card`/`sbp`), `returnUrl`; заголовок `Idempotency-Key` (UUID) | 201 новая попытка; 200 повтор с тем же ключом | 401; 403; 404; 409 заказ уже оплачен/отменён; 422 неверный ключ или метод |
| POST `/payments/{paymentAttemptId}/result` | `status` (`succeeded`/`declined`), `providerReference`, `amount`; заголовок `X-Provider-Signature` | 200 + попытка | 400; 401 подпись; 404; 409 попытка уже завершена другим результатом; 422 |
| POST `/me/preorders` | `bookId` | 201 + предзаказ | 404 книга не найдена; 409 предзаказ уже есть или недоступен; 422 |
| PATCH `/me/notifications/{notificationId}` | `isRead` | 200 + уведомление | 401; 404; 422 |
| POST `/books/{bookId}/reviews` | `rating` (1–5), `body` (1–2000) | 201 + отзыв `pending` | 401; 403; 404; 409 отзыв уже есть; 422 оценка вне диапазона |
| POST `/admin/books` | `title`, `publisherId`, `price`, `stock`; `isbn`, `authorIds`, `genreIds`, `publicationYear`, `preorderEnabled`, `description`, `coverUrl` опционально | 201 + книга | 401; 403; 409 ISBN занят; 422 невалидные данные |
| PATCH `/admin/books/{bookId}` | любое подмножество полей книги | 200 + книга | 401; 403; 404; 409 ISBN занят; 422 |
| POST `/admin/orders/{orderId}/ship` | без тела | 200 + заказ `shipped`; повтор также 200 | 401; 403; 404; 409 заказ не оплачен или отменён |
| PATCH `/admin/reviews/{reviewId}` | `moderationStatus` (`published`/`rejected`) | 200 + отзыв | 401; 403; 404; 409 уже модерирован; 422 |
| GET `/analytics/sales` | query `from`, `to`, `groupBy` (`day`/`week`/`month`) | 200 + отчёт | 400 неверная дата; 401; 403; 422 `from` позже `to` или период > 366 дней |
| GET `/analytics/sales/export` | query `from`, `to`, `groupBy` | 200 `text/csv` | 400; 401; 403; 422 |

## Трассировка Use Case → endpoint

| Use Case | Конечные точки |
|---|---|
| UC-01 Просмотреть каталог и карточку книги | `GET /books`, `GET /books/{bookId}`, `GET /genres`, `GET /publishers` |
| UC-02 Найти книгу и применить фильтры | `GET /books` (`q`, `genreId`, `publisherId`, `minPrice`, `maxPrice`, `inStock`, `sort`), `GET /genres`, `GET /publishers` |
| UC-03 Зарегистрироваться, войти и изменить профиль | `POST /auth/register`, `POST /auth/login`, `GET /me`, `PATCH /me` |
| UC-04 Управлять корзиной и избранным | `GET /me/cart`, `DELETE /me/cart`, `PUT /me/cart/items/{bookId}`, `DELETE /me/cart/items/{bookId}`, `GET /me/favorites`, `PUT /me/favorites/{bookId}`, `DELETE /me/favorites/{bookId}` |
| UC-05 Оформить заказ и проверить наличие | `POST /me/orders` |
| UC-06 Оплатить заказ или повторить оплату | `POST /me/orders/{orderId}/payment-attempts`, `POST /payments/{paymentAttemptId}/result` |
| UC-07 Посмотреть историю и детали заказов | `GET /me/orders`, `GET /me/orders/{orderId}` |
| UC-08 Оформить предзаказ | `GET /me/preorders`, `POST /me/preorders`, `DELETE /me/preorders/{preorderId}` |
| UC-09 Просмотреть уведомления | `GET /me/notifications`, `PATCH /me/notifications/{notificationId}` |
| UC-10 Добавить или изменить книгу | `POST /admin/books`, `PATCH /admin/books/{bookId}` |
| UC-11 Передать оплаченный заказ в доставку | `POST /admin/orders/{orderId}/ship` |
| UC-12 Прочитать отзывы книги и отправить отзыв | `GET /books/{bookId}/reviews`, `POST /books/{bookId}/reviews` |
| UC-13 Модерировать отзыв | `GET /admin/reviews`, `PATCH /admin/reviews/{reviewId}` |
| UC-14 Получить аналитику продаж и экспортировать CSV | `GET /analytics/sales`, `GET /analytics/sales/export` |

## HTTP-статусы и их смысл

| Статус | Когда используется |
|---|---|
| 200 OK | Успешное чтение или изменение без создания ресурса; повтор идемпотентной команды |
| 201 Created | Создан аккаунт, заказ, попытка оплаты, предзаказ, отзыв или книга; в `Location` — адрес ресурса |
| 204 No Content | Удаление или идемпотентное добавление в избранное |
| 400 Bad Request | Синтаксически неверный запрос, неверный формат query-параметра |
| 401 Unauthorized | Нет токена, токен просрочен или подпись провайдера неверна |
| 403 Forbidden | Пользователь аутентифицирован, но роль не разрешает операцию |
| 404 Not Found | Ресурс не существует или принадлежит другому аккаунту |
| 409 Conflict | Нарушено состояние: нет остатка, дубликат, заказ уже оплачен, недопустимый переход статуса |
| 422 Unprocessable Entity | Тело запроса синтаксически верно, но не прошло валидацию полей |
| 429 Too Many Requests | Превышен лимит запросов |
| 500 Internal Server Error | Непредвиденная ошибка сервера |

## Формат ошибки

Все ошибки возвращаются как `application/problem+json`:

```json
{
  "type": "https://api.bookbox.example/problems/insufficient-stock",
  "title": "Недостаточно книг на складе",
  "status": 409,
  "code": "insufficient_stock",
  "detail": "Остаток изменился. Уменьшите количество или удалите недоступные книги.",
  "instance": "/me/orders",
  "unavailableItems": [
    {
      "bookId": "3f2b6c1e-8a4d-4c7e-9b1a-2d5e8f7a6c01",
      "title": "Мастер и Маргарита",
      "requested": 2,
      "available": 1
    }
  ]
}
```

Для ошибок валидации `errors` содержит список `{ "field", "message" }`, чтобы клиент мог подсветить конкретное поле. Тексты ошибок не должны раскрывать существование чужого аккаунта или заказа.

## Связанные артефакты

- [OpenAPI 3.0.3 контракт](openapi.yaml) — маршруты, схемы, примеры и коды ответов.
- [Swagger UI страница](api.html) — интерактивный просмотр контракта на GitHub Pages.
- [Отчёт о Mock-проверке](mock-testing.md) — запуск Mock-сервера и результаты сценариев.
- [Требования и реестр Use Case](requirements.md) — источник API-FR и UC.
- [Физическая модель](physical-model.md) и [SQL-схема](schema.sql) — источник полей и ограничений.

## Источники

- [Методические указания к ЛР4](../../labs/ПЧМИ%20ЛабРабота4%202026-2027.pdf)
- [Проектирование REST API на примере интернет-магазина](https://getanalyst.ru/education/restapi)
- [Пример проектирования REST API библиотеки](https://getanalyst.ru/)
- [Swagger Petstore OpenAPI 3.0](https://petstore3.swagger.io/)
- [RFC 7807: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc7807)
