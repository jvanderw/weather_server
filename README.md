# weather_server

A TypeScript/Node.js API that fetches current conditions from NOAA and serves a flat JSON payload for weather_station on a local network.

## What it does

- Accepts station requests at GET /:stationId
- Fetches NOAA latest observation data
- Supports GET /forecast/:coordinates to resolve a NOAA points endpoint and return forecast periods
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

### Forecast periods

GET /forecast/:coordinates

Example:

GET /forecast/45.4838,-122.68

Success response example:

{
  "periods": [
    {
      "number": 1,
      "name": "Today",
      "detailedForecast": "Sunny this afternoon..."
    }
  ]
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

## CI/CD and Deployment

This repository includes GitHub Actions CI/CD for Raspberry Pi deployment with a self-hosted runner on the workstation.

- CI workflow: `.github/workflows/ci.yml`
- CD workflow: `.github/workflows/cd.yml`
- Deploy script: `deploy/scripts/deploy_to_pi.sh`
- Pi bootstrap script: `deploy/scripts/pi_host_setup.sh`
- Systemd unit template: `deploy/systemd/weather_server.service`
- Sudoers template: `deploy/systemd/weather_server.sudoers`

### Pinned deployment target

- Pi SSH target: `weatherdeploy@192.168.0.55`
- Pi app root: `/srv/weather_server`
- Service name: `weather_server.service`
- Health URL: `http://192.168.0.55:3030/health`

### Option A secrets/config (selected)

1. Copy `deploy/env/weather_server.env.example` to `/etc/weather_server/weather_server.env` on the Pi.
2. Set ownership and permissions:

  `sudo chown root:weathersvc /etc/weather_server/weather_server.env`

  `sudo chmod 640 /etc/weather_server/weather_server.env`

3. Ensure `weather_server.service` contains:

  `EnvironmentFile=/etc/weather_server/weather_server.env`

4. Restart service after config changes:

  `sudo systemctl restart weather_server.service`

### Raspberry Pi service setup

Fast path on the Pi:

`sudo bash deploy/scripts/pi_host_setup.sh`

1. Install service template:

  `sudo cp deploy/systemd/weather_server.service /etc/systemd/system/weather_server.service`

2. Reload and enable service:

  `sudo systemctl daemon-reload`

  `sudo systemctl enable weather_server.service`

3. Start service:

  `sudo systemctl start weather_server.service`

### Runner prerequisites

On the self-hosted runner machine:

- SSH key exists at `/home/jessv/.ssh/id_ed25519_weather_pi`
- key permissions: `chmod 600 /home/jessv/.ssh/id_ed25519_weather_pi`
- runner has labels: `self-hosted`, `linux`, `weather-server`
- runner user can execute `ssh`, `rsync`, and repository workflows

On the Pi:

- `weatherdeploy` user can write to `/srv/weather_server/incoming` and `/srv/weather_server/releases`
- `weatherdeploy` can restart the service via sudo (for example allow `sudo systemctl restart weather_server.service` and `sudo systemctl daemon-reload`)
- `deploy/systemd/weather_server.sudoers` can be installed to `/etc/sudoers.d/weather_server`

### Logs and operations

Show service status:

`systemctl status weather_server.service`

Tail logs live:

`journalctl -u weather_server.service -f`

Show last 200 log lines:

`journalctl -u weather_server.service -n 200 --no-pager`
