# Security Specification - Guardian GT

## 1. Data Invariants
- An `Ocorrencia` must be created by an authenticated user.
- A `Vigilante` or `Posto` can only be created/modified by an user with role 'Admin'.
- All document IDs must be valid (alphanumeric, max 128 chars).
- Timestamps (`createdAt`, `updatedAt`) must be set by the server.

## 2. The "Dirty Dozen" Payloads (Denial Tests)

### Identity & Roles
1. **Self-Promotion**: Authenticated user trying to update their own `role` to 'Admin' in `/users`.
2. **Impersonation**: User A trying to create an `Ocorrencia` with `supervisorId` of User B.
3. **Unauthorized Management**: Non-admin user trying to create a `Vigilante`.

### Integrity & Schema
4. **Ghost Fields**: Creating a `Vigilante` with an extra field `isVerified: true`.
5. **Type Poisoning**: Sending a string for `armado` boolean in `Posto`.
6. **Path Injection**: Using `../illegal` as a document ID.
7. **Resource Exhaustion**: Sending a 2MB string for a name field.

### State & Temporal
8. **Time Travel**: Providing a manual `createdAt` timestamp instead of server time.
9. **Final State Bypass**: Trying to update an `Ocorrencia` that has status 'Aprovada'.
10. **Immutable Lock**: Trying to change `postoId` on an existing `Vigilante`.

### Relationship
11. **Orfaned Task**: Creating an `Ocorrencia` referencing a non-existent `supervisorId`.
12. **Relational Leak**: Listing `users` data when not an Admin.

## 3. Test Runner (Conceptual)
All the above payloads will be tested against the `firestore.rules` to ensure `PERMISSION_DENIED`.
