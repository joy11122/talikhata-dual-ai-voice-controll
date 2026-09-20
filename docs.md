# Production completion map

## Modules
- Authentication: Google OAuth + email/password, bcrypt cost 12.
- Tenant: one default Shop per User.
- Ledger: customers/suppliers, signed balance, due received/given.
- Inventory: product CRUD, stock in/out, prices, low-stock threshold.
- Cash flow: expense entries and inventory-related amounts.
- Voice: browser STT, OpenAI structured intent, Zod, resolver, transaction engine, audit log, Bengali TTS.

## Voice contract
CREATE_TRANSACTION / READ_BALANCE / UPDATE_STOCK / DELETE_ENTRY / LIST_ITEMS with strict entity and transaction enums.

## Safety
1. Authenticate before parsing/execution.
2. Never resolve outside `userId` scope.
3. Never execute ambiguous entity matches.
4. Require confirmation for high-value operations.
5. Execute related balance/stock/transaction/audit changes atomically.
6. Record failures outside the failed transaction so an audit trail survives rollback.

## Production deployment
- Node 20.19+.
- MongoDB Atlas replica set/sharded cluster.
- Set AUTH_SECRET, Mongo URI, Google credentials, OpenAI key.
- Google redirect: `/api/auth/callback/google`.
- Configure allowed production origin and HTTPS.
- Add rate limiting and monitoring before public launch.
