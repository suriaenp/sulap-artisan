# Sulap Artisan Portal — Project Notes

Living reference for what's built, what each screen does, and the business rules baked into the code. Update this whenever a tab's behavior changes.

**Stack:** React + Vite, Supabase (installed, not wired), Netlify (deploy target, not set up)
**Status:** Phase 1 (UI, mock data) complete. Phase 2 (Supabase) and Phase 3 (Netlify) not started.
**Repo:** https://github.com/suriaenp/sulap-artisan

---

## Public site (`src/pages/PublicHome.jsx`)
- Browse upcoming markets/events: pricing (F&B vs Non-F&B rate/day), dates, and application status
- **Rule: an event's applications are "open" only if `lastApp` (last date to apply) is unset or still in the future** (`open = !ev.lastApp || new Date(ev.lastApp) >= today`). Once past that date, the event shows "Applications closed" everywhere (public home, vendor dashboard).
- Entry points to Vendor Portal and Admin Console

## Vendor side

### Vendor Registration (`VendorRegister.jsx`)
4-step form: category → business details → photos/power needs → review & accept market terms.
- ⚠️ **Known gap: the "Submit application" button does not persist anything.** It doesn't dispatch to the store or create a vendor record — it's UI-only at the moment. The 5 vendors visible everywhere in the admin console are hardcoded seed data (`src/data/mockData.js`), not something created by using this form. This needs to be wired up (likely as part of Phase 2/Supabase) before registration is real.

### Vendor Login (`VendorLogin.jsx`)
Mock login — no real auth yet, goes straight to Vendor Dashboard as a hardcoded "current vendor" (`CURRENT_VENDOR_ID = 'v1'` in `mockData.js`).

### Vendor Dashboard (`VendorDashboard.jsx`) — 7 tabs
| Tab | What it does |
|---|---|
| Available Markets | Browse events, apply to a market. **Rule: a vendor can only apply if their registration `status === 'approved'`** — pending/suspended vendors see "Awaiting registration approval" and can't click through. Applying is also blocked once an event's `lastApp` date has passed, or if the vendor already applied to that event. |
| My Applications | This vendor's event applications and their status |
| Documents | Vendor's on-file info (read-only, admin-managed) |
| Payments | Rental payment status per **approved** event application only |
| Parking | Parking pass info per approved event |
| Vendor Pass | Physical pass collection/return tracking |
| Profile | Vendor's own registration details |

### Booth sharing rule (apply flow, `Modals.jsx` → `ApplyModal`)
When a vendor applies to an event, they choose solo or shared booth:
- A shared booth can have **up to 3 vendors total** (the applicant + up to 2 partners)
- Booth partners must be the **same tier** — an F&B vendor can only share with other F&B vendors, and a non-F&B vendor only with other non-F&B vendors
- Partners are picked by searching existing registered vendors

## Admin Console (`AdminDashboard.jsx`) — 15 tabs

| Tab | What it does |
|---|---|
| Overview | Stat tiles (total vendors, pending review, active events, payments confirmed) + quick actions |
| **Vendor Applications** | **New sign-ups only** (`status === 'pending'`). Approve/Reject here. Once decided, the vendor drops off this list. |
| **Vendor Listing** | Master list of vendors that have been decided on — `status === 'approved'` or `'suspended'`. Shows each vendor's **compliance tags** (offense counts by type, or "No offences on record"). This is the vendor base eligible to apply for events. |
| Events | Create events (name, image, dates, times, F&B/Non-F&B daily rate + auto 6% SST, last-apply-by date), view existing events with applicant counts |
| Event Applications | Vendors applying to a specific event (filtered by event dropdown) — approve/reject, view shared-booth partners, see up to 3 of the vendor's compliance tags inline |
| Payments | Per approved event application: rental subtotal + 6% SST + RM100 refundable deposit (only added **if that vendor's deposit isn't already paid** — see Deposit Record rule below) = total due. Mark Paid/Partial/Unpaid, toggle payment-advice/invoice/receipt docs, send a payment reminder, or remove a vendor from the event (releases their slot). |
| Deposit Record | RM100 refundable deposit — **tracked once per vendor (not per event), and tied to event participation, not registration.** If unpaid, it's automatically folded into that vendor's *first* event invoice (see `payCalc` in `helpers.js`). Statuses: unpaid → paid → refunded. |
| Parking | Per-day parking ticket numbers for approved applicants of the selected event. **Rule: entry fields are locked (read-only) unless today's date falls within the event's start/end dates** — admin can manually "Override" the lock if needed. |
| Event Pictures | Vendor-uploaded product photos (read-only count) + admin can upload additional event photos per vendor, and download a vendor's uploads |
| Vendor Pass | Physical pass issue/return tracking per vendor (collector name, phone, tags issued/returned, dates) — status: pending → collected → returned |
| Categories | Add/remove vendor categories; reassign a vendor's category from a dropdown; each category shows its member count |
| Activity | ⚠️ **Currently hardcoded mock entries, not a live log.** Filterable by All/Admin/Vendor but the 5 entries shown never change — nothing in the app actually writes to this feed yet. |
| Vendor Chart | Vendor performance/ranking view |
| Compliance | Two sub-tabs: **Log offences** (pick an event, tag vendors with an offense type — only vendors with an *approved* application to that event are selectable) and **Vendor review** (per-vendor offense history, grouped by type with counts — this is the same data source that powers the compliance tags shown in Vendor Listing and Event Applications) |
| Content | Edit public homepage copy (badge text, title, subtitle) and the market terms & conditions text shown at vendor registration step 4 |
| Settings | Three toggles: **Auto-approve vendors** (⚠️ not wired to anything — flipping it has no effect on the registration flow since registration itself isn't wired either), **Show events publicly**, **Email alerts** (also cosmetic — no actual emails are sent anywhere in this prototype) |

---

## Compliance / offense types (`OFFENSE_TYPES` in `mockData.js`)
Fixed list admins tag vendors with: Late opening, Early closing, Late payment, Poor booth cleanup, No-show / last-minute withdraw, Unsanctioned selling. Each has its own color used consistently across Compliance, Vendor Listing, and Event Applications tags.

## Key business rules

1. **Registration ≠ event approval.** A vendor's `status` (`pending` → `approved`/`rejected`, or `approved` → `suspended`) only reflects whether they're allowed to *be* a Sulap vendor at all. It says nothing about payment or event participation.
2. **Vendor must be `approved` before they can apply to any event.** Enforced in `VendorDashboard.jsx`.
3. **Deposit and payment status belong to event participation**, not registration — they must never appear on the registration review screen (Vendor Applications / Vendor Listing "view details" modal).
4. **Deposit is per-vendor, not per-event**, and auto-attaches to the vendor's first unpaid event invoice.
5. **Booth sharing** is capped at 3 vendors and restricted to same-tier (F&B/non-F&B) partners.
6. **Parking ticket entry is time-locked** to the event's actual dates unless manually overridden by admin.
7. **Suspend is reversible, Reject currently is not (in the UI).** Suspend only appears on already-approved vendors, is a small deliberately low-emphasis link (not a full button) behind a confirm dialog, and sets `status: 'suspended'` — vendor loses event-application access but stays visible in Vendor Listing with a "Reinstate vendor" option. There's no UI to un-reject a rejected vendor yet.
8. **All application-detail modals (vendor + event) are centered dialogs**, not bottom sheets.
9. **Events close to applications automatically** once today's date passes the event's `lastApp` date — enforced both on the public home page and inside the vendor dashboard's apply button.

## Vendor status lifecycle

```
pending ──approve──► approved ──suspend──► suspended
   │                     │                      │
   └──reject──► rejected └────────reinstate─────┘
```

## Known gaps / not wired yet

- **Vendor registration form doesn't persist** — "Submit application" doesn't create a vendor record in the store. All 5 vendors in the admin console are seed data.
- **"Auto-approve vendors" and "Email alerts" settings toggles have no effect** — UI exists, logic doesn't.
- **Activity tab is static/fake** — not a real log of admin/vendor actions.
- **No way to un-reject a rejected vendor**, and rejected vendors don't appear in either Vendor Applications or Vendor Listing (they become invisible once rejected).
- **No real authentication** for either vendor or admin login — both are mocked, always logging in as fixed accounts.

## Phase 2 / 3 — not started

- **Supabase:** no tables wired, everything is mock data in `src/data/mockData.js` + in-memory store (`src/lib/store.jsx`). Needs: vendors, events, applications, payments, deposits, offenses, passes, parking tables + real auth — and wiring up registration submit, settings toggles, and the activity log to actually write/read from it.
- **Netlify:** not deployed, no env vars configured.
