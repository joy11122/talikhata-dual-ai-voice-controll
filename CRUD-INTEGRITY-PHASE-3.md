# TaliKhata CRUD Integrity — Phase 3

## Rules implemented

- Party deletion is blocked when transaction history exists.
- Product deletion is blocked when transaction history exists.
- Party type cannot be changed after ledger history exists.
- Product stock cannot be directly edited after stock transaction history exists; use stock-in/stock-out transactions.
- New product opening stock is recorded as an auditable STOCK_IN transaction inside the same MongoDB transaction.
- Sales, purchases and payments expose a safe **Reverse** action through the existing transaction reversal endpoint.
- Sale reversal restores only the outstanding customer due, not the already-paid portion.
- Purchase reversal restores only the outstanding supplier payable.
- Sale reversal is blocked when a later customer payment exists; reverse later settlement first.
- Purchase reversal is blocked when a later supplier payment exists; reverse later settlement first.
- Stock reversal is blocked if the current stock would become negative.
- Financial records remain intentionally non-editable after posting; correction is done by reversal and a new entry.
- Payment input is validated with Zod at the API boundary.

## Important limitation

This phase does not introduce a new immutable journal/reversal transaction type. The existing delete endpoint still performs an atomic reversal and removes the original transaction. A future accounting-journal phase can add immutable reversal records if full audit-grade accounting history is required.
