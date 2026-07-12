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
4-step form: business details + category + password → contact/social/logistics → product photos → review & accept market terms.
- **Fully wired (as of 2026-07-11):** all fields are controlled, bound to `state.rf`. Step 1 validates business name/owner/email/phone, category selection, and an 8+ char password before advancing. Submitting on step 4 requires terms acceptance, then dispatches a new vendor record (`status: 'pending'`, `regDate` = today) into the store — it shows up immediately in the admin's Vendor Applications queue. Photo upload is a mock tile counter (up to 8), not real file upload.
- Still mock/local only — nothing is persisted server-side yet (no Supabase), so registrations don't survive a page refresh.

### Vendor Login (`VendorLogin.jsx`)
Mock login — no real auth yet, goes straight to Vendor Dashboard as a hardcoded "current vendor" (`CURRENT_VENDOR_ID = 'v1'` in `mockData.js`).

### Vendor Dashboard (`VendorDashboard.jsx`) — 7 tabs
| Tab | What it does |
|---|---|
| Available Markets | Browse events, apply to a market. **Rule: a vendor can only apply if their registration `status === 'approved'`** — pending/suspended vendors see "Awaiting registration approval" and can't click through. Applying is also blocked once an event's `lastApp` date has passed, or if the vendor already applied to that event. |
| My Applications | This vendor's event applications and their status |
| Documents | Vendor's on-file info (read-only, admin-managed) |
| Payments | Rental payment status per **approved** event application only. **Upload wired (as of 2026-07-11):** vendor can upload their own payment advice (toggle button — mock, no real file); once admin marks that application `partial`, a second "Upload second payment advice (remaining balance)" button appears. If the vendor is overpaid (admin recorded more paid than the total due), a red banner shows the overpaid amount and the refund status admin has set (in progress / completed with ref code + date + time), until admin closes the case. |
| Parking | Parking pass info per approved event |
| Vendor Pass | Physical pass collection/return tracking |
| Profile | Vendor's own registration details |

### Booth sharing rule (apply flow, `Modals.jsx` → `ApplyModal`)
When a vendor applies to an event, they choose solo or shared booth:
- A shared booth can have **up to 3 vendors total** (the applicant + up to 2 partners)
- Booth partners must be the **same tier** — an F&B vendor can only share with other F&B vendors, and a non-F&B vendor only with other non-F&B vendors
- **Booth partners must be `approved` vendors** (fixed 2026-07-11 — the partner search previously let `pending`/`suspended` vendors show up and be picked; now filtered out alongside the tier check)
- Partners are picked by searching existing registered vendors (live search-as-you-type on business name, up to 5 results)

## Admin Console (`AdminDashboard.jsx`) — 15 tabs

| Tab | What it does |
|---|---|
| Overview | Stat tiles (total vendors, pending review, active events, payments confirmed) + quick actions |
| **Vendor Applications** | **New sign-ups only** (`status === 'pending'`). Approve/Reject here. Once decided, the vendor drops off this list. |
| **Vendor Listing** | Master list of vendors that have been decided on — `status === 'approved'` or `'suspended'`. Shows each vendor's **compliance tags** (offense counts by type, or "No offences on record"). This is the vendor base eligible to apply for events. |
| Events | Create events (name, image, dates, times, F&B/Non-F&B daily rate + auto 6% SST, last-apply-by date), view existing events with applicant counts. **Editing wired (as of 2026-07-11):** clicking an existing event row opens a centered "Edit event" modal (name, location, image, dates, times, last-apply date, rates) prefilled from that event, with a live duration + rental-total preview matching the create form. Saving recomputes `dateRange`/`days` and updates the event in place. **Event image is a mock color-swatch picker** (`EVENT_IMG_PALETTE` in `mockData.js`, 6 preset gradients) in both create and edit — not a real photo upload, since there's no storage backend yet. The 3 seeded events keep their real static image assets (`/public/assets/event-*.png`) until an admin picks a swatch for them, at which point that photo is replaced by the chosen color. |
| Event Applications | **Two sub-tabs (as of 2026-07-12, superseding the old single-list flow described below through several sessions): Applications and Shortlist.** **Applications** lists vendors applying to the event filtered by the dropdown, `status === 'pending'` only, each showing up to 3 compliance tags and a **Shortlist** button (`status → 'shortlisted'`) plus "View & share booth". **Shortlist** is the final roster for that event — `status === 'shortlisted'` or `'approved'` vendors, grouped by category, sorted shortlisted-first. Shortlisted vendors get **Approve** (`→ 'approved'`) and **Reject** (`→ 'pending'`, moves them back to Applications) buttons, unless they're on a compliance hold (see rule 13) in which case Approve is replaced by **Override hold**. Approved vendors show a faint "Approved" label and a **Release vendor** link (see rule 14, added 2026-07-12). **Booth partner profiles wired (as of 2026-07-11):** clicking a partner row in the "View & share booth" detail opens that vendor's full profile (same modal as Vendor Listing), on top of the same tab; closing the profile returns to the application detail instead of just closing outright. **Desktop layout is a 2-column grid** (see business rule 10) instead of one long single-column list. Page size bumped from 15 to 20 (`PER_PAGE` in `store.jsx`, shared across every paginated admin list, not just this tab). |
| Payments | Per approved event application: rental subtotal + 6% SST + RM100 refundable deposit (only added **if that vendor's deposit isn't already paid** — see Deposit Record rule below) = total due. Send a payment reminder, or remove a vendor from the event (releases their slot — different from closing a refund case, see rule 11). **Document directions fixed (as of 2026-07-11):** Payment advice is **vendor-uploaded** — admin only downloads it (shows a faint "not yet uploaded by vendor" label until the vendor has one on file; no admin-side toggle since admin can't upload it themselves). Invoice and Receipt remain **admin-uploaded**, unchanged toggle behavior. **Per-market export added (as of 2026-07-11):** an Export button next to the event filter exports the currently-filtered market's payment data (mock — shows a toast, not a real file yet). **Second payment advice + overpayment/refund flow added (as of 2026-07-11):** see business rule 11 below. **"Mark Paid/Partial/Unpaid" replaced with "Record payment" (as of 2026-07-11):** see business rule 12 below. |
| Deposit Record | RM100 refundable deposit — **tracked once per vendor (not per event), and tied to event participation, not registration.** If unpaid, it's automatically folded into that vendor's *first* event invoice (see `payCalc` in `helpers.js`). Statuses: unpaid → paid → refunded. |
| Parking | Per-day parking ticket numbers for approved applicants of the selected event. **Rule: entry fields are locked (read-only) unless today's date falls within the event's start/end dates** — admin can manually "Override" the lock if needed. |
| Event Pictures | Vendor-uploaded product photos (read-only count) + admin can upload additional event photos per vendor, and download a vendor's uploads |
| Vendor Pass | Physical pass issue/return tracking per vendor (collector name, phone, tags issued/returned, dates) — status: pending → collected → returned |
| Categories | **Expandable accordion cards (redesigned 2026-07-12).** Each category shows icon + name + full description + member count; click to expand/collapse and see vendors nested inside. Admin can add categories (via modal: name + description + icon picker) or remove categories (with confirmation). Vendors are reassignedto different categories via inline dropdown. Search box filters vendors across all categories. All categories now pull from store (`INITIAL_CATS`, `cats` state), so new categories added in admin automatically appear in vendor sign-up registration form. |
| Activity | **Live log (as of 2026-07-11).** Real entries are appended via a `logActivity()` store helper on: vendor approve/reject/suspend/reinstate/reconsider, event application approve/reject, event creation, category add, offence logging, content updates, deposit record updates, and vendor-side registration/event-application submissions. Newest first, filterable by All/Admin/Vendor. Seeded with 5 historical entries on first load. |
| Vendor Chart | Vendor performance/ranking view |
| Compliance | Two sub-tabs: **Log offences** (pick an event, tag vendors with an offense type — only vendors with an *approved* application to that event are selectable) and **Vendor review** (per-vendor offense history, grouped by type with counts — this is the same data source that powers the compliance tags shown in Vendor Listing and Event Applications) |
| Content | Edit public homepage copy (badge text, title, subtitle) and the market terms & conditions text shown at vendor registration step 4 |
| Settings | Three toggles: **Auto-approve vendors** (wired as of 2026-07-11 — when on, registration submits directly with `status: 'approved'` instead of `'pending'`, skips the Vendor Applications queue, and shows a "You're in!" confirmation instead of "we'll review it"), **Show events publicly**, **Email alerts** (wired as of 2026-07-11 — when on, vendor status-change toasts append "· vendor emailed"; no real email is sent, this is still a mock signal, not an actual notification system) |

---

## Compliance / offense types (`OFFENSE_TYPES` in `mockData.js`)
Fixed list admins tag vendors with: Late opening, Early closing, Late payment, Poor booth cleanup, No-show / last-minute withdraw, Unsanctioned selling. Each has its own color used consistently across Compliance, Vendor Listing, and Event Applications tags.

## Key business rules

1. **Registration ≠ event approval.** A vendor's `status` (`pending` → `approved`/`rejected`, or `approved` → `suspended`) only reflects whether they're allowed to *be* a Sulap vendor at all. It says nothing about payment or event participation. An approved vendor's individual event applications still each need their own admin decision — event application status (`pending`/`approved`/`rejected` on the application record) is a **separate status from vendor registration status**, even though both reuse the same three words. To keep them from being confused for each other (fixed 2026-07-11): the admin Event Applications list drops the badge entirely and uses buttons instead (see that tab's row above); the vendor's own My Applications tab labels its badge "Awaiting review" instead of "Pending" for the equivalent state.
2. **Vendor must be `approved` before they can apply to any event, or appear in booth-sharing search.** A vendor still sitting in the Vendor Applications queue (`pending`) has zero event-side visibility — no Apply access of their own, and other vendors can't find or add them as a booth partner. Enforced in `VendorDashboard.jsx` (apply gate) and the partner search in `Modals.jsx` → `ApplyModal` (`v.status === 'approved'` filter, fixed 2026-07-11 — see mock data note below).
3. **Deposit and payment status belong to event participation**, not registration — they must never appear on the registration review screen (Vendor Applications / Vendor Listing "view details" modal).
4. **Deposit is per-vendor, not per-event**, and auto-attaches to the vendor's first unpaid event invoice.
5. **Booth sharing** is capped at 3 vendors and restricted to same-tier (F&B/non-F&B) partners.
6. **Parking ticket entry is time-locked** to the event's actual dates unless manually overridden by admin.
7. **Suspend and Reject are both reversible.** Suspend only appears on already-approved vendors, is a small deliberately low-emphasis link (not a full button) behind a confirm dialog, and sets `status: 'suspended'` — vendor loses event-application access but stays visible in Vendor Listing with a "Reinstate vendor" option. Rejected vendors are hidden by default under a collapsed "Show N rejected applications" section at the bottom of Vendor Applications, with a "Reconsider" action that moves them back to `'pending'`.
8. **All detail/edit modals (vendor, event application, and event edit) are centered dialogs**, not bottom sheets.
9. **Events close to applications automatically** once today's date passes the event's `lastApp` date — enforced both on the public home page and inside the vendor dashboard's apply button.
10. **Admin card lists are 2 columns on desktop, 1 on mobile** (`.admin-cards` CSS class, `AdminDashboard.jsx`, as of 2026-07-11) — applied to every top-level paginated/browsable card list in the admin console (Vendor Applications incl. its rejected sub-list, Vendor Listing, Events, Event Applications, Payments, Deposit Record, Parking, Event Pictures, Vendor Pass, Categories incl. "Vendors by category", Compliance's both sub-tabs). Deliberately *not* applied to the Activity feed (a chronological timeline with connecting lines — 2 columns would break reading order) or the Vendor Chart ranking (a single card with an internal ranked list, not a list of cards).
11. **Second payment advice + overpayment/refund flow (as of 2026-07-11).** When admin marks a vendor's event payment `partial`, the vendor's Payments tab gains a second "Upload second payment advice (remaining balance)" button (`payments[key].advice2`) — admin can then download it too, mirroring the first. Separately, if a vendor is overpaid (`paid > total due`, computed live, not stored), both sides show an "Overpaid by RM X" banner. Admin gets an **Arrange refund** action (`RefundModal` in `Modals.jsx`) requiring reference code + date + time before it can be marked complete (`refunds[vendorId-eventId]`, `MERGE_REFUNDS`); once complete, admin gets a **Close case** button. The vendor sees the same refund status read-only (in progress → completed → closed) so both sides always agree on where the refund stands — closing doesn't delete the record, it just stops showing the action buttons and switches to a muted "Refund closed" line on both sides.
12. **Payment status is derived from an amount, never asserted directly (as of 2026-07-11).** The old "Mark: Paid / Partial / Unpaid" buttons let admin flip the status label without ever recording how much was actually received (the standalone "Paid" button didn't even open the amount modal). Replaced with a single **Record payment** button (pre-filled with the outstanding total for a one-click exact match) that always takes an amount and derives status: amount = total → `paid`; amount < total → `partial`; amount > total → `paid` + triggers the overpaid/refund flow (rule 11); amount = 0 → `unpaid`. A separate **Reset to unpaid** button handles corrections without opening the modal. This is the actual live `PayModal`, defined in `App.jsx` — a near-identical but unused duplicate `PayModal` in `Modals.jsx` was deleted in the same pass (dead code that had silently drifted out of sync with the one actually rendered).
13. **Compliance hold blocks Approve on the Shortlist tab.** A shortlisted vendor with unresolved offences in the last `skipN` markets (settings-configurable "skip after N offences" window) cannot be approved directly — `complianceHold(vendorId, eventId)` in `AdminDashboard.jsx` returns their matching offences, and if any exist and no override is on file (`compOverrides[vendorId-eventId]`), the row shows an amber hold banner and swaps the Approve button for **Override hold**, which sets `compOverrides[...] = true` (logged + toasted) and unlocks the normal Approve button — it does not clear or resolve the underlying offences, only permits this one approval.
14. **Release vendor (added 2026-07-12) reverses an approval, same target state as Reject.** Once an application reaches `status === 'approved'` on the Shortlist tab, no other action existed to undo it (a prior session's fix, commit `f71666b`, intentionally removed the old "Remove" button so approved vendors "stay" in the Shortlist as the record for that market). For last-minute vendor cancellations, a **Release vendor** text link is available — deliberately low-emphasis (underlined text, no background, red tint) rather than a full button, matching the existing Suspend-vendor pattern (rule 7), since this is a rare, consequential action that shouldn't visually compete with the primary Approve/Reject flow. **Positioned in the button row next to "View & share booth" (fixed 2026-07-12), not beside the name/Approved label** — an earlier placement wrapped inconsistently at narrow widths depending on vendor name length and whether the "Sharing" tag was present. Behind a `window.confirm` guard naming the vendor; on confirm it sets `status: 'pending'` — identical destination to the shortlist Reject action — so the vendor reappears in the Applications tab exactly as if never decided, rather than being deleted or left in limbo. Logs via `logActivity` and shows a toast, matching every other status transition in this tab.

15. **Category data model (as of 2026-07-12): `{id, name, description, icon}`.** Previously `INITIAL_CATS` had only `{id, name}` (bare structure) while `VendorRegister.jsx` maintained its own hardcoded duplicate with full metadata. Now unified: a single `INITIAL_CATS` in mockData provides all fields. VendorRegister pulls `cats` from store instead of hardcoded; admin's Categories tab can add categories with the modal providing name + description + icon picker. All categories now sync across vendor sign-up and admin console — add a category in admin, it appears in the sign-up form immediately.

## Vendor status lifecycle

```
pending ──approve──► approved ──suspend──► suspended
   │  ▲                  │                      │
   │  └──reconsider──┐   │                      │
   └──reject──► rejected └────────reinstate─────┘
```
(Auto-approve setting on: registration goes straight to `approved`, bypassing `pending` entirely.)

**Mock data fix (2026-07-11):** the original seed data had Borneo Brews (`v2`) and Pulau Soap Co. (`v4`) marked `status: 'pending'` while already carrying event applications, a payment record, offense history, and (for Pulau Soap Co.) an approved shared booth — which violates rule 2 above. Both were corrected to `approved` since their data already reflects real event participation. Two new vendors (`v6` Kadazan Silver, `v7` Rumah Anyaman) were added as clean `pending` examples with no event footprint, to keep the Vendor Applications queue demo intact.

## Known gaps / not wired yet

- **No real authentication** for either vendor or admin login — both are mocked, always logging in as fixed accounts.
- **"Email alerts" is a mock signal, not real email** — the toast note ("· vendor emailed") is cosmetic confirmation that the setting is respected; no actual email is sent anywhere in this prototype.
- **"Show events publicly" toggle is still not wired** — flipping it doesn't currently hide events from the public home page.
- **Payment advice / invoice / receipt uploads are all mock toggles, not real files** — vendor's "upload" and admin's "upload"/"download" buttons just flip a boolean and show a toast; no file is ever actually stored or transferred anywhere. Needs real storage (Phase 2) for any of it to be end-to-end. Fixed 2026-07-11: vendor-side upload UI now exists (it didn't before), so the *flow* is complete — just not backed by real files yet.
- **Event image is a color-swatch picker, not a real photo upload** — no file is ever uploaded or stored; needs Supabase storage (Phase 2) for real event photos.

## Phase 2 / 3 — not started

- **Supabase:** no tables wired, everything is mock data in `src/data/mockData.js` + in-memory store (`src/lib/store.jsx`). Needs: vendors, events, applications, payments, deposits, offenses, passes, parking, activity tables + real auth, and a real email/notification provider.
- **Netlify:** not deployed, no env vars configured.
