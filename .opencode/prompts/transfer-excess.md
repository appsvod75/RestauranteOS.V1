# Transferencia con Exceso + Transfer Otros ✅ IMPLEMENTADO

Este feature ya está implementado. Ver HANDOVER.md sección 30 para la documentación completa.

## Resumen de cambios realizados:

### DB
- `payments.excess_amount DECIMAL(10,2) DEFAULT 0.00` (auto-migration)

### Types
- `PaymentMethod.TransferOther = 'Transfer Otros'`
- `Payment.excessAmount?: number`

### PaymentModal
- Transfer permite sobrepago (como Efectivo)
- Transfer Otros: monto completo es excessAmount
- Muestra "Para Otros: $X" (púrpura)
- Payment line muestra `($X otros)`

### Server
- Guarda excess_amount en INSERT payments
- Hydrata excessAmount en GET /orders, GET /orders/history, PUT /orders/:id socket

### CashClosing
- "Transfer. Propias" = Transfer.amount - Transfer.excessAmount
- "Transfer. Otros" = Transfer.excessAmount + TransferOtros.amount
- Total Ventas incluye todos los métodos
- Ticket muestra Transfer. Otros en gris
