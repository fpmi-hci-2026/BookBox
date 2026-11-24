-- BookBox physical schema for PostgreSQL 13+
-- ЛР4, задание 2. Execute in an empty database as the application owner.
BEGIN;

CREATE TABLE accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(254) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    display_name    VARCHAR(120) NOT NULL,
    phone           VARCHAR(32),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT accounts_email_lowercase CHECK (email = lower(email))
);

CREATE TABLE roles (
    code    VARCHAR(24) PRIMARY KEY,
    name    VARCHAR(80) NOT NULL UNIQUE
);

INSERT INTO roles (code, name) VALUES
    ('buyer', 'Покупатель'),
    ('admin', 'Администратор'),
    ('analyst', 'Аналитик')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE account_roles (
    account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    role_code   VARCHAR(24) NOT NULL REFERENCES roles(code) ON DELETE RESTRICT,
    PRIMARY KEY (account_id, role_code)
);

CREATE TABLE publishers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(200) NOT NULL UNIQUE,
    country     VARCHAR(100),
    website     TEXT
);

CREATE TABLE books (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id        UUID NOT NULL REFERENCES publishers(id) ON DELETE RESTRICT,
    isbn                VARCHAR(17) UNIQUE,
    title               VARCHAR(300) NOT NULL,
    publication_year    SMALLINT,
    price               NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    stock               INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    preorder_enabled    BOOLEAN NOT NULL DEFAULT false,
    description         TEXT,
    cover_url           TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT books_publication_year_range
        CHECK (publication_year IS NULL OR publication_year BETWEEN 1 AND 2100)
);

CREATE TABLE authors (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name    VARCHAR(200) NOT NULL
);

CREATE TABLE book_authors (
    book_id     UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES authors(id) ON DELETE RESTRICT,
    PRIMARY KEY (book_id, author_id)
);

CREATE TABLE genres (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE book_genres (
    book_id     UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    genre_id    UUID NOT NULL REFERENCES genres(id) ON DELETE RESTRICT,
    PRIMARY KEY (book_id, genre_id)
);

CREATE TABLE carts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
    cart_id     UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    book_id     UUID NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
    quantity    INTEGER NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (cart_id, book_id)
);

CREATE TABLE favorites (
    account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    book_id     UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, book_id)
);

CREATE TABLE customer_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    status              VARCHAR(24) NOT NULL DEFAULT 'pending_payment',
    delivery_method     VARCHAR(40) NOT NULL,
    delivery_city       VARCHAR(120) NOT NULL,
    delivery_street     VARCHAR(200) NOT NULL,
    delivery_house      VARCHAR(40) NOT NULL,
    delivery_apartment  VARCHAR(40),
    recipient_name      VARCHAR(160) NOT NULL,
    gift_wrap           BOOLEAN NOT NULL DEFAULT false,
    total               NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at        TIMESTAMPTZ,
    shipped_at          TIMESTAMPTZ,
    CONSTRAINT customer_orders_status_check CHECK
        (status IN ('pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled')),
    CONSTRAINT customer_orders_confirmation_check CHECK
        (status NOT IN ('paid', 'processing', 'shipped', 'delivered') OR confirmed_at IS NOT NULL),
    CONSTRAINT customer_orders_shipping_check CHECK
        (status NOT IN ('shipped', 'delivered') OR shipped_at IS NOT NULL)
);

CREATE TABLE order_items (
    order_id    UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
    book_id     UUID NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
    quantity    INTEGER NOT NULL CHECK (quantity > 0),
    unit_price  NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    PRIMARY KEY (order_id, book_id)
);

CREATE TABLE payment_attempts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES customer_orders(id) ON DELETE RESTRICT,
    idempotency_key     UUID NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    amount              NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    provider_reference  VARCHAR(200) UNIQUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ,
    CONSTRAINT payment_attempts_status_check CHECK
        (status IN ('pending', 'succeeded', 'declined', 'cancelled')),
    CONSTRAINT payment_attempts_idempotency_unique UNIQUE (order_id, idempotency_key)
);

CREATE TABLE preorders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    book_id         UUID NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
    status          VARCHAR(24) NOT NULL DEFAULT 'waiting',
    expected_at     DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT preorders_status_check CHECK
        (status IN ('waiting', 'available', 'completed', 'cancelled'))
);

CREATE TABLE reviews (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    book_id             UUID NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
    rating              SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body                TEXT NOT NULL CHECK (length(trim(body)) > 0),
    moderation_status   VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    moderated_at        TIMESTAMPTZ,
    CONSTRAINT reviews_moderation_status_check CHECK
        (moderation_status IN ('pending', 'published', 'rejected')),
    CONSTRAINT reviews_one_per_account_book UNIQUE (account_id, book_id)
);

CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    preorder_id         UUID REFERENCES preorders(id) ON DELETE SET NULL,
    type                VARCHAR(40) NOT NULL,
    title               VARCHAR(200) NOT NULL,
    body                TEXT NOT NULL,
    deduplication_key   VARCHAR(200) NOT NULL UNIQUE,
    is_read             BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX books_title_idx ON books (title);
CREATE INDEX books_publisher_idx ON books (publisher_id);
CREATE INDEX customer_orders_account_created_idx ON customer_orders (account_id, created_at DESC);
CREATE INDEX customer_orders_status_idx ON customer_orders (status);
CREATE INDEX payment_attempts_order_created_idx ON payment_attempts (order_id, created_at DESC);
CREATE INDEX preorders_account_status_idx ON preorders (account_id, status);
CREATE INDEX reviews_book_status_created_idx ON reviews (book_id, moderation_status, created_at DESC);
CREATE INDEX notifications_account_unread_idx ON notifications (account_id, created_at DESC) WHERE is_read = false;

COMMIT;
