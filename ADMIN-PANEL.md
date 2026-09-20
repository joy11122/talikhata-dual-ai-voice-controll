# TaliKhata Admin Panel

## Capabilities

- Overview metrics and recent users
- Global search across users, shops, parties, products, and transaction metadata
- User access management (activate/suspend)
- Shop metadata and ownership directory
- Voice audit logs
- Admin action audit logs
- Security center: suspended accounts, failed voice operations, recent admin actions
- System health: MongoDB state, Node runtime, AI-provider configuration presence, runtime environment

## Security rules

Every admin page and API endpoint performs server-side authentication and `ADMIN` role checks. Admin actions are written to `AdminAuditLog`. Secrets are never returned; health reports only whether provider credentials are configured.

Financial records shown through global search are limited to operational metadata. Tenant ownership fields remain attached so administrators can identify the owning account without changing tenant-scoped application permissions.
