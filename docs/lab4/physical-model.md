# Физическая ER-модель BookBox

Физическая схема рассчитана на PostgreSQL. Типы, ключи и ограничения диаграммы отражены в [SQL-файле](schema.sql); он является источником точных ограничений.

```mermaid
erDiagram
  ACCOUNTS ||--o{ ACCOUNT_ROLES : assigned
  ROLES ||--o{ ACCOUNT_ROLES : grants
  PUBLISHERS ||--o{ BOOKS : publishes
  BOOKS ||--o{ BOOK_AUTHORS : has
  AUTHORS ||--o{ BOOK_AUTHORS : credited
  BOOKS ||--o{ BOOK_GENRES : classified
  GENRES ||--o{ BOOK_GENRES : contains
  ACCOUNTS ||--o| CARTS : owns
  CARTS ||--o{ CART_ITEMS : contains
  BOOKS ||--o{ CART_ITEMS : selected
  ACCOUNTS ||--o{ FAVORITES : saves
  BOOKS ||--o{ FAVORITES : saved
  ACCOUNTS ||--o{ CUSTOMER_ORDERS : places
  CUSTOMER_ORDERS ||--|{ ORDER_ITEMS : contains
  BOOKS ||--o{ ORDER_ITEMS : sold
  CUSTOMER_ORDERS ||--o{ PAYMENT_ATTEMPTS : payment
  ACCOUNTS ||--o{ PREORDERS : requests
  BOOKS ||--o{ PREORDERS : requested
  ACCOUNTS ||--o{ REVIEWS : writes
  BOOKS ||--o{ REVIEWS : receives
  ACCOUNTS ||--o{ NOTIFICATIONS : receives
  PREORDERS o|--o{ NOTIFICATIONS : referenced

  ACCOUNTS {
    uuid id PK
    varchar email UK
    text password_hash
    varchar display_name
    varchar phone
    timestamptz created_at
    timestamptz updated_at
  }
  ROLES {
    varchar code PK
    varchar name UK
  }
  ACCOUNT_ROLES {
    uuid account_id PK,FK
    varchar role_code PK,FK
  }
  PUBLISHERS {
    uuid id PK
    varchar name UK
    varchar country
    text website
  }
  BOOKS {
    uuid id PK
    uuid publisher_id FK
    varchar isbn UK
    varchar title
    smallint publication_year
    numeric price
    integer stock
    boolean preorder_enabled
    text description
    text cover_url
  }
  AUTHORS {
    uuid id PK
    varchar name
  }
  BOOK_AUTHORS {
    uuid book_id PK,FK
    uuid author_id PK,FK
  }
  GENRES {
    uuid id PK
    varchar name UK
    text description
  }
  BOOK_GENRES {
    uuid book_id PK,FK
    uuid genre_id PK,FK
  }
  CARTS {
    uuid id PK
    uuid account_id FK,UK
    timestamptz created_at
    timestamptz updated_at
  }
  CART_ITEMS {
    uuid cart_id PK,FK
    uuid book_id PK,FK
    integer quantity
  }
  FAVORITES {
    uuid account_id PK,FK
    uuid book_id PK,FK
    timestamptz created_at
  }
  CUSTOMER_ORDERS {
    uuid id PK
    uuid account_id FK
    varchar status
    varchar delivery_method
    varchar delivery_city
    varchar delivery_street
    varchar delivery_house
    varchar delivery_apartment
    varchar recipient_name
    boolean gift_wrap
    numeric total
    timestamptz created_at
    timestamptz confirmed_at
    timestamptz shipped_at
  }
  ORDER_ITEMS {
    uuid order_id PK,FK
    uuid book_id PK,FK
    integer quantity
    numeric unit_price
  }
  PAYMENT_ATTEMPTS {
    uuid id PK
    uuid order_id FK
    uuid idempotency_key
    varchar status
    numeric amount
    varchar provider_reference UK
    timestamptz created_at
    timestamptz completed_at
  }
  PREORDERS {
    uuid id PK
    uuid account_id FK
    uuid book_id FK
    varchar status
    date expected_at
    timestamptz created_at
  }
  REVIEWS {
    uuid id PK
    uuid account_id FK
    uuid book_id FK
    smallint rating
    text body
    varchar moderation_status
    timestamptz created_at
    timestamptz moderated_at
  }
  NOTIFICATIONS {
    uuid id PK
    uuid account_id FK
    uuid preorder_id FK
    varchar type
    varchar title
    text body
    varchar deduplication_key UK
    boolean is_read
    timestamptz created_at
  }
```

## Ограничения, важные для API

- Пара аккаунт–роль, корзина аккаунта, пара аккаунт–книга в избранном, пара заказ–книга и пара аккаунт–книга в отзывах имеют ограничения уникальности.
- Для платежей уникальна пара `order_id + idempotency_key`; это позволяет повторять один запрос без создания ещё одной попытки.
- Отзывы ограничены оценкой 1–5 и состояниями модерации `pending`, `published`, `rejected`.
- Статус заказа ограничен допустимыми значениями; оплаченный заказ обязан иметь `confirmed_at`, отправленный — `shipped_at`.
- Удаление книги запрещено, если она уже использована в заказе или предзаказе, чтобы сохранить историю.

Исходник диаграммы: [PlantUML](physical-model.puml). Физические типы, индексы и SQL-ограничения: [schema.sql](schema.sql).
