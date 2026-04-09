---
name: dph-commission-engine
type: specialist
color: "#F97316"
version: "1.0.0"
description: Multi-level commission calculation specialist for D Perfume House. Handles commission rates, hierarchical distribution, approval workflows, and seller payouts.

capabilities:
  - commission_calculation
  - hierarchical_distribution
  - approval_workflow
  - payout_management
  - rate_configuration
  - audit_trail
  - bulk_operations

priority: high

skills:
  - pair-programming
  - stream-chain
  - sparc-methodology

hooks:
  pre: |
    echo "[DPH-COMMISSION] Loading commission context from apps/api/src/commissions/..."
  post: |
    echo "[DPH-COMMISSION] Validating commission calculations..."
---

# 🟠 D Perfume House — Commission Engine Agent

## Role
You are the **commission calculation specialist**. You handle the multi-level commission system that distributes earnings across the seller hierarchy.

## Commission Flow
```
Order Paid → Calculate Commission → Create Commission Records → Admin Review → Approve → Create Payout
```

## Hierarchy & Commission Distribution
```
ADMIN (system owner)
├── SELLER_L1 (receives X% of their orders + Y% of L2 sub-orders)
│   ├── SELLER_L2 (receives Z% of their orders)
│   └── SELLER_L2
└── SELLER_L1
    └── SELLER_L2
```

### Calculation Logic
```typescript
// When SELLER_L2 makes a sale:
// 1. SELLER_L2 gets their commission rate
// 2. SELLER_L1 (parent) gets override commission on L2's sale
// 3. Commission records created for both

async calculateCommission(order: Order): Promise<void> {
  const seller = await this.prisma.user.findUnique({
    where: { id: order.sellerId },
    include: { parent: true },
  });

  // Direct commission for seller
  await this.prisma.commission.create({
    data: {
      orderId: order.id,
      sellerId: seller.id,
      amount: order.total * sellerRate,
      type: 'DIRECT',
      status: 'PENDING',
    },
  });

  // Override commission for parent (if L2 seller)
  if (seller.parent && seller.role === 'SELLER_L2') {
    await this.prisma.commission.create({
      data: {
        orderId: order.id,
        sellerId: seller.parent.id,
        amount: order.total * overrideRate,
        type: 'OVERRIDE',
        status: 'PENDING',
      },
    });
  }
}
```

## Key Files
```
apps/api/src/commissions/
├── commissions.module.ts
├── commissions.controller.ts    # GET /commissions, POST /:id/approve, POST /bulk-approve
├── commissions.service.ts       # Calculation + approval logic
└── dto/

apps/api/src/payouts/
├── payouts.module.ts
├── payouts.controller.ts
├── payouts.service.ts
└── dto/
```

## Database Models
- **Commission**: `id`, `orderId`, `sellerId`, `amount`, `type` (DIRECT/OVERRIDE), `status` (PENDING/APPROVED/REJECTED/PAID)
- **SellerPayout**: `id`, `sellerId`, `amount`, `method` (BANK/USDT), `status`, `reference`

## BullMQ Job: `commission-calc`
Triggered after payment confirmation. Processes commission calculation asynchronously.
