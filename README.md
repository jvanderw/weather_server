# weather_server

A TypeScript/Node.js API that fetches current conditions from NOAA and serves a flat JSON payload for weather_station on a local network.

## What it does

- Accepts station requests at GET /:stationId
- Fetches NOAA latest observation data
- Returns a flat JSON payload:
  - station
  - temperature (Celsius)
  - relativeHumidity
  - textDescription
- Provides GET /health for station startup checks

## Requirements

- Node.js 18+ (recommended)
- npm

## Install

Run from this folder:

npm install

## Run

Development style run:

npm start

This compiles TypeScript and starts the server on port 3030.

## API

### Health

GET /health

Response example:

{
  "status": "ok"
}

### Weather by station

GET /:stationId

Example:

GET /KPDX

Success response example:

{
  "station": "https://api.weather.gov/stations/KPDX",
  "temperature": 19.4,
  "relativeHumidity": 62,
  "textDescription": "Mostly Cloudy"
}

Error response format:

{
  "error": "human-readable message"
}

Typical status codes:

- 200: success
- 400: invalid request (for example missing stationId)
- 502: NOAA upstream/network/invalid-upstream-response failure
- 504: NOAA timeout failure
- 500: unexpected server-side error

## Test

npm test -- --runInBand

## Launching the server

From this folder:

npm start

That command compiles the TypeScript sources and starts the API on port 3030.

Expected runtime endpoints:

- GET /health
- GET /:stationId

Example local check:

curl http://localhost:3030/health
curl http://localhost:3030/KPDX

## Local network integration with weather_station

- Keep this server running on a host reachable from the Matrix Portal M4 board.
- Use that host IP as server_host in weather_station secrets.
- Keep server_port set to 3030 unless you change this service.

## Manual smoke checks

From a machine on the same LAN:

curl http://<server_host>:3030/health
curl http://<server_host>:3030/<station_id>

## Notes

- The station converts temperature from Celsius to Fahrenheit on-device.
- This server is intentionally simple and unauthenticated for local LAN usage.
