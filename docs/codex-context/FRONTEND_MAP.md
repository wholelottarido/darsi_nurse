# Frontend Map

## Main pages under `app/(app)`

- `app/(app)/layout.tsx` gates the app shell behind nurse auth.
- `app/(app)/dashboard/page.tsx` shows the nurse dashboard and quick actions.
- `app/(app)/pasien/page.tsx` shows the patient list.
- `app/(app)/tambah-pasien/page.tsx` is the legacy patient-create form.
- `app/(app)/triage-igd/page.tsx` is the triage landing page.
- `app/(app)/triage-igd/[patientId]/page.tsx` is the patient-specific triage workspace.
- `app/(app)/asisten-perawat/page.tsx` is the nurse assistant chat page.

## Auth and landing pages

- `app/login/page.tsx` handles nurse and admin log-in.
- `app/register/page.tsx` handles nurse registration requests.
- `app/page.tsx` redirects to dashboard or portal.

## Log admin UI

- `app/log-admin/layout.tsx` protects the observability area.
- `app/log-admin/page.tsx` renders the log dashboard and nurse selector.

## Main components

| Component | Responsibility | Notes |
| --- | --- | --- |
| `src/components/layout/AppShell.tsx` | App frame for authenticated pages | Sidebar + header + breadcrumb shell. |
| `src/components/layout/Header.tsx` | Top bar, search field, theme, logout | Uses active nav item. |
| `src/components/layout/Sidebar.tsx` | Desktop sidebar navigation | Uses `NAV_ITEMS`. |
| `src/components/layout/MobileSidebarSheet.tsx` | Mobile sidebar drawer | Reuses `Sidebar`. |
| `src/components/layout/AppBreadcrumb.tsx` | Breadcrumb path rendering | Maps app routes to labels. |
| `src/components/layout/StaffProfileMenu.tsx` | User profile dropdown | Logout trigger for nurse session. |
| `src/components/layout/logo.tsx` | Theme-aware logo | Uses `next-themes`. |
| `src/components/layout/theme-provider.tsx` | Theme provider wrapper | App-level theme state. |
| `src/components/layout/theme-toggle.tsx` | Theme toggle button | Simple dark/light switch. |
| `src/components/chat/MarkdownMessage.tsx` | Markdown-like chat renderer | Used by the nurse assistant UI. |
| `src/components/log-admin/log-admin-dashboard.tsx` | Audit dashboard table and detail drawer | Fetches interaction details on demand. |
| `src/components/log-admin/log-admin-logout-button.tsx` | Admin logout action | Client-side logout button. |

## Notes

- `src/components/ui/*` are shared design-system primitives.
- `dashboard`, `pasien`, and triage pages are the main operational views.
- `triage-igd/[patientId]/page.tsx` is large and should be opened only when needed.

