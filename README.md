# D Perfume House

Webapp mobile-first para venta directa de perfumes con integración Odoo 18 y procesador de pagos MyxSpend.

## Arquitectura

```
Monorepo (Turborepo)
├── apps/
│   ├── api/           → NestJS backend (puerto 3001)
│   ├── seller-web/    → Next.js PWA vendedor (puerto 3000)
│   └── admin-web/     → Next.js panel admin (puerto 3002)
└── packages/
    ├── types/         → Tipos TypeScript compartidos
    └── config/        → Constantes de configuración
```

## Stack

| Componente | Tecnología |
|---|---|
| Frontend vendedor | Next.js 14 + Tailwind + TanStack Query + Zustand |
| Frontend admin | Next.js 14 + Tailwind + TanStack Query |
| Backend API | NestJS + Prisma + PostgreSQL |
| Cola de trabajos | BullMQ + Redis |
| Auth | JWT (access + refresh tokens) |
| Imágenes | Sharp (resize + thumbnails) |
| Pagos | MyxSpend (desacoplado vía interface) |
| ERP | Odoo 18 (XML-RPC) |
| Email | Nodemailer (provider desacoplado) |

## Requisitos

- Node.js >= 20
- PostgreSQL 16+
- Redis 7+
- Docker (opcional, para BD y Redis)

## Setup Rápido

### 1. Clonar e instalar

```bash
git clone <repo-url> dperfumehouse
cd dperfumehouse
npm install
```

### 2. Levantar servicios (PostgreSQL + Redis)

```bash
docker compose up -d
```

### 3. Configurar variables de entorno

```bash
# Backend
cp apps/api/.env.example apps/api/.env
# Editar apps/api/.env con tus credenciales

# Frontend vendedor
cp apps/seller-web/.env.example apps/seller-web/.env.local

# Frontend admin
cp apps/admin-web/.env.example apps/admin-web/.env.local
```

### 4. Inicializar base de datos

```bash
cd apps/api
npx prisma generate
npx prisma db push
npx prisma db seed
cd ../..
```

### 5. Iniciar desarrollo

```bash
# Todos los servicios simultáneamente
npm run dev

# O por separado:
npm run dev:api      # Backend en :3001
npm run dev:seller   # Seller PWA en :3000
npm run dev:admin    # Admin panel en :3002
```

## Usuarios Seed

| Email | Password | Rol |
|---|---|---|
| admin@dperfumehouse.com | Admin123! | Administrador |
| seller@dperfumehouse.com | Seller123! | Vendedor Nivel 1 |
| seller2@dperfumehouse.com | Seller123! | Vendedor Nivel 2 |

## Flujo Principal

1. **Vendedor** crea o selecciona un cliente
2. Crea un pedido seleccionando productos (stock cargado desde Odoo)
3. Se genera un link de pago MyxSpend
4. Vendedor comparte el link + envío automático de email
5. Cliente paga → MyxSpend envía webhook
6. **Webhook**: confirma venta en Odoo → genera orden de envío → calcula comisiones

## API Endpoints Principales

### Auth
- `POST /auth/login` - Login
- `POST /auth/refresh` - Refresh token
- `POST /auth/logout` - Logout

### Clientes
- `GET /customers` - Listar (por vendedor)
- `POST /customers` - Crear
- `PUT /customers/:id` - Actualizar
- `POST /customers/:id/addresses` - Agregar dirección

### Productos
- `GET /products` - Catálogo con paginación y búsqueda
- `POST /products/sync` - Sincronizar desde Odoo (admin)
- `PATCH /products/:id/block` - Bloquear producto (admin)

### Pedidos
- `GET /orders` - Listar pedidos
- `POST /orders` - Crear pedido
- `POST /orders/:id/process` - Generar link de pago
- `PATCH /orders/:id/cancel` - Cancelar

### Pagos
- `POST /payments/create-link` - Crear link de pago
- `GET /payments/webhook` - Webhook MyxSpend (GET con query params)

### Comisiones
- `GET /commissions` - Listar
- `POST /commissions/:id/approve` - Aprobar
- `POST /commissions/bulk-approve` - Aprobar masivo

### Dashboard
- `GET /dashboard/seller` - Stats vendedor
- `GET /dashboard/admin` - Stats admin

## Integraciones

### Odoo (XML-RPC)
Configurar en `.env` o panel admin:
- Sincronización de productos y variantes
- Verificación de stock en tiempo real
- Creación de partners
- Confirmación de ventas y órdenes de envío

### MyxSpend
- Auth: POST /auth/login → Bearer Token + X-API-KEY + X-COMPANY-ID
- Payment: POST /payment/process → PaymentLink URL
- Webhook: GET con query params (customerOrderId, status, dateTime, amount, currency)
- Firma: HMAC-SHA256 del URL completo, verificar X-Signature header

## Estructura de la BD

13 modelos principales: User, Customer, CustomerAddress, ProductVariant, ProductImage, Order, OrderItem, PaymentLink, PaymentEvent, ProductRequest, Commission, SellerPayout, AppSetting.

## Desarrollo

```bash
# Generar cliente Prisma
npm run db:generate

# Crear migración
npm run db:migrate

# Push schema (sin migración)
npm run db:push

# Seed data
npm run db:seed

# Lint
npm run lint
```
