# API Documentation

Base URL: `/api` · All responses JSON unless exporting.
Authentication: `Authorization: Bearer <JWT>` header. Obtain a token via login.

## Roles & access

| Capability | ADMIN | IT_MANAGER | IT_SUPPORT | HR | ACCOUNTS | EMPLOYEE |
|---|---|---|---|---|---|---|
| View inventory/reports/dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Create/edit assets, assignments, repairs, licenses, stock | ✓ | ✓ | ✓ | — | — | — |
| Delete/dispose assets, view audit log | ✓ | ✓ | — | — | — | — |
| Manage users | ✓ | ✓ | — | ✓ | — | — |
| View own assets (`/assignments/my-assets`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

ADMIN implicitly passes every check.

## Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | /auth/login | `{email, password}` | → `{token, user}`; rate-limited 20/15min |
| GET | /auth/microsoft | — | Redirects to Microsoft 365 sign-in |
| GET | /auth/microsoft/callback | — | Redirects to SPA with `#token=` |
| POST | /auth/forgot-password | `{email}` | Always 200; emails 1-hour reset link |
| POST | /auth/reset-password | `{email, token, password}` | Password min 8 chars |
| GET | /auth/me | — | Current user |
| POST | /auth/change-password | `{currentPassword, newPassword}` | |

## Users

| Method | Path | Notes |
|---|---|---|
| GET | /users?search=&role=&page=&pageSize= | Paginated |
| GET | /users/:id | Includes current assets + licenses |
| POST | /users | `{email, name, role, departmentId?, password?, phone?, jobTitle?}` |
| PUT | /users/:id | Partial update |
| DELETE | /users/:id | Soft deactivate |

## Assets

| Method | Path | Notes |
|---|---|---|
| GET | /assets?search=&status=&categoryId=&departmentId=&locationId=&assignedToId=&page= | Paginated |
| GET | /assets/:id | Full record + assignment & repair history |
| GET | /assets/:id/qrcode | PNG QR label |
| GET | /assets/:id/barcode | PNG Code128 label (asset tag) |
| POST | /assets | multipart/form-data; files: `invoice`, `warrantyDoc` (PDF/JPG/PNG ≤10 MB). Asset tag auto-generated `NP-<CAT>-0001` |
| PUT | /assets/:id | multipart/form-data; category immutable |
| DELETE | /assets/:id | Soft delete → status DISPOSED |

Statuses: `AVAILABLE ASSIGNED REPAIR FAULTY LOST DISPOSED`

## Assignments

| Method | Path | Notes |
|---|---|---|
| GET | /assignments?assetId=&userId=&action=&page= | Full history |
| GET | /assignments/my-assets | Assets held by the caller |
| POST | /assignments | `{assetId, action, userId?, notes?, signature?}` — action ∈ ASSIGN/RETURN/TRANSFER/REPLACE/REPAIR/DISPOSE; `signature` is a base64 PNG data URL. Generates acknowledgement PDF, emails employee + IT manager, posts to Teams, updates asset status |

## Stock

| Method | Path | Notes |
|---|---|---|
| GET | /stock/summary | Asset counts per category × status |
| GET | /stock/items?type=ACCESSORY\|CONSUMABLE | `lowStock` flag included |
| POST | /stock/items | `{name, type, quantity?, minQuantity?, unitPrice?, locationId?}` |
| PUT | /stock/items/:id | |
| POST | /stock/items/:id/adjust | `{delta, reason?}` — atomic increment/decrement |

## Repairs

| Method | Path | Notes |
|---|---|---|
| GET | /repairs?status=&assetId=&page= | |
| GET | /repairs/:id | |
| POST | /repairs | `{assetId, issue, vendorId?, isWarrantyClaim?}` — auto ticket no `RT-2026-0001`, sets asset → REPAIR |
| PUT | /repairs/:id | `{status?, cost?, diagnosis?, partsReplaced?, ...}` — COMPLETED restores asset status and emails the holder |

## Licenses

| Method | Path | Notes |
|---|---|---|
| GET | /licenses?type=&search=&page= | Includes `seatsUsed`/`seatsFree` |
| GET | /licenses/:id | Full assignment history |
| POST | /licenses | `{name, type: M365\|ANTIVIRUS\|RINGCENTRAL\|DYNAMICS365\|OTHER, totalSeats?, expiryDate?, costPerSeat?, totalCost?, ...}` |
| PUT | /licenses/:id | |
| POST | /licenses/:id/assign | `{userId}` — seat-limit enforced |
| DELETE | /licenses/assignments/:assignmentId | Revoke seat |

## Reports

All accept `?format=xlsx` or `?format=pdf` (defaults to JSON).

| Path | Filters |
|---|---|
| GET /reports/assets | status, categoryId, departmentId, userId (user-wise), departmentId (department-wise) |
| GET /reports/warranty-expiry | days (default 30) |
| GET /reports/license-expiry | days (default 30) |
| GET /reports/repairs | status |
| GET /reports/purchases | from, to |

## Dashboard, Audit, Meta, Files

| Method | Path | Notes |
|---|---|---|
| GET | /dashboard | Totals + byCategory/byDepartment/byLocation |
| GET | /audit?entity=&entityId=&userId=&action=&page= | IT_MANAGER/ADMIN only |
| GET | /meta/:type | categories, departments, locations, vendors |
| POST/PUT | /meta/:type(/:id) | Manage lookups |
| GET | /files/:name | Authenticated download of uploads (invoices, warranty docs, acknowledgement PDFs) |
| GET | /health | Unauthenticated liveness check |

## Errors

`{ "error": "message" }` with appropriate HTTP status (400 validation, 401 auth, 403 permission, 404 missing, 409 duplicate, 429 rate limit).
