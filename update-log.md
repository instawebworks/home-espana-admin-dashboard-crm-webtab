# Project Update Log

| Change / Update | Claude Time | Avg Dev Time |
|---|---|---|
| Set dev server to always use port 3002 (added `set PORT=3002` to start script in package.json) | 1 min | 2 min |
| Added Deal Owner filter dropdown above the Client Submissions table; derives unique owners from loaded records and filters table rows in real time | 5 min | 20 min |
| Widened Deal Owner filter dropdown from 220px to 300px | <1 min | 1 min |
| Added Deal Name column to submissions table; fetches deal names in parallel using Related_Record_ID after logs load, caches in a map, truncates with ellipsis at 200px max width | 6 min | 25 min |
| Moved Deal Name to first column; made it a clickable link opening the deal in a new tab using the org ID extracted from window.location | 3 min | 10 min |
| Fixed Deal Name link — hardcoded org ID and used Potentials (internal module name), added ?redirect=false | 2 min | 5 min |
| Updated Deal Name link to use canvas layout URL format (fixed canvas ID, only deal ID changes per row) | 1 min | 2 min |
| Added debounce-based deal name search field; instantly filters current list, fires API search after 500ms for deals outside the loaded 200 and merges results | 10 min | 45 min |
| Fixed chat bubbles in User Messages — bubbles now wrap to content width instead of stretching full row width | 2 min | 5 min |
| Changed "Optional" label to display as "If Applicable" in admin checklist view (underlying data unchanged) | <1 min | 1 min |
| Changed "Optional" label to display as "If Applicable" in Template Editor dialog dropdown (underlying value unchanged) | <1 min | 1 min |
| Added Admin Uploads tab to Admins page — per-requirement upload button, AdminUploadDialog (MUI), adminUploadsCache state, portal proxy upload flow (REACT_APP_PORTAL_URL), .env file | 15 min | 90 min |
| Ported the full dealview widget (hipoteken-dealview-document-approval) into the Admins expanded-row view — new src/components/submission/ with UserUploads (per-applicant tabs, progress meter, status filters, sign-off checkboxes, per-applicant Section_Approvals schema + legacy migration, admin doc strips, awaiting group), ReviewModal (category-coded file naming, unique-name suffixing), RequestDocumentDialog (appends to deal Additional_Template_JSON + widget_request_document email), AdminUploadDialog (Uploaded_For), UserMessages (day separators), SubmissionDetail fetch adapter; removed old 3-tab table UI and all detail caches from Admins.jsx | 40 min | 2-3 days |
| Admins table improvements — removed Related Module column; added Applicants column (gradient avatar initials from Applicants_Listing, max 3 + overflow chip); added Sign-off Progress column (X/Y pill computed from Section_Approvals + deal template requirements, reusing deal records already fetched for names); whole row now clickable to expand (links/buttons stopPropagation); extracted shared helpers to submissionHelpers.js | 12 min | 1 hr |
| Tightened Admins table row density (13px cells, reduced vertical padding, smaller avatars/button) and added "Showing X of Y" count caption at the right of the filter bar | 3 min | 15 min |
| Templates table — removed always-identical Module and Status columns; added Country (Allowed_For_Country) and Documents ("12 docs · 9 required" parsed from Template_JSON) columns; applied same tighter density as Admins table (13px cells, reduced padding) | 4 min | 30 min |
