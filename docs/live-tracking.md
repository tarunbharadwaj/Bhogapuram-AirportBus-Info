# Experimental AeroExpress GPS tracking

## Trying this branch

Branch: `live-tracking-integration`. This work is not deployed or merged automatically.

1. Use Node.js 22+, run `npm ci`, then `npm run dev`.
2. Open **Live tracking → Find my bus**, select a boarding stop and start tracking.
3. The stop-first view considers city-to-airport trips only. **Browse all buses** retains both directions plus route and vehicle filters.
4. For a branch preview, deploy this branch's backend separately and point the Netlify preview `/api/*` proxy to it. Both frontend and backend are required.

No new API key is used. The adapter reads selected operational fields from APSRTC's publicly readable, undocumented feed. Public readability is not a reuse licence or supported API contract. Confirm acceptable reuse before wider publication and keep the kill switch available.

## Controls

- `LIVE_TRACKING_ENABLED=false` on Render disables all upstream reads and returns a friendly disabled state.
- `VITE_TRACKING_TILE_URL` can replace the default OpenStreetMap raster tile URL. Use only a licensed provider and preserve its required attribution.
- Standard OSM tiles are requested directly by the browser with visible attribution. There is no prefetching, bulk download or proxy. See https://operations.osmfoundation.org/policies/tiles/.

## APIs and safeguards

`GET /api/live-buses` returns the general fleet snapshot.

`GET /api/stop-tracking?placeId=nad-junction` returns at most three airport-bound candidates for one active canonical stop. Optional `routeCode` and timezone-qualified `scheduledOriginAt` filters bind it to a planner result. Unknown stops, inactive or mismatched routes, malformed dates, extra query keys and direction overrides return 400.

- Discovery refreshes every 2 minutes and uses India service dates. Before 04:00 IST it also checks yesterday for late trips.
- GPS refreshes at most every 30 seconds per backend process. Concurrent visitors share one in-flight refresh.
- Public waypoint/VTS progress refreshes with discovery. Route identity comes from distinctive waypoint evidence, never registration or duty prefixes.
- At most 40 candidate buses and four concurrent upstream workers are used. Reads have timeouts and 401/403/429 responses trigger a five-minute backoff.
- GPS older than 2 minutes is stale; GPS older than 30 minutes, future-dated, invalid or implausible is unavailable. Movement is never interpolated.
- Successful snapshots can survive provider failures for up to 5 minutes but are explicitly marked unavailable or partial.
- No staff/passenger fields are requested. No coordinates, distances, selected times, vehicles or trip IDs are sent to GA4. Analytics contain canonical stop ID, route code, direction and broad match/status values only.

## Stop progress

- Provider departure at the selected waypoint, or a later sequence, means the bus has passed and it is excluded.
- Arrival without departure plus nearby recent GPS means **At or near your stop**.
- An earlier sequence plus recent GPS means **Approaching your stop**.
- Stale/missing GPS produces **Last known location** or **GPS unavailable**, never a “most likely” claim.
- Railway Station, RTC Complex and Opposite VUDA Park are omitted from APSRTC's waypoint list. They remain selectable, but only the confirmed waypoints around the segment can establish definitely-before or definitely-passed states. Progress inside the segment is explicitly uncertain.
- Straight-line distance is labelled as such. There is no road ETA, marker simulation or service guarantee.

When no reliable live candidate exists, `nextPublishedServices` is shown separately with wording that the schedule does not confirm current operation.

## Planner integration

To-airport recommendations include **Track this bus**. Matching uses the India journey date, direction, route and published route-origin departure. A unique match is highlighted; ambiguous or absent exact matches fall back to route-and-stop candidates; a passed match is called out; future journeys explain that tracking becomes available on the journey date. From-airport recommendations intentionally have no stop-based tracking action.

## Verification

```sh
npm test
npm run build
npx playwright install chromium webkit
npm run test:tracking:e2e
```

Tests cover India midnight, mapped and unmapped progress, at-stop/departed/passed states, exact planner matching, stale/missing/future/implausible GPS, disabled routes, hostile filters, caching, backoff, privacy-safe response validation, mobile WebKit, desktop Chromium, keyboard-accessible lists, offline recovery, Render cold starts and light/dark layouts.

For real journeys, compare the same trip against APSRTC at multiple stops and times, including lost GPS, tab switching, trip completion and vehicle reassignment. Roll back immediately by setting the kill switch or redeploying the earlier branch if the provider changes or reuse is disallowed.
