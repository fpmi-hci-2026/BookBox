# ЛР4, задание 2. Логическая модель данных

## Назначение

Логическая модель уточняет предметную модель ЛР3 для API-сценариев каталога, аккаунта, корзины, заказов, оплаты, предзаказа, уведомлений, отзывов и аналитики. Она задаёт сущности и связи без привязки к конкретному ORM. Физическая реализация в текущем варианте рассчитана на PostgreSQL; выбор СУБД нужно согласовать с репозиторием сервера перед интеграцией.

## Сущности и связи

```mermaid
erDiagram
  ACCOUNT ||--o{ ACCOUNT_ROLE : has
  ROLE ||--o{ ACCOUNT_ROLE : grants
  PUBLISHER ||--o{ BOOK : publishes
  BOOK ||--o{ BOOK_AUTHOR : has
  AUTHOR ||--o{ BOOK_AUTHOR : credited
  BOOK ||--o{ BOOK_GENRE : classified
  GENRE ||--o{ BOOK_GENRE : contains
  ACCOUNT ||--o| CART : owns
  CART ||--o{ CART_ITEM : contains
  BOOK ||--o{ CART_ITEM : selected
  ACCOUNT ||--o{ FAVORITE : saves
  BOOK ||--o{ FAVORITE : saved
  ACCOUNT ||--o{ CUSTOMER_ORDER : places
  CUSTOMER_ORDER ||--|{ ORDER_ITEM : contains
  BOOK ||--o{ ORDER_ITEM : sold
  CUSTOMER_ORDER ||--o{ PAYMENT_ATTEMPT : paid_by
  ACCOUNT ||--o{ PREORDER : requests
  BOOK ||--o{ PREORDER : requested
  ACCOUNT ||--o{ REVIEW : writes
  BOOK ||--o{ REVIEW : receives
  ACCOUNT ||--o{ NOTIFICATION : receives
  PREORDER o|--o{ NOTIFICATION : may_reference

  ACCOUNT {
    uuid id PK
    string email UK
    string password_hash
  }
  ROLE {
    string code PK
  }
  ACCOUNT_ROLE {
    uuid account_id PK,FK
    string role_code PK,FK
  }
  PUBLISHER {
    uuid id PK
    string name UK
  }
  BOOK {
    uuid id PK
    uuid publisher_id FK
    string isbn UK
    string title
    decimal price
    int stock
  }
  AUTHOR {
    uuid id PK
    string name
  }
  BOOK_AUTHOR {
    uuid book_id PK,FK
    uuid author_id PK,FK
  }
  GENRE {
    uuid id PK
    string name UK
  }
  BOOK_GENRE {
    uuid book_id PK,FK
    uuid genre_id PK,FK
  }
  CART {
    uuid id PK
    uuid account_id FK,UK
  }
  CART_ITEM {
    uuid cart_id PK,FK
    uuid book_id PK,FK
    int quantity
  }
  FAVORITE {
    uuid account_id PK,FK
    uuid book_id PK,FK
  }
  CUSTOMER_ORDER {
    uuid id PK
    uuid account_id FK
    string status
    decimal total
    datetime confirmed_at
  }
  ORDER_ITEM {
    uuid order_id PK,FK
    uuid book_id PK,FK
    int quantity
    decimal unit_price
  }
  PAYMENT_ATTEMPT {
    uuid id PK
    uuid order_id FK
    string status
    decimal amount
  }
  PREORDER {
    uuid id PK
    uuid account_id FK
    uuid book_id FK
    string status
  }
  REVIEW {
    uuid id PK
    uuid account_id FK
    uuid book_id FK
    int rating
    string moderation_status
  }
  NOTIFICATION {
    uuid id PK
    uuid account_id FK
    uuid preorder_id FK
    string deduplication_key UK
  }
```

## Основные ограничения предметной модели

- У аккаунта уникальный email; права задаются связью аккаунта с ролями, поскольку один участник может совмещать роли покупателя, администратора и аналитика.
- Цена и сумма заказа хранятся точно, количество и остаток неотрицательны; количество позиции заказа положительно.
- Цена `ORDER_ITEM.unit_price` — снимок на момент заказа, не связанный с дальнейшим изменением цены книги.
- Заказ хранит снимок адреса доставки и получателя. У заказа может быть несколько попыток оплаты; повтор после отказа создаёт отдельную попытку.
- Отзывы связывают аккаунт и книгу. Публично доступно только состояние «опубликован»; модераторские состояния остаются административными.
- Ключ дедупликации уведомления защищает от повторного создания уведомления при повторной обработке одного события поступления.
- Наличие в каталоге хранится как целое число. Проверка остатка при оформлении и фиксация заказа должны выполняться транзакционно в реализации сервера.

## Отличие от упрощённой схемы ЛР3

В физической модели добавлены аккаунты и роли, корзина, избранное, отзывы и уведомления: без них нельзя поддержать заявленные в предыдущих лабораторных пользовательские сценарии API. Сущности платежа и позиций заказа сохранены и уточнены для повторных попыток и снимка цены. Адрес заказа хранится в самом заказе как исторический снимок.
