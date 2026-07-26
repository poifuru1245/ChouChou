# Changelog

All notable changes to ChouChou are documented here.

## [1.0.0] - 2026-07-20

### Added

- Role-based access control for owner, manager, staff, and cast.
- Admin user management through Firebase Admin SDK Callable Functions.
- CRM, reservations, visits, table management, sales, payroll, closing, analytics, and notifications.
- Cast Portal, favorite system, cast-specific LINE/WEB reservation flows, and premium public-site engagement sections.
- Firestore and Storage Rules with Emulator coverage.
- Backup, restore, production operations, architecture, migration, and QA documentation.

### Changed

- Consolidated browser data access behind the Service Layer.
- Added responsive WebP variants for active Hero, Concept, Recruit, Contact, and badge assets.
- Reduced the active local image payload from approximately 15 MB to approximately 1 MB.
- Added explicit Hosting cache policies and advanced the Service Worker cache to Version 1.0.0.
- Improved public link accessible names without changing their visible design.

### Security

- Firestore and Storage Rules tests: 21/21 passed.
- Route Guard/RBAC tests: 4/4 passed.
- Browser UI direct Firestore/Storage calls: 0.
- Firebase Admin SDK remains isolated to Cloud Functions.

### Release status

- The Version 1.0.0 candidate is prepared locally.
- Production deploy and Git tag are pending the release blockers documented in `RELEASE_NOTE.md`.
