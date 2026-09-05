# Ummah Local NJ

A Spring Boot hackathon prototype for a Muslim-focused New Jersey business map.
Users can open the locally hosted website, browse a movable map, share their
approximate one-mile area, click a location, and post a community business note
with a website or booking link.

## Setup (new machine)

Only one thing is required: **Java JDK 21**. Maven is not needed — the `mvnw`
wrapper downloads it on first build.

```powershell
winget install --id EclipseAdoptium.Temurin.21.JDK --exact
```

Close and reopen your terminal, then confirm:

```powershell
java -version   # should print 21.x
```

## Local Run

```powershell
cd muslim-local-nj
.\mvnw.cmd spring-boot:run
```

Then open `http://localhost:8080`.

## Demo Flow

1. Open the app and browse the New Jersey map.
2. Click `Use my location` to draw an approximate one-mile circle around the
   browser location.
3. Click the map where a business is located.
4. Fill out the business form and publish the pin.
5. Select pins or directory cards to view posts from other local users.

## Architecture

```text
Browser frontend
  Static HTML/CSS/JS served by Spring Boot
  Leaflet + Stadia "OSM Bright" tiles (Waze-style OpenStreetMap basemap)
  Browser Geolocation API for approximate one-mile radius

Spring Boot backend
  /api/listings REST controller
  Jakarta validation for form inputs and New Jersey coordinate bounds
  Spring Data JPA repository

H2 database
  File-backed local database at muslim-local-nj/data/
  Seed records for first-run demo content
```

## Map Basemap

Waze does not publish its map tiles, so the map uses **Stadia Maps "OSM Bright"** —
OpenStreetMap data drawn in a clean navigation style (cream land, yellow roads,
blue water) that reads like Waze. It needs no API key for local development.

The basemap is one line in `src/main/resources/static/app.js`. To try another
style, swap the URL:

| Style | Tile URL | Key? |
| --- | --- | --- |
| OSM Bright (current, Waze-like) | `https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png` | Localhost: no |
| Alidade Smooth (minimal grey) | `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png` | Localhost: no |
| Esri Light Gray (fallback, works anywhere) | `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}` | No |
| OpenStreetMap standard (original, busiest) | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | No |

Note the Esri URL orders tiles `{z}/{y}/{x}`, not `{z}/{x}/{y}`.

If you deploy this to a public domain, get a free Stadia API key at
<https://client.stadiamaps.com/signup/> and append `?api_key=YOUR_KEY` to the
tile URL. CARTO's free raster tiles are **not** an option — they now stamp
"API KEY REQUIRED" across the image.

## API

`GET /api/listings`

Returns all listings, newest first. Optional query params:
`minLat`, `maxLat`, `minLng`, `maxLng`.

`POST /api/listings`

```json
{
  "ownerName": "Mohammad Shaheer Siddiqi",
  "businessName": "Shaheer Barber Studio",
  "category": "BARBER",
  "comment": "Local barber studio welcoming Muslim clients across central New Jersey.",
  "websiteUrl": "https://example.com",
  "latitude": 40.5187,
  "longitude": -74.4121
}
```

## Team Split

- Backend member: listing model, validation, REST API, persistence.
- Frontend member: map UX, geolocation, posting drawer, responsive layout.
- Architecture/demo member: README, presentation flow, acceptance testing, future
  roadmap.

## Future Enhancements

- User accounts and moderation queue.
- Business search by category, masjid area, city, or halal certification.
- Photo uploads and verified owner profiles.
- Production database such as PostgreSQL.
