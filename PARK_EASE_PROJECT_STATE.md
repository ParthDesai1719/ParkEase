# ParkEase — Comprehensive Project State & Development Handoff Document

> **Document Version:** 1.0.0  
> **Last Verified:** November 7, 2026 (20:42 IST)  
> **Target File:** `PARK_EASE_PROJECT_STATE.md` (Repository Root)  
> **Repository:** `ParthDesai1719/ParkEase`  
> **Primary Source Documents:** `finalproject-5.txt`, `dbproject-5.txt`, `appendix-8.txt`

---

## 0. Quick Start for Next Session

| Question | Detail |
| :--- | :--- |
| **What is ParkEase?** | A production-grade Full-Stack MERN Smart Parking Management Web Application supporting 5 roles (Visitor, Customer, Parking Owner, Security Staff, Administrator) with passwordless OTP authentication, document-verified owner onboarding, Razorpay payment processing, Mailpit email dispatch, and QR-based gate automation. |
| **What has already been completed?** | **Phase 1 (Public & Brand Foundation):** All public pages (Home, About, Become Owner, Pricing, FAQ, Terms, Privacy, Contact).<br>**Phase 2 (Auth Foundation):** Passwordless customer & admin OTP authentication, in-memory JWT + HttpOnly refresh cookie rotation, unified logout lifecycle.<br>**Phase 3 (Owner Onboarding):** 9-step partner registration wizard, Multer document uploads, dual email/mobile OTP verification, Razorpay test fee payment, application reference tracking.<br>**Phase 4 (Admin Owner Review):** Executive admin dashboard, owner application management, secure authenticated blob document inspector (JPG, PNG, WEBP, PDF), approval/rejection workflows, and audit logging.<br>**Phase 5 (Contact & Communication):** Public contact form wired directly to `parkease@gmail.com` via Mailpit with full HTML email templates. |
| **What was the last completed task?** | 1. Refactored Owner Registration 9-step progress stepper to a mathematically pinned split-half-line pattern with nowrap labels.<br>2. Wired the public Contact form (`/contact`) end-to-end to send inquiries from the visitor's email address to `parkease@gmail.com` in Mailpit (`http://localhost:8025`).<br>3. Fixed Admin document inspector using authenticated Axios Blob streaming (`URL.createObjectURL()`) with zoom controls and automatic URL revocation.<br>4. Added unified admin logout consistent with owner dashboard. |
| **What remains next?** | **Parking Facility & Slot Management (Module 4):** Owner facility creation, floor/zone/slot layout configuration, rate card setup.<br>**Booking & Reservation Engine (Module 5):** Slot search with Leaflet maps, booking creation, advance payment, QR pass generation.<br>**Gate Security Console (Module 6):** QR check-in/check-out scanner, overstay detection, manual entry logging. |
| **Authoritative Documents** | 1. `C:\Users\parth\OneDrive\Desktop\ParkEase-PRJ\prj-main\finalproject-5.txt` (Functional & System Specs)<br>2. `C:\Users\parth\OneDrive\Desktop\ParkEase-PRJ\db\dbproject-5.txt` (Database & Schema Source)<br>3. `C:\Users\parth\OneDrive\Desktop\ParkEase-PRJ\appendix\appendix-8.txt` (Navigation & Validation Rules)<br>4. `C:\Users\parth\OneDrive\Desktop\ParkEase-PRJ\parkease-images\` (Logos, Icons, Branding Assets) |
| **How to run the project?** | `npm run dev` from root (runs Frontend on `:5173`, Backend on `:5000`, and Mailpit on `:1025` / `:8025`). |
| **What should a coding agent inspect before making changes?** | Inspect `src/stores/authStore.ts`, `src/api/client.ts`, `server/src/services/`, and the relevant controller before writing code. |
| **What should NOT be changed without approval?** | 1. Do NOT store JWT access tokens in `localStorage` or `sessionStorage` (must remain memory-only in Zustand).<br>2. Do NOT make document upload endpoints or `/uploads` static or public.<br>3. Do NOT modify canonical role/permission codes or master seed data.<br>4. Do NOT commit or push to Git. |

---

## 1. Project Overview

- **Project Name:** ParkEase
- **System Description:** A full-stack, enterprise-grade Smart Parking Management Web Platform designed for urban mobility. It connects vehicle drivers seeking parking spaces with commercial/residential parking lot owners, while providing on-site security guards with rapid QR-code check-in/check-out tools and platform administrators with comprehensive audit and oversight capabilities.
- **Main Purpose:**
  1. Eliminate urban parking congestion via real-time parking discovery and reservation.
  2. Digitize private and commercial parking lot inventory with automated slot management and dynamic pricing.
  3. Ensure verified, trustworthy parking partners through government ID and commercial proof inspection.
  4. Accelerate gate throughput using automated QR code entry/exit passes and digital payment processing.
- **Technology Stack:**
  - **Frontend:** React 19, TypeScript, Vite 8, React Router v7, Tailwind CSS v4, Radix UI, shadcn/ui component architecture, Lucide React icons, Sonner toast notifications, React Hook Form + Zod, Zustand (in-memory state), TanStack Query, Leaflet (interactive maps).
  - **Backend:** Node.js, Express 5, TypeScript (`tsx`), Mongoose 9, Helmet security headers, CORS with credential support, Cookie-Parser, Multer file upload handling, Winston/Morgan logging.
  - **Database:** MongoDB Atlas (Mongoose ODM with 25 modular schemas, strict ObjectId references, enums, and timestamps).
  - **Authentication:** Passwordless OTP-based authentication (Email & Mobile), memory-only JWT access tokens (15m expiry), HttpOnly secure refresh token rotation (7d expiry) via server sessions.
  - **Payment Gateway:** Razorpay Test Mode integration (order creation, HMAC-SHA256 signature verification).
  - **Email Communication:** Nodemailer SMTP client integrated with local Mailpit server (`localhost:1025` SMTP, `localhost:8025` Web UI) and `EmailLog` database tracking.
  - **Real-Time Engine:** Socket.IO v4 configured on the HTTP server with CORS verification.
  - **Supporting Utilities:** Argon2 password/secret hashing, SHA-256 OTP hashing, JSQR / HTML5-QRCode scanning libraries, Date-fns.

---

## 2. Current Architecture

### 2.1 Repository Layout
```
ParkEase/
├── client/ (or root frontend)
│   ├── src/
│   │   ├── api/            # Axios API client, auth, admin, owner, contact modules
│   │   ├── components/     # UI components (shadcn/ui, auth, layout, common)
│   │   ├── layouts/        # AuthLayout, PublicLayout
│   │   ├── pages/          # Admin, Customer, Owner, Public, Security, Auth pages
│   │   ├── routes/         # React Router v7 route definitions and guards
│   │   ├── schemas/        # Zod validation schemas
│   │   ├── stores/         # Zustand stores (authStore)
│   │   ├── types/          # TypeScript interfaces and API response shapes
│   │   ├── App.tsx         # Root component with ThemeProvider, Splash, Toaster
│   │   └── main.tsx        # Application entry point
│   ├── index.html          # HTML5 shell with font preloads
│   └── vite.config.ts      # Vite + Tailwind v4 + path aliases (@/)
├── server/
│   ├── src/
│   │   ├── config/         # Database, env validation, constants, auth configs
│   │   ├── controllers/    # Admin, Auth, Contact, Owner controllers
│   │   ├── middleware/     # Auth (RBAC), upload, validation, error handler, rate limiter
│   │   ├── models/         # 25 Mongoose models
│   │   ├── routes/         # Admin, Auth, Contact, Owner express routers
│   │   ├── seeds/          # Canonical master data and idempotent seeders
│   │   ├── services/       # Business logic (auth, admin, owner, session, email, otp, razorpay)
│   │   ├── utils/          # ApiResponse, AppError, jwt, ip helpers
│   │   ├── app.ts          # Express application setup, middleware, route mounting
│   │   └── server.ts       # HTTP & Socket.IO server startup
│   ├── scripts/            # Admin seed, Mailpit runner, test verification scripts
│   ├── uploads/            # Private file storage (uploads/owner/)
│   └── package.json        # Backend dependencies and tsx execution scripts
├── PARK_EASE_PROJECT_STATE.md # THIS MASTER DOCUMENT
└── package.json            # Root workspace scripts (concurrently runner)
```

### 2.2 Core Architectural Patterns
1. **Frontend State & Auth:** Zustand maintains `user` and `accessToken` exclusively in memory. No tokens are written to `localStorage` or `sessionStorage`.
2. **Axios Transport:** Axios interceptor injects `Authorization: Bearer <token>` on outgoing requests. On `401 Unauthorized`, an interceptor queues pending calls, triggers a token refresh via the HttpOnly cookie at `/api/v1/auth/refresh-token`, updates the in-memory token, and replays failed calls seamlessly.
3. **Protected Document Streaming:** The `/uploads` directory is never exposed as static files. Document preview is mediated by `GET /api/v1/admin/owner-applications/:id/documents/:docType`, verified with RBAC permissions (`OWNER_APPLICATION_VIEW`), sanitized with strict path traversal checks, and fetched on the client as a binary Blob rendered via ephemeral Object URLs.
4. **Error Handling:** Standardized `AppError` class carries HTTP status codes, machine-readable error codes (e.g. `E001`, `E014`), and operational flags handled uniformly by `errorHandler.ts`.

---

## 3. Database Status

### 3.1 MongoDB & Connection Configuration
- **Driver:** Mongoose 9.9.4
- **Connection Logic:** Located in `server/src/config/database.ts`. Uses `mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })`.
- **Event Listeners:** Implements `connected`, `error`, and `disconnected` event logging.
- **Cluster Configuration:** Hosted on MongoDB Atlas (`parkease.7g5hnif.mongodb.net`). In development, incoming connections are allowed from any IPv4 address via the Atlas IP Access List (`0.0.0.0/0`).

### 3.2 Canonical Models Audit & Implementation Status

| Model File | DB Collection | Status | Key Fields & Relationships | Comparison with dbproject-5.txt |
| :--- | :--- | :--- | :--- | :--- |
| [`User.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/User.ts) | `users` | **IMPLEMENTED** | `fullName`, `email`, `mobileNumber`, `roleId` (ref: Role), `accountStatus`, `emailVerified`, `mobileVerified` | Fully conforms. Matches enums (`Active`, `Suspended`, `Deactivated`, `Deleted`, `Pending Verification`). |
| [`Role.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/Role.ts) | `roles` | **IMPLEMENTED** | `roleName`, `roleCode`, `permissions` (ref: [Permission]), `dashboardRoute`, `isSystemRole`, `isActive` | Fully conforms. Seeded with 4 canonical roles (`CUSTOMER`, `OWNER`, `SECURITY`, `ADMIN`). |
| [`Permission.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/Permission.ts) | `permissions` | **IMPLEMENTED** | `permissionName`, `permissionCode`, `module`, `description`, `isActive` | Fully conforms. Seeded with 27 canonical permissions. |
| [`Session.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/Session.ts) | `sessions` | **IMPLEMENTED** | `userId` (ref: User), `refreshTokenHash`, `ipAddress`, `userAgent`, `expiresAt`, `revokedAt`, `isRevoked` | Supporting architectural model for stateful refresh token rotation. |
| [`RefreshToken.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/RefreshToken.ts) | `refreshtokens` | **IMPLEMENTED** | `userId`, `tokenHash`, `expiresAt`, `isRevoked`, `replacedByTokenHash` | Conforms to dbproject-5 specification. |
| [`OtpVerification.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/OtpVerification.ts) | `otpverifications` | **IMPLEMENTED** | `userId`, `email`, `mobileNumber`, `verificationType`, `deliveryMethod`, `otpCodeHash`, `expiresAt`, `attemptCount`, `verificationStatus` | Fully conforms. Enforces 5-minute expiry, max 3 attempts, 30s cooldown. |
| [`Vehicle.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/Vehicle.ts) | `vehicles` | **IMPLEMENTED** | `userId` (ref: User), `vehicleNumber`, `vehicleType` (`Bike`, `Car`, `SUV`, `EV`), `isDefault` | Conforms to customer vehicle management requirements. |
| [`OwnerApplication.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/OwnerApplication.ts) | `ownerApplications` | **IMPLEMENTED** | `applicationReference`, `applicantId`, `businessName`, `businessType`, `parkingCapacity`, `identityProofUrl`, `businessLicenseUrl`, `propertyProofUrl`, `parkingImageUrls`, `applicationStatus`, `paymentId`, `reviewedBy`, `adminRemarks`, `rejectionReason` | Fully conforms. Status enums: `Draft`, `Submitted`, `Pending Review`, `Approved`, `Rejected`. |
| [`Payment.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/Payment.ts) | `payments` | **IMPLEMENTED** | `paymentReference`, `userId`, `ownerApplicationId`, `bookingId`, `amount`, `gatewayOrderId`, `gatewayPaymentId`, `gatewaySignature`, `paymentStatus`, `paymentType` | Fully conforms. Used for partner fee and designed for bookings. |
| [`AuditLog.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/AuditLog.ts) | `auditLogs` | **IMPLEMENTED** | `userId`, `roleId`, `actionCode`, `module`, `actionTitle`, `ipAddress`, `deviceInfo`, `actionStatus` | Fully conforms. Immutable logging for auth, admin, and owner actions. |
| [`EmailLog.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/EmailLog.ts) | `emaillogs` | **IMPLEMENTED** | `emailReference`, `recipientEmails`, `subject`, `body`, `deliveryStatus`, `providerMessageId` | Fully conforms. Captures all system, OTP, and contact emails. |
| [`Notification.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/Notification.ts) | `notifications` | **IMPLEMENTED** | `notificationReference`, `userId`, `title`, `message`, `notificationType`, `eventType`, `isRead` | Fully conforms. Enums match specification. |
| [`NotificationTemplate.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/NotificationTemplate.ts) | `notificationTemplates`| **IMPLEMENTED** | `templateCode`, `templateName`, `subject`, `message`, `deliveryChannel` | Fully conforms. Seeded with 10 standard lifecycle templates. |
| [`ParkingLot.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/ParkingLot.ts) | `parkinglots` | **SCHEMA IMPLEMENTED** | `ownerId`, `lotName`, `address`, `location` (GeoJSON), `totalCapacity`, `operatingHours`, `amenities`, `lotStatus` | Schema complete. Business logic/routes pending (Module 4). |
| [`ParkingFloor.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/ParkingFloor.ts) | `parkingfloors` | **SCHEMA IMPLEMENTED** | `parkingLotId`, `floorName`, `floorNumber`, `totalSlots`, `isActive` | Schema complete. Management endpoints pending. |
| [`ParkingZone.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/ParkingZone.ts) | `parkingzones` | **SCHEMA IMPLEMENTED** | `parkingFloorId`, `zoneName`, `vehicleType`, `ratePerHour` | Schema complete. Management endpoints pending. |
| [`ParkingSlot.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/ParkingSlot.ts) | `parkingslots` | **SCHEMA IMPLEMENTED** | `parkingLotId`, `slotNumber`, `supportedVehicleType`, `slotStatus` (`Available`, `Reserved`, `Occupied`, `Blocked`, `Maintenance`) | Schema complete. Real-time state machine pending (Module 5). |
| [`Booking.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/Booking.ts) | `bookings` | **SCHEMA IMPLEMENTED** | `bookingReference`, `userId`, `slotId`, `vehicleId`, `startTime`, `endTime`, `qrCode`, `bookingStatus` | Schema complete. Booking engine routes pending (Module 5). |
| [`BookingTimeline.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/BookingTimeline.ts) | `bookingtimelines` | **SCHEMA IMPLEMENTED** | `bookingId`, `statusChange`, `timestamp`, `actorId`, `notes` | Schema complete. Hook integration pending. |
| [`VehicleMovementLog.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/VehicleMovementLog.ts)| `vehiclemovementlogs`| **SCHEMA IMPLEMENTED** | `bookingId`, `gateType` (`ENTRY`, `EXIT`), `verifiedByStaffId`, `scannedAt`, `overstayMinutes` | Schema complete. Security gate scan pending (Module 6). |
| [`Incident.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/Incident.ts) | `incidents` | **SCHEMA IMPLEMENTED** | `incidentReference`, `parkingLotId`, `reportedByStaffId`, `incidentType`, `severity`, `status` | Schema complete. Incident reporting UI pending. |
| [`Review.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/Review.ts) | `reviews` | **SCHEMA IMPLEMENTED** | `bookingId`, `userId`, `parkingLotId`, `rating`, `comment`, `isPublic` | Schema complete. Driver review UI pending. |
| [`FavouriteLocation.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/FavouriteLocation.ts)| `favouritelocations`| **SCHEMA IMPLEMENTED** | `userId`, `parkingLotId`, `customLabel` | Schema complete. Customer favorites UI pending. |
| [`SecurityStaffAssignment.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/SecurityStaffAssignment.ts)| `securitystaffassignments`| **SCHEMA IMPLEMENTED**| `staffUserId`, `parkingLotId`, `shiftStart`, `shiftEnd`, `assignmentStatus` | Schema complete. Staff assignment endpoints pending. |
| [`SystemSettings.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/models/SystemSettings.ts) | `systemsettings` | **IMPLEMENTED** | `ownerRegistrationFee`, `platformCommissionPercent`, `cancellationGraceMinutes`, `taxRatePercent` | Seeded and read dynamically during owner registration. |

---

## 4. Authentication & Authorization

### 4.1 Token Storage & Security
- **Access Token:** Stored **strictly in-memory** in Zustand (`useAuthStore`). It is never persisted to browser storage (`localStorage`, `sessionStorage`, or `IndexedDB`). Lifetime: 15 minutes.
- **Refresh Token:** Stored in a secure, `HttpOnly`, `SameSite: Lax` cookie named `refreshToken`. Lifetime: 7 days.
- **Session Tracking:** Each login creates an active `Session` in MongoDB, hashing the refresh token. Logout or token reuse detection revokes the session immediately.

### 4.2 Implemented Auth Flows
1. **Customer Registration:**
   - Client submits name, email, mobile, vehicle number, and vehicle type to `POST /api/v1/auth/register/request-otp`.
   - Backend dispatches two separate 6-digit OTPs: Email OTP (sent via Nodemailer to Mailpit) and Mobile OTP (logged for development).
   - Client submits both OTPs to `POST /api/v1/auth/register/verify-otp`.
   - On verification, backend atomically creates `User` (role: `CUSTOMER`), default `Vehicle`, logs audit event, sets `refreshToken` cookie, and returns access token + user profile.
2. **Passwordless Login:**
   - User inputs Email or Mobile to `POST /api/v1/auth/login/request-otp`.
   - 6-digit OTP generated with 5-minute expiry and 30-second resend cooldown.
   - User submits OTP to `POST /api/v1/auth/login/verify-otp`.
   - Backend verifies hash, issues tokens, and client redirects according to role:
     - `CUSTOMER` $\rightarrow$ `/customer/dashboard`
     - `OWNER` $\rightarrow$ `/owner/dashboard`
     - `SECURITY` $\rightarrow$ `/security/dashboard`
     - `ADMIN` $\rightarrow$ `/admin/dashboard`
3. **Session Refresh:**
   - Transparent Axios response interceptor intercepts `401 Unauthorized` responses and hits `POST /api/v1/auth/refresh-token`.
   - Backend rotates the session, updates the cookie, and returns a fresh access token.
4. **Logout:**
   - Reusable across all dashboards. Calls `POST /api/v1/auth/logout`, clears the HttpOnly cookie, revokes the server session, clears the Zustand memory store, and redirects to `/login`.

---

## 5. Customer Functionality

### Implemented vs Pending Overview

| Feature | Route | Component | Backend Endpoint | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Registration & Vehicle Setup** | `/register` | [`RegisterPage.tsx`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/src/pages/auth/RegisterPage.tsx) | `POST /api/v1/auth/register/*` | **COMPLETED** |
| **Passwordless Login** | `/login` | [`LoginPage.tsx`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/src/pages/auth/LoginPage.tsx) | `POST /api/v1/auth/login/*` | **COMPLETED** |
| **Customer Dashboard** | `/customer/dashboard` | [`CustomerDashboardPage.tsx`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/src/pages/customer/CustomerDashboardPage.tsx) | *Static Shell + Auth* | **PARTIALLY IMPLEMENTED** (UI shell complete; booking/vehicle queries pending) |
| **Search Parking** | `/customer/search` | [`SearchParkingPage.tsx`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/src/pages/customer/SearchParkingPage.tsx) | *Simulated client search* | **PARTIALLY IMPLEMENTED** (UI and filter pills present; Leaflet map integration & live API search pending) |
| **Booking Creation & Pass** | — | — | — | **NOT IMPLEMENTED** |
| **Booking Extension & Cancel** | — | — | — | **NOT IMPLEMENTED** |
| **Customer Vehicles Management** | — | — | — | **NOT IMPLEMENTED** |

---

## 6. Parking Owner Functionality

### 6.1 Owner Registration Pipeline (9-Step Wizard)
Implemented in [`OwnerRegisterPage.tsx`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/src/pages/public/OwnerRegisterPage.tsx) backed by [`owner.service.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/services/owner.service.ts):
1. **Step 1: Business Info:** Facility name, business category, capacity, address, city, state, postal code. Saves draft to `OwnerApplication` via `POST /api/v1/owner/register`.
2. **Step 2: Owner Info:** Full legal name, business email, business phone, government ID type, ID number.
3. **Step 3: Document Uploads:** Multer upload for Identity Proof, Business License, Property Proof, and up to 5 Parking Facility Photos via `POST /api/v1/owner/upload`. Stored in `server/uploads/owner/`.
4. **Step 4: Terms Acceptance:** Digital agreement to platform operating rules.
5. **Step 5: Email OTP:** 6-digit OTP delivered to applicant email via Mailpit via `POST /api/v1/owner/register/request-email-otp` and verified with `POST /api/v1/owner/register/verify-email-otp`.
6. **Step 6: Mobile OTP:** 6-digit OTP verification via `POST /api/v1/owner/register/request-mobile-otp` and `POST /api/v1/owner/register/verify-mobile-otp`.
7. **Step 7: Application Summary:** Review of draft details before fee payment.
8. **Step 8: Registration Fee Payment:** Dynamic fee retrieval (default ₹999), Razorpay order creation (`POST /api/v1/owner/register/create-order`), checkout modal, and backend signature verification (`POST /api/v1/owner/register/verify-payment`).
9. **Step 9: Submission & Tracking:** Sets status to `Pending Review`, records `Payment` record, dispatches email notification, and issues tracking reference (e.g. `APP-2026-F96880`).

### 6.2 Application Tracking
Implemented in [`OwnerRegistrationStatusPage.tsx`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/src/pages/public/OwnerRegistrationStatusPage.tsx) via `GET /api/v1/owner/registration-status`. Applicants can track status (`Draft`, `Submitted`, `Pending Review`, `Approved`, `Rejected`) and view review remarks.

### 6.3 Owner Role Distinction
- **Applicant:** Operates with public permissions or as a standard user during the draft phase.
- **Pending Applicant:** Application is locked under review; cannot access owner dashboard.
- **Approved Owner:** Admin approval automatically assigns the `OWNER` role, unlocking `/owner/dashboard`.
- **Owner Dashboard ([`OwnerDashboardPage.tsx`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/src/pages/owner/OwnerDashboardPage.tsx)):** Currently an authenticated shell with metric tiles and "Submit Facility" action. Real-time slot management and security staff invitations are pending.

---

## 7. Admin Functionality

### 7.1 Implemented Admin Capabilities
1. **Executive Overview ([`AdminDashboardPage.tsx`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/src/pages/admin/AdminDashboardPage.tsx)):**
   - KPI tiles: Total Owners, Pending Approvals, Approved Facilities, Suspended Owners via `GET /api/v1/admin/overview`.
   - Quick action link to Owner Management.
   - Header with styled unified Logout action.
2. **Owner Application Management ([`OwnerManagementPage.tsx`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/src/pages/admin/OwnerManagementPage.tsx)):**
   - Live searchable and filterable application table via `GET /api/v1/admin/owner-applications`.
   - Detail inspection modal covering business, owner, and payment data via `GET /api/v1/admin/owner-applications/:id`.
   - Remarks management via `PUT /api/v1/admin/owner-applications/:id/remarks`.
   - **Document Inspector:**
     - Requests documents through authenticated Axios Blob pipeline (`GET /api/v1/admin/owner-applications/:id/documents/:docType`).
     - Supports inline rendering of JPG, PNG, WEBP, and PDF.
     - Controls: Zoom In (+), Zoom Out (-), Reset (100%), and "Open in New Tab".
     - Automatic `URL.revokeObjectURL()` memory cleanup.
   - **Review Actions:**
     - **Approve (`POST /api/v1/admin/owner-applications/:id/approve`):** Updates status to `Approved`, assigns `OWNER` role to applicant, dispatches approval email, and logs audit record.
     - **Reject (`POST /api/v1/admin/owner-applications/:id/reject`):** Requires explicit rejection reason, sets status to `Rejected`, dispatches notification email, and records audit trail.
   - Header with styled unified Logout action.

---

## 8. Payment System

- **Gateway:** Razorpay (Test Mode)
- **Integration Layer:** [`razorpay.service.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/services/razorpay.service.ts)
- **Implemented Features:**
  - Order creation via `razorpay.orders.create` with fallback to deterministic mock order in testing.
  - Signature verification using crypto HMAC-SHA256 against `RAZORPAY_KEY_SECRET`.
  - Payment records stored in `payments` collection linked to `OwnerApplication`.
  - Used for the one-time Partner Registration Fee (₹999 / ₹5000).
- **Pending Features:**
  - Booking advance payments.
  - Extension and overstay charges.
  - Razorpay webhook listener for asynchronous event capture.
  - Automated refund processing.

---

## 9. Email System

- **Service:** [`email.service.ts`](file:///c:/Users/parth/OneDrive/Desktop/ReactPrjs/ParkEase/server/src/services/email.service.ts)
- **Local Dev Server:** Mailpit (listening on SMTP `:1025`, Web UI `:8025`).
- **Safety / Fallback:** If `SMTP_HOST` is unset, safe `jsonTransport` fallback mode prevents crashes.
- **Audit:** Every email attempt creates an immutable record in the `emaillogs` collection.
- **Implemented Email Dispatches:**
  1. `sendOtpEmail`: 6-digit verification code with 5-minute expiry.
  2. `sendWelcomeEmail`: Welcome message on customer account activation.
  3. `Owner Application Submitted`: Confirmation email with tracking reference.
  4. `Owner Application Approved`: Onboarding approval notice.
  5. `Owner Application Rejected`: Review decision with administrator feedback.
  6. `Public Contact Inquiry`: Dispatched from visitor's email address to `parkease@gmail.com`.

---

## 10. File Upload & Document Security

- **Storage Location:** `server/uploads/owner/` (local disk).
- **Upload Configuration:** Multer disk storage in `server/src/middleware/upload.ts`.
- **Accepted MIME Types:** `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
- **Size Limits:** 10MB per document; up to 5 parking lot photos.
- **Document Protection:**
  - `/uploads` is **NOT** exposed via `express.static`.
  - Endpoint `GET /api/v1/admin/owner-applications/:id/documents/:docType` enforces `requireAuth`, `requireRole('ADMIN')`, and `requirePermission('OWNER_APPLICATION_VIEW')`.
  - Strict path traversal rejection:
    ```typescript
    if (!resolvedFile.startsWith(uploadsRoot)) {
      throw new AppError('Access to the requested file is forbidden.', 403, 'FORBIDDEN');
    }
    ```
  - Sends `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-cache, no-store`.

---

## 11. Notifications

- **Model:** `Notification.ts` & `NotificationTemplate.ts`
- **Implemented Lifecycle Events:**
  - `OWNER_APPLICATION_SUBMITTED`
  - `OWNER_APPLICATION_APPROVED`
  - `OWNER_APPLICATION_REJECTED`
  - `AUTH_WELCOME`
- **Frontend Status:** Bell icon with counter badge exists in the navigation header. Dynamic popover and real-time push integration are pending.

---

## 12. Audit Logging

- **Model:** `AuditLog.ts`
- **Service:** `audit.service.ts`
- **Implemented Audit Codes:**
  - `AUTH_OTP_REQUESTED`
  - `AUTH_OTP_VERIFIED`
  - `AUTH_OTP_FAILED`
  - `USER_CREATED`
  - `AUTH_REFRESH_TOKEN_REUSE_DETECTED`
  - `AUTH_REFRESH_TOKEN_ROTATED`
  - `AUTH_LOGOUT`
  - `AUTH_SESSION_REVOKED`
  - `OWNER_APPLICATION_CREATED`
  - `OWNER_APPLICATION_PAYMENT_SUCCESSFUL`
  - `OWNER_APPLICATION_REVIEW_STARTED`
  - `OWNER_APPLICATION_APPROVED`
  - `OWNER_APPLICATION_REJECTED`

---

## 13. API & Routes Inventory

### 13.1 Backend Endpoints (`http://localhost:5000/api/v1`)

| Method | Endpoint | Description | Auth Required | Role / Permission | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server health check | No | Public | **ACTIVE** |
| `POST`| `/auth/login/request-otp` | Request login OTP | No | Public | **ACTIVE** |
| `POST`| `/auth/login/verify-otp` | Verify OTP and authenticate | No | Public | **ACTIVE** |
| `POST`| `/auth/register/request-otp` | Initiate customer registration | No | Public | **ACTIVE** |
| `POST`| `/auth/register/verify-otp` | Finalize customer registration | No | Public | **ACTIVE** |
| `POST`| `/auth/otp/resend` | Resend OTP code | No | Public | **ACTIVE** |
| `POST`| `/auth/refresh-token` | Rotate refresh token | Yes (Cookie) | Public | **ACTIVE** |
| `POST`| `/auth/logout` | Revoke session & clear cookie | Yes | Public | **ACTIVE** |
| `GET` | `/auth/me` | Fetch authenticated user profile | Yes | Any authenticated | **ACTIVE** |
| `POST`| `/contact` | Send inquiry to `parkease@gmail.com` | No | Public | **ACTIVE** |
| `GET` | `/owner/config` | Get registration fee & gateway | No | Public | **ACTIVE** |
| `POST`| `/owner/upload` | Upload partner document (Multer) | No | Public | **ACTIVE** |
| `POST`| `/owner/register` | Create draft registration | No | Public | **ACTIVE** |
| `POST`| `/owner/register/request-email-otp`| Request email OTP | No | Public | **ACTIVE** |
| `POST`| `/owner/register/verify-email-otp` | Verify email OTP | No | Public | **ACTIVE** |
| `POST`| `/owner/register/request-mobile-otp`| Request mobile OTP | No | Public | **ACTIVE** |
| `POST`| `/owner/register/verify-mobile-otp` | Verify mobile OTP | No | Public | **ACTIVE** |
| `POST`| `/owner/register/create-order` | Create Razorpay order | No | Public | **ACTIVE** |
| `POST`| `/owner/register/verify-payment` | Verify payment & submit app | No | Public | **ACTIVE** |
| `GET` | `/owner/registration-status` | Track application status | No | Public | **ACTIVE** |
| `GET` | `/admin/overview` | Admin KPI metrics | Yes | `ADMIN` / `DASHBOARD_VIEW` | **ACTIVE** |
| `GET` | `/admin/owner-applications` | List owner applications | Yes | `ADMIN` / `OWNER_APPLICATION_VIEW` | **ACTIVE** |
| `GET` | `/admin/owner-applications/:id` | Application details | Yes | `ADMIN` / `OWNER_APPLICATION_VIEW` | **ACTIVE** |
| `PUT` | `/admin/owner-applications/:id/remarks` | Update admin review remarks | Yes | `ADMIN` / `OWNER_APPLICATION_MANAGE` | **ACTIVE** |
| `GET` | `/admin/owner-applications/:id/documents/:docType` | Stream protected document | Yes | `ADMIN` / `OWNER_APPLICATION_VIEW` | **ACTIVE** |
| `POST`| `/admin/owner-applications/:id/approve` | Approve owner application | Yes | `ADMIN` / `OWNER_APPLICATION_MANAGE`| **ACTIVE** |
| `POST`| `/admin/owner-applications/:id/reject` | Reject owner application | Yes | `ADMIN` / `OWNER_APPLICATION_MANAGE`| **ACTIVE** |

### 13.2 Frontend Route Map (`http://localhost:5173`)

| Route | Page Component | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `/` | `HomePage.tsx` | Public | Landing page with Hero, Features, Statistics, and CTA |
| `/about` | `AboutPage.tsx` | Public | Mission, Vision, and Platform Architecture |
| `/pricing` | `PricingPage.tsx` | Public | Fee structure, Driver vs Partner pricing |
| `/faqs` | `FaqPage.tsx` | Public | Interactive categorized accordion FAQ |
| `/contact` | `ContactPage.tsx` | Public | Contact form delivering to Mailpit |
| `/terms` | `TermsPage.tsx` | Public | Terms of Service |
| `/privacy` | `PrivacyPolicyPage.tsx` | Public | Privacy & Cookie Policy |
| `/become-owner`| `BecomeOwnerPage.tsx` | Public | Partner landing page with onboarding guide |
| `/owner/register`| `OwnerRegisterPage.tsx` | Public | 9-step partner registration wizard |
| `/owner/registration-status`| `OwnerRegistrationStatusPage.tsx`| Public | Status tracker by reference/email |
| `/login` | `LoginPage.tsx` | Guest Only | Passwordless OTP login |
| `/register` | `RegisterPage.tsx` | Guest Only | Customer + vehicle registration |
| `/customer/dashboard`| `CustomerDashboardPage.tsx`| `CUSTOMER` | Driver overview & active booking tiles |
| `/customer/search` | `SearchParkingPage.tsx` | `CUSTOMER` | Facility search & filter interface |
| `/owner/dashboard` | `OwnerDashboardPage.tsx` | `OWNER` | Partner facility & occupancy overview |
| `/security/dashboard`| `SecurityDashboardPage.tsx`| `SECURITY` | Gate console & QR check-in shell |
| `/admin/dashboard` | `AdminDashboardPage.tsx` | `ADMIN` | Administrator overview & metrics |
| `/admin/owners` | `OwnerManagementPage.tsx` | `ADMIN` | Application review & document inspector |
| `/access-denied` | Inline Component | Public | 403 Access Denied fallback |
| `/splash` | `SplashScreen.tsx` | Public | Standalone brand splash animation |

---

## 14. Frontend UI Design System

- **Design Tokens:** Dark/Light theme toggle powered by `next-themes` and CSS variables in `src/index.css`. Default palette features curated slate-950 dark background, warm primary orange accents (`#f97316` / `#ea580c`), and crisp border contrasts.
- **Typography:** `@fontsource-variable/geist` with clean mono accents.
- **Animations:** Subtle micro-interactions, skeleton loaders, and `SplashScreen` on initial application boot.
- **Reusable Primitives:** Accordion, Alert, Avatar, Badge, Button, Card, Dialog/Modal, Dropdown Menu, FieldFeedback, Input, Label, Select, Separator, Sheet, Skeleton, Sonner Toaster, Tabs, Textarea.
- **Forms & Validation:** React Hook Form coupled with Zod schemas and contextual field feedback.

---

## 15. Environment & Development Setup

### 15.1 Runtime Requirements
- Node.js `v20+` or `v22+`
- npm `v10+`
- Mailpit standalone binary (`mailpit.exe` in `C:\Mailpit\` or PATH)

### 15.2 Environment Variables (By Name Only — No Secrets)
- **Root / Frontend (`.env` or Vite defaults):**
  - `VITE_API_URL` (defaults to `http://localhost:5000/api/v1`)
- **Backend (`server/.env`):**
  - `NODE_ENV`
  - `PORT`
  - `CLIENT_URL`
  - `MONGODB_URI`
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN`
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_SECURE`
  - `SMTP_FROM_EMAIL`
  - `SMTP_FROM_NAME`
  - `MAILPIT_PATH`
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`

### 15.3 Local Ports
- **Frontend Vite Dev Server:** `http://localhost:5173` (or `5174`)
- **Backend Express API:** `http://localhost:5000`
- **Mailpit SMTP Server:** `localhost:1025`
- **Mailpit Web UI:** `http://localhost:8025`

### 15.4 Scripts
- `npm run dev`: Starts frontend, backend server, and Mailpit concurrently.
- `npm run typecheck`: Runs `tsc -b --noEmit` across client.
- `npm --prefix server run typecheck`: Runs `tsc --noEmit` across server.
- `npm run lint`: ESLint check.
- `npm run build`: Production build of client.
- `npm --prefix server run build`: Compiles TypeScript to `server/dist/`.
- `npm --prefix server run seed`: Seeds permissions, roles, and settings.
- `npm --prefix server run seed:admin`: Seeds default administrator (`admin-parkease@gmail.com`).

---

## 16. Testing & Verification Status

| Verification Check | Target | Status |
| :--- | :--- | :--- |
| **Frontend Lint** | `npm run lint` | **PASS (0 errors, 0 warnings)** |
| **Frontend Typecheck** | `npm run typecheck` | **PASS (0 errors)** |
| **Backend Typecheck** | `npm --prefix server run typecheck` | **PASS (0 errors)** |
| **Frontend Build** | `npm run build` | **PASS (Production bundle built in ~1.39s)** |
| **Backend Build** | `npm --prefix server run build` | **PASS (`tsc` compiled to `server/dist`)** |
| **Live Browser Verification** | `/login`, `/admin/dashboard`, `/admin/owners` | **PASS (Logout, RBAC, Document Inspector verified)** |
| **Document Preview Verification** | JPG, PNG, WEBP, PDF | **PASS (Authenticated Blob pipeline + zoom controls)** |
| **Stepper Alignment Verification** | `/owner/register` | **PASS (Split-half-line pattern + nowrap labels verified)** |
| **Contact Form Verification** | `/contact` $\rightarrow$ Mailpit | **PASS (Verified delivery to `parkease@gmail.com` in Mailpit)** |

---

## 17. Git & Development State

- **Active Branch:** `master`
- **Latest Commit:** `7023d4e` (*feat: implement frontend authentication foundation*)
- **Working Tree:** Dirty (contains completed owner onboarding, document inspector, contact form, and stepper fixes).
- **Policy Reminder:** **DO NOT COMMIT OR PUSH WITHOUT EXPLICIT USER APPROVAL.**

---

## 18. Completed Features Checklist `[ x ]`

- [x] Full branding system, color palette, dark mode, typography, and splash screen
- [x] All 8 public marketing and informational pages (Home, About, Become Owner, Pricing, FAQ, Terms, Privacy, Contact)
- [x] Passwordless customer registration with dual Email & Mobile OTP validation
- [x] Passwordless login flow with role-based routing (`CUSTOMER`, `OWNER`, `SECURITY`, `ADMIN`)
- [x] Secure memory-only JWT access token architecture with HttpOnly refresh token cookie rotation
- [x] Unified logout flow across all dashboards revoking database sessions
- [x] 9-step Parking Owner onboarding wizard with document upload and OTP verification
- [x] Razorpay Test payment order creation and signature verification for partner registration fee
- [x] Owner application status tracker page (`/owner/registration-status`)
- [x] Admin overview dashboard with KPI metrics tiles
- [x] Admin Owner Application review interface with search, filters, remarks, and detail modal
- [x] Secure Document Inspector supporting authenticated Blob streaming of JPG, PNG, WEBP, and PDF with zoom controls and path traversal protection
- [x] Admin approval and rejection workflows with automated email notifications
- [x] Contact page wired directly to `parkease@gmail.com` via Mailpit with HTML templates
- [x] Canonical Master Data seeding (4 Roles, 27 Permissions, System Settings)
- [x] Mailpit automated runner and email logging service

---

## 19. Partially Completed Features Checklist `[ ~ ]`

- [~] **Customer Dashboard (`/customer/dashboard`):** UI layout and stats cards complete; needs dynamic queries to fetch active bookings and registered vehicles.
- [~] **Search Parking (`/customer/search`):** Filter pills and UI search toolbar complete; needs Leaflet interactive map integration and live backend search endpoint.
- [~] **Owner Dashboard (`/owner/dashboard`):** Overview cards complete; needs facility and slot management controls.
- [~] **Security Staff Console (`/security/dashboard`):** Gate operations layout complete; needs live QR scanner and check-in/out endpoints.
- [~] **Notification Center:** Model, seed templates, and header bell badge complete; needs in-app notification dropdown and mark-as-read endpoints.
- [~] **Real-Time Engine:** Socket.IO server initialized; needs application-level room join and live slot status dispatch.

---

## 20. Not Yet Implemented Checklist `[ ]`

- [ ] **Module 4: Parking Lot Management API:** CRUD for parking facilities, floors, zones, and individual slots.
- [ ] **Module 4: Rate Card Engine:** Hourly tariffs, vehicle-type pricing, peak-hour multiplier configuration.
- [ ] **Module 5: Slot Reservation Engine:** Slot locking mechanism, booking time calculations, grace period management.
- [ ] **Module 5: Driver Booking Payment:** Razorpay payment flow for parking reservations.
- [ ] **Module 5: QR Code Entry Pass Generator:** Digital QR pass issuance with encryption/hashing.
- [ ] **Module 6: Security Gate Scanner:** Video QR scanner with entry logging, slot status transition, and overstay calculation.
- [ ] **Module 6: Walk-in Booking:** On-site ticket generation for non-app drivers by security guard.
- [ ] **Module 7: Booking Extension & Overstay Resolution:** Automated overstay fee calculation and driver extension payments.
- [ ] **Module 8: Reviews & Ratings:** Post-parking driver review submission and public display.
- [ ] **Module 9: Security Staff Invitations:** Owner workflow to invite and assign guards to parking facilities.
- [ ] **Module 10: Platform Financial Settlement & Reports:** Commission calculations and owner payout reports.

---

## 21. Known Issues & Technical Debt

1. **MongoDB Atlas IP Access:** If the developer's residential or mobile IP changes, Atlas TLS handshakes fail. `0.0.0.0/0` is currently enabled in development to avoid disruption.
2. **Vite Bundle Size Warning:** The production bundle contains chunks exceeding 500 kB (due to Lucide, Leaflet, and Radix bundles). Code-splitting via dynamic `import()` is recommended for optimization before production deployment.
3. **SMS Delivery Simulation:** Mobile OTPs are simulated and logged to the console/Mailpit body; production requires integrating an SMS gateway (e.g. Twilio / Fast2SMS).

---

## 22. Next Development Priorities

```
1. [Core Backend] Implement Parking Facility & Slot Management (Module 4)
   ├── CRUD API for ParkingLot, ParkingFloor, ParkingZone, ParkingSlot
   └── Owner Facility Creation UI on /owner/dashboard
2. [Core Backend] Implement Rate Card & Operating Hours Engine
3. [Integration] Wire Interactive Leaflet Map on /customer/search
4. [Core Backend] Implement Booking & Reservation Engine (Module 5)
   ├── Real-time slot availability queries
   └── Razorpay booking payment flow
5. [Feature] QR Pass Generation & Security Gate Scanner (Module 6)
6. [Feature] Overstay Detection & Incident Logging
7. [Testing & Hardening] End-to-end integration tests and bundle optimization
```

---

## 23. Important Rules for Future Development Sessions

1. **Authoritative Truth:** Always refer to `finalproject-5.txt`, `dbproject-5.txt`, and `appendix-8.txt`. Never invent unspecified functionality.
2. **Authentication Protocol:** Maintain the in-memory access token architecture. **NEVER** write JWTs to `localStorage` or `sessionStorage`.
3. **Document Security:** Never make document directories publicly accessible. All private files must route through authenticated, RBAC-checked streaming endpoints with path traversal validation.
4. **Git Discipline:** **DO NOT** commit or push without explicit user instruction.
5. **Quality Gates:** Before completing any task, run `npm run lint`, `npm run typecheck`, `npm --prefix server run typecheck`, `npm run build`, and `npm --prefix server run build`.
6. **Secrets Handling:** Never expose database connection strings, passwords, or API secret keys in code, logs, or documentation.

---

## 24. Module 4 Security Staff — Phase 6 & Custom Walk-in Range Implementation Summary

### 24.1 Walk-in Custom Duration & Time Range Support
- **Custom Time Range Selector:** Added interactive `Time From` (datetime-local, default: Now) and `Time To` (datetime-local, default: Now + 2h) pickers to `/security/walk-in`.
- **Hybrid Presets & Custom Interval:** Retained fixed preset buttons (`1h, 2h, 3h, 4h, 6h, 8h, 12h, 24h`). Selecting a preset sets `exitTime` automatically to `entryTime + durationHours`. Editing `entryTime` or `exitTime` directly recalculates fractional hours (e.g. 2.5 hours) and dynamically re-evaluates tariff and bay availability.
- **Backend Fractional Hour Tariff Engine:** `calculateWalkInTariff`, `getWalkInAvailableSlots`, and `createWalkInBooking` in `server/src/services/security.service.ts` accept both `durationHours` and `entryTime` / `exitTime` to compute dynamic tariffs (`baseAmount = Math.ceil(hourlyRate * duration)`), storing exact timestamps and duration minutes.

### 24.2 Security Incident Reports (Phase 6)
- **Database Model & Types:** Expanded `server/src/models/Incident.ts` with all Page 6 canonical types (`Invalid QR`, `Wrong Vehicle`, `Overstay`, `Lost Ticket`, `Lost Ticket / QR`, `Vehicle Damage`, `Other`, etc.) and severities (`Low`, `Medium`, `High`, `Critical`).
- **Access Control & Facility Isolation:** Enforced `requireActiveSecurityAssignment` and `assertStaffLotAssignment` so security staff can only view and report incidents for their assigned parking facilities.
- **Audit Logging & Real-Time Sync:** Creation and resolution of incidents log to `AuditLogModel` (`INCIDENT_REPORTED`, `INCIDENT_STATUS_UPDATED`) and broadcast via Socket.IO (`incident_updated`).
- **File Upload Middleware:** Integrated Multer diskStorage (`incidentImagesUpload`) for uploading up to 5 JPG/PNG/WebP photos (max 10MB each), served securely via authenticated endpoint `/api/v1/security/incidents/images/:filename`.
- **Frontend Console (`/security/incidents`):**
  - Live KPI summary counters: Total Incidents, Open, Under Investigation, Resolved, Critical.
  - Multi-criteria filter & search bar (debounced text search, Status filter, Priority filter, Type filter).
  - Modal report dialog with field validations and drag-and-drop evidence photo preview.
  - Interactive Incident Details drawer with timeline, reporter info, vehicle/booking references, lightbox photo gallery, and quick-resolve action modal.

### 24.3 Walk-in Direct Check-in & Dialog Dropdown Fixes
- **Radix UI Portal Z-Index Correction:** Resolved issue where dropdown menus and selects inside modal dialogs (`DialogContent`, `z-[200]`) were not opening/clickable. Elevated `SelectContent` (`src/components/ui/select.tsx`) and `DropdownMenuContent` (`src/components/ui/dropdown-menu.tsx`) to `z-[250]`.
- **Walk-in Direct Check-in & Barrier Clearance:**
  - In gate walk-in driver registration (`/security/walk-in`), once cash is collected and confirmed, the booking is directly transitioned to `Active` (rather than `Confirmed`), bay status is directly set to `Occupied`, inventory counts are decremented, and an active `VehicleMovementLog` entry (`movementStatus: 'Vehicle Inside'`, `entryMethod: 'Walk-in'`) is created immediately.
  - Eliminated the redundant second QR scan step for gate staff. The confirmation screen presents a thermal-printable exit pass receipt and clearly indicates the vehicle is checked in directly and bay is occupied.
  - Test suites `server/scripts/test-security-walk-in.ts` (9/9 passed) and `server/scripts/test-security-incidents.ts` (6/6 passed) verified 100%. Both `tsc` and Vite production builds pass with 0 errors.

### 24.4 Vehicle Movement Logs (Phase 5) & Vehicle Registration Uniqueness
- **Backend Architecture & APIs (`server/src/services/security.service.ts`):**
  - Implemented `getMovementLogs`, `getMovementLogDetail`, and `exportMovementLogsCsv`.
  - Added routes in `server/src/routes/security.routes.ts`:
    - `GET /api/v1/security/movement-logs`
    - `GET /api/v1/security/movement-logs/:id`
    - `GET /api/v1/security/movement-logs/export/csv`
  - Enforced authenticated staff and facility scoping via `requireActiveSecurityAssignment` and `assertStaffLotAssignment`.
  - Server-side filtering by Date range (`startDate` to `endDate`), Movement Type (`Entry`, `Exit`, `Entry Denied`, `Exit Denied`), Security Staff member, Vehicle Number, and Customer Name.
  - Multi-criteria debounced search across vehicle registration plates, booking references, customer names, customer phone numbers, and movement IDs.
  - Facility summary metrics aggregation: Total Movements, Vehicles Inside, Completed Exits, Denied Attempts.
- **Frontend Console (`src/pages/security/SecurityMovementLogsPage.tsx`):**
  - Live KPI metric cards for facility movements.
  - Facility context selector with persistent local storage.
  - Interactive table displaying Movement ID, Vehicle Number, Customer, Facility, Bay/Floor/Zone, Movement Type badge, Guard attribution, Timestamps, and Stay Durations.
  - Inspection Dialog (View Details) showing complete linked booking session, customer profile, vehicle profile, gate execution methods, payment ledger, and activity timeline.
  - Direct CSV Export with proper escaping and downloadable Blob link.
  - Print / PDF Manifest export (`window.print()`) formatted with dedicated `@media print` manifest layout.
- **Vehicle Registration Number Uniqueness & Conflict Prevention:**
  - Enforced strict plate uniqueness across all registration flows (Customer profile and on-site Walk-in desk) and prevented active double-entries.

### 24.5 Security Module PDF & CSV Standardization (Matching Customer Module)
- **Root Cause of "Whole Pages Getting Printed":**
  - Previously, `handlePrintReceipt` in `SecurityWalkInPage.tsx` and `handleExportPdf` in `SecurityMovementLogsPage.tsx` directly triggered `window.print()` on the host application DOM. This caused the browser print dialog to capture the host navigation bar, breadcrumbs, search inputs, filters, dark mode background, and dashboard layout across multiple unstructured pages.
- **Customer Module Standard Alignment (`BookingConfirmationDialog.tsx`):**
  - Standardized all PDF and receipt printing across the Security Module onto the isolated popup window mechanism (`window.open('', '_blank', 'width=860,height=920')`).
  - **Walk-in Booking Receipt (`/security/walk-in`):**
    - Opens an isolated document with official ParkEase branding header (`/brand/document-logo.png`), status badge (`CONFIRMED — CASH COLLECTED`), official receipt title, and receipt number.
    - Features large crisp QR pass image, allocated parking bay callout (`Slot, Floor, Zone`), Customer details block, Booking details block, Cash payment details with gate guard attribution, and charges breakdown.
    - Ends with terms & conditions, support email, copyright, and official document footer banner (`/brand/document-footer.png`).
    - Provides both "Print Receipt" and "Download PDF" buttons.
  - **Vehicle Movement Logs Audit Manifest (`/security/movement-logs`):**
    - `handleExportPdf` generates an isolated, professional gate movement audit manifest with official branding header, facility info, auditor metadata, active filter criteria, live status statistics, and a high-contrast tabular ledger with zebra striping and color-coded movement type badges.
    - Inspection dialog includes "Print Slip" for isolated single vehicle movement slips.
    - Added strict `@media print` fallback rules hiding all host application DOM elements (`body * { visibility: hidden }`) if native browser `Ctrl+P` is invoked.
  - **Movement Logs CSV Export:**
    - Standardized date-time formatting in `server/src/services/security.service.ts` using clean Indian standard date/time formatting (`toLocaleString('en-IN', ...)`) for entry and exit timestamps.
    - Formats active entries cleanly as `Currently Inside` instead of empty or raw UTC strings.
    - Preserves column headers starting with `Movement ID,Booking Reference,Vehicle Number` to maintain full test suite compatibility.
- **Testing & Verification:**
  - Automated test suites passing 100%: `test-security-movement-logs.ts` (7/7), `test-security-walk-in.ts` (9/9), `test-security-incidents.ts` (6/6), `test-security-manual-lookup.ts` (10/10), `test-security-scan-and-verification.ts` (8/8).
  - Both frontend (`tsc -b && vite build`) and backend (`tsc`) pass with 0 errors.
  - Enforced strict vehicle registration uniqueness across customer registrations, customer vehicle additions, and security staff walk-in bookings.
  - In `createWalkInBooking`, if a vehicle registration already exists, it verifies that the vehicle belongs to the same customer account. Imposter bookings using other users' plates are rejected with HTTP 409 (`VEHICLE_ALREADY_EXISTS`).
  - Added double-entry and double-parking blockade: if a vehicle already has an active stay in progress (`Active` or `Overstay`), subsequent bookings or entries are blocked with HTTP 409 (`VEHICLE_ALREADY_INSIDE`).
- **Verification & Regression Testing:**
  - Automated test suite `server/scripts/test-security-movement-logs.ts` passed 7/7 tests (100% pass rate).
  - Regression test suites `test-security-incidents.ts` (6/6), `test-security-walk-in.ts` (9/9), `test-security-manual-lookup.ts` (10/10), and `test-security-scan-and-verification.ts` (8/8) all passed 100%.
  - Production TypeScript builds for both backend (`tsc`) and frontend (`tsc -b && vite build`) passed with 0 errors.



