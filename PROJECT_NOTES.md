# Sulap Artisan Portal — Project Notes

Living reference for what's built, what each screen does, and the business rules baked into the code. Update this whenever a tab's behavior changes.

**Stack:** React + Vite, Supabase (installed, not wired), Netlify (deploy target, not set up)
**Status:** Phase 1 (UI, mock data) complete. Phase 2 (Supabase) and Phase 3 (Netlify) not started.
**Repo:** https://github.com/suriaenp/sulap-artisan

---

## Public site (`src/pages/PublicHome.jsx`)
- Browse upcoming markets/events, see pricing (F&B vs Non-F&B rate/day) and application status (open/closed)
- Entry points to Vendor Portal and Admin Console

## Vendor side

### Vendor Registration (`VendorRegister.jsx`)
4-step sign-up form. Creates a vendor record with `status: 'pending'`.

### Vendor Login (`VendorLogin.jsx`)
Mock login, goes to Vendor Dashboard.

### Vendor Dashboard (`VendorDashboard.jsx`) — 7 tabs
| Tab | What it does |
|---|---|
| Available Markets | Browse events, apply to a market. **Rule: a vendor can only apply if their registration `status === 'approved'`** — pending vendors see "Awaiting registration approval" and can't click through. |
| My Applications | List of this vendor's event applications and their status |
| Documents | Vendor's on-file info (read-only, admin-managed) |
| Payments | Rental payment status per approved event application |
| Parking | Parking pass info per approved event |
| Vendor Pass | Physical pass collection/return tracking |
| Profile | Vendor's own registration details |

## Admin Console (`AdminDashboard.jsx`) — 15 tabs

| Tab | What it does |
|---|---|
| Overview | Stat tiles + quick actions |
| **Vendor Applications** | **New sign-ups only** (`status === 'pending'`). Approve/Reject here. Once decided, the vendor drops off this list. |
| **Vendor Listing** *(new)* | Master list of vendors that have been decided on — `status === 'approved'` or `'suspended'`. Shows each vendor's **compliance tags** (offense counts by type, or "No offences on record"). This is the vendor base that's eligible to apply for events. |
| Events | Create events, set pricing/dates, view existing events |
| Event Applications | Vendors applying to a specific event — approve/reject, view shared-booth partners |
| Payments | Track rental payment status per event application |
| Deposit Record | RM100 refundable deposit tracking — **this is per-vendor, tied to their first event participation, not to registration.** Auto-added to first event invoice if unpaid. |
| Parking | Parking pass assignment for approved event applicants |
| Event Pictures | Photo uploads per event |
| Vendor Pass | Physical pass issue/return tracking |
| Categories | Manage vendor category list |
| Activity | Admin action log |
| Vendor Chart | Vendor performance/ranking view |
| Compliance | Log offences (per event) + review offence history per vendor |
| Content | Site content management |
| Settings | Admin settings |

---

## Key business rules (as of 2026-07-10)

1. **Registration ≠ event approval.** A vendor's `status` (`pending` → `approved`/`rejected`) only reflects whether they're allowed to *be* a Sulap vendor at all. It says nothing about payment or event participation.
2. **Vendor must be `approved` before they can apply to any event.** Enforced in `VendorDashboard.jsx`.
3. **Deposit and payment status belong to event participation**, not registration — they must never appear on the registration review screen (vendor Applications / Vendor Listing "view details" modal).
4. **Suspend is reversible, Reject is not (in current UI).** Suspend only appears on already-approved vendors, is a small deliberately low-emphasis link (not a full button) behind a confirm dialog, and sets `status: 'suspended'` — vendor loses event-application access but stays visible in Vendor Listing with a "Reinstate vendor" option. There's currently no UI to un-reject a rejected vendor.
5. **All application-detail modals (vendor + event) are centered dialogs**, not bottom sheets.

## Vendor status lifecycle

```
pending ──approve──► approved ──suspend──► suspended
   │                     │                      │
   └──reject──► rejected └────────reinstate─────┘
```

## Pending / not built yet

- **Phase 2 — Supabase:** no tables wired, everything is mock data in `src/data/mockData.js` + in-memory store (`src/lib/store.jsx`). Needs: vendors, events, applications, payments, deposits, offenses, passes, parking tables + auth.
- **Phase 3 — Netlify:** not deployed, no env vars configured.
- No way to un-reject a rejected vendor from the UI yet.
- No admin visibility filter for "rejected" vendors (they don't show in Vendor Applications or Vendor Listing once rejected).
