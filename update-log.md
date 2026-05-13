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
