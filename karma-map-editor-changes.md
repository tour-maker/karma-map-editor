# karma-map-editor — Client + QA Change List

Scope note: implement OTP as **UI only**. Build the OTP input step (code boxes, verify button, resend timer) and wire the form flow up to it, but stub the actual send/verify calls — do NOT integrate any SMS provider. Leave two clearly named stub functions (e.g. `sendOtp()` / `verifyOtp()`) that currently just simulate success, so provider integration can be dropped in later without touching the UI.

Do not change anything outside what's listed below.

---

## 1. Auth — Sign Up form (`src/components/ui/UserAuthModal.jsx`)
- Rebuild the Sign Up form to include these fields, matching the client's main site:
  - User Type (dropdown, e.g. Broker)
  - First Name / Last Name
  - Mobile Number
  - Password
  - Email Address (optional)
  - "I agree to terms and condition of Karma Realtor's T&C" checkbox
  - "Register Now" button
  - "Already have an account? Login here" link
- After "Register Now" is pressed, show an OTP verification step (digit-box input + Verify button + resend timer). Stub the send/verify logic per the scope note above.

## 2. Landmarks toggle button (`src/components/ui/FilterBar.jsx`)
- When landmarks are hidden, the "Landmarks" button must visually switch to an inactive/off state. Currently it stays looking active even when landmarks are hidden.

## 3. Map labels toggle (new)
- Add a new button (near the Landmarks toggle) to show/hide Google Maps default labels on the map.

## 4. Location search — sticky position (`src/components/SearchBox.jsx` / `FilterBar.jsx`)
- The location dropdown/search list should stay fixed in place (not scroll away) when the user scrolls down within it.

## 5. Sq Yard / Wingha mutual exclusivity (`src/components/ui/FilterBar.jsx`)
- When "Sq Yard" is selected, properties measured in "Wingha" should be hidden from the map, and vice versa — only one unit type's properties should be visible at a time based on the active filter.

## 6. Category options per unit type (`src/components/ui/FilterBar.jsx`, `src/config/categories.js`)
- When **Sq Yard** is selected: hide category options that don't apply — Industrial, Agriculture, Ready Farmhouse.
- When **Wingha** is selected: hide category options that don't apply — Commercial, Industrial.

## 7. Share link uses real URL (`src/components/ui/WhatsAppCTA.jsx` or wherever share is built)
- The WhatsApp share message should include the actual current browser URL (with active filters/state if applicable), not a hardcoded link.

## 8. Page thumbnail + meta tags (`index.html`)
- Add an OG/meta thumbnail image, title, and description so shared links render a proper preview card (WhatsApp, etc.).

## 9. Contact Us link uses real URL
- Same fix as #7 — Contact Us should also pull the current browser URL, not a hardcoded one.

## 10. Help instructions — add missing entries (`src/components/ui/HelpInstructionOverlay.jsx`)
- Add instruction text/entries for:
  - "Add Your Property" button
  - "Sign In" button
  - The main search bar ("Search for a place or property...")

## 11. Help instructions overlay — visual style (`src/components/ui/HelpInstructionOverlay.jsx`)
- Remove the blur effect on the background. It should just be a solid black overlay with lowered opacity — same behavior on both desktop and mobile.

## 12. Property popup — polygon/pin visible when panel used (`src/components/PropertyInfoPanel.jsx`)
- When a property is selected and its info panel/card is shown, the corresponding map pin/polygon should remain visible on the map (currently it's obscured/hidden behind or by the panel).

## 13. Property card — don't hijack clicks (`src/components/PropertyInfoPanel.jsx`)
- Clicking anywhere on the property card should NOT redirect to Google Maps. Only the dedicated "Open in Google Maps" button should trigger that.

## 14. "Open in Google Maps" — satellite mode (`src/components/PropertyInfoPanel.jsx`)
- The new tab opened via "Open in Google Maps" should load in satellite view by default.

## 15. Hide empty parameter rows (`src/components/PropertyInfoPanel.jsx`)
- Hide parameter labels (OP, FP, Remark, etc.) entirely whenever their corresponding value is unavailable/empty, instead of showing an empty or placeholder value.

## 16. Popup unit-type default bug (`src/components/PropertyInfoPanel.jsx`)
- Currently, if neither Sq Yard nor Wingha is selected in the filter, the property popup defaults to showing "Sq Yard" even for a Wingha property. Fix so the popup always reflects the property's actual unit type, regardless of filter state.

## 17. My Requests panel — keep polygon visible on close (`src/components/ui/MyRequestsPanel.jsx`)
- When a user clicks a project/request in the panel and then closes the panel, the associated polygon should remain visible on the map (currently it gets hidden along with the panel).

## 18. My Requests panel — status buttons act as filters (`src/components/ui/MyRequestsPanel.jsx`)
- Clicking Pending / Approved / Rejected should filter the map/property list to show only matching properties, hiding the rest.

## 19. My Requests panel — delete rejected items (`src/components/ui/MyRequestsPanel.jsx`, backend route)
- Add a delete button on Rejected items. Needs a small backend delete endpoint (likely in `server/routes/submissions.js`) in addition to the UI button.

## 20. Mobile responsive — search bar overlap (`src/index.css` / relevant component)
- On mobile, the search bar and the filter icon next to it are overlapping/merging. Fix spacing/layout so they render cleanly separated.

---

## Suggested implementation order
1. Filter logic: #2, #3, #4, #5, #6, #20
2. Property popup: #12, #13, #14, #15, #16
3. Links/meta/help: #7, #8, #9, #10, #11
4. My Requests panel: #17, #18, #19
5. Auth UI (OTP stubbed): #1
