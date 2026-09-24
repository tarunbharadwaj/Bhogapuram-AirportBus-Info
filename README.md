# Vizag Airport Bus MVP

A mobile-first React and Node.js website that recommends an AeroExpress bus based on a traveller's selected stop or current location and flight departure time.

## Project structure

```text
frontend/
  public/                 Static assets and bus favicon
  src/components/         Reusable React UI
  src/pages/              Public and admin pages
  src/lib/                API and formatting helpers

backend/
  src/models/             Service-data persistence and validation
  src/controllers/        HTTP request handlers
  src/routes/             Public and admin API routes
  src/services/           Recommendation and admin-session logic
  src/middleware/         Admin authorization
  src/data/               Default route data
  tests/                  Backend tests
```

The frontend and backend are npm workspaces with their own package manifests.

## Run locally

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000/api`

The public trip-planning APIs include `POST /api/recommendations` for city-to-airport
planning and `POST /api/airport-departures` for the next airport-to-city departures.
The latter accepts `destinationPlaceId` and an ISO `readyAt` time, and evaluates
published schedules in `Asia/Kolkata`.

The Vite development server proxies `/api` requests to the backend.

## Admin

The admin page is intentionally not linked in the public navigation. Open it directly at:

```text
http://localhost:5173/service-admin
```

The MVP demo PIN is `2468`. Set a private production PIN before deployment:

```powershell
$env:ADMIN_PIN='your-private-pin'
npm start
```

Admin changes are saved to `backend/data/service-data.json`. The editor supports public announcements, verification dates, route availability, first/last bus times, frequency, and fares.

On Render's free service, this file is stored on an ephemeral filesystem. Admin edits can disappear after a restart or redeploy, so they must not be treated as permanent production data.

## Service and ticketing data

Canonical route and ticketing information lives in `shared/serviceData.mjs`. The current ticketing status records that AeroExpress tickets are not sold online and must be purchased from the conductor onboard. To change a ticketing status, message, URL, or `checkedDate`, edit the source-controlled `DEFAULT_TICKETING` object, commit the change, and redeploy both applications.

The public planner supports either browser location or a manually selected active bus stop. Intermediate stop times are estimates marked with `~`; route-origin departures remain published times. The timetable defaults to the next five services and includes a full-daily-schedule view for planning ahead.

## Production

Build the Tailwind/React frontend and start the Node API separately:

```bash
npm run build
npm start
```

The frontend output is written to `frontend/dist`. Configure the frontend host to fall back to `index.html` for `/service-admin`, and set `VITE_API_URL` when the API is hosted on a different origin. Set `CLIENT_ORIGIN` on the backend to that frontend origin when cross-origin requests are required.

## Google Analytics 4

Create a GA4 web data stream and copy its Measurement ID (`G-...`). In Netlify, add this frontend build variable under **Project configuration → Environment variables** and redeploy:

```text
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

For local development, copy `frontend/.env.example` to `frontend/.env.local` and add the real ID. The local file is ignored by Git. If the variable is empty or missing, analytics remains disabled. Analytics is also disabled on `/service-admin`.

Tracked events use route codes, stop IDs, flight type, permission outcomes, and broad accuracy bands only. Precise coordinates and flight departure values are never sent.

The contextual planner survey also sends these custom events:

```text
feedback_prompt_shown
feedback_response
feedback_reason_selected
feedback_comment_submitted
feedback_prompt_dismissed
```

In **GA4 → Admin → Data display → Custom definitions**, create event-scoped custom dimensions for `feedback_rating`, `feedback_reason`, `feedback_context`, and `result_status`. Use **Explore → Free form** to compare response rate, ratings, reasons, direction, and successful versus unavailable planner results. Written comments are never sent to GA4.

## Website feedback

The public feedback page is available at `/feedback`. It sends feedback directly to the site owner's email through FormSubmit.co and does not use the Render backend.

Activate the receiving address through [FormSubmit.co](https://formsubmit.co/), confirm the activation email, and copy the random endpoint token. Then add this frontend build variable in Netlify and redeploy:

```text
VITE_FEEDBACK_FORM_ENDPOINT=https://formsubmit.co/ajax/RANDOM_FORM_TOKEN
```

The endpoint must use HTTPS and the `formsubmit.co/ajax/` path. Keep the token in Netlify or `frontend/.env.local`; do not commit it. When the variable is absent or invalid, the feedback page remains available but submission is disabled with a friendly message.

The main feedback page emails the selected category, message, and optional reply email. Planner results also include an inline three-choice survey. Its ratings and reason categories are sent to GA4, while only optional written comments are emailed. Inline comment emails include the rating, selected reason, result context, direction, route code and stop ID so the report is actionable.

The survey is shown only after a planner result. Dismissal suppresses it for seven days and answering suppresses it for ninety days in that browser. The form intentionally does not collect names, phone numbers, attachments, coordinates, flight details, or selected travel times.

## Verification

```bash
npm test
npm run build
```

## Data note

The AeroExpress service launched in August 2026 and an authoritative stop-by-stop public schedule was not available during this build. The seeded routes use publicly reported corridors and service hours; intermediate timings and some fares are explicitly presented as reference estimates. Verify and update them through the admin editor before public launch.
