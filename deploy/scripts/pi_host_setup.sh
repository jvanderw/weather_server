#!/usr/bin/env bash
set -euo pipefail

service_user="weathersvc"
deploy_user="weatherdeploy"
app_root="/srv/weather_server"
env_dir="/etc/weather_server"
service_name="weather_server.service"
service_source="$(cd "$(dirname "$0")/.." && pwd)/systemd/${service_name}"
env_example_source="$(cd "$(dirname "$0")/.." && pwd)/env/weather_server.env.example"
sudoers_source="$(cd "$(dirname "$0")/.." && pwd)/systemd/weather_server.sudoers"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo on the Raspberry Pi." >&2
  exit 1
fi

if ! id -u "${deploy_user}" > /dev/null 2>&1; then
  echo "Missing deploy user: ${deploy_user}" >&2
  exit 1
fi

if ! command -v node > /dev/null 2>&1 || ! command -v npm > /dev/null 2>&1; then
  echo "Node.js 20+ and npm must be installed before running this script." >&2
  exit 1
fi

node_major="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
if [[ ! "${node_major}" =~ ^[0-9]+$ || "${node_major}" -lt 20 ]]; then
  echo "Node.js 20+ is required; found $(node --version)." >&2
  exit 1
fi

if ! id -u "${service_user}" > /dev/null 2>&1; then
  useradd --system --home /nonexistent --shell /usr/sbin/nologin "${service_user}"
fi

mkdir -p "${app_root}/incoming" "${app_root}/releases" "${env_dir}"
chown -R "${deploy_user}:${deploy_user}" "${app_root}"
chmod 755 "${app_root}" "${app_root}/incoming" "${app_root}/releases"

install -o root -g root -m 644 "${service_source}" "/etc/systemd/system/${service_name}"

if [[ ! -f "${env_dir}/weather_server.env" ]]; then
  install -o root -g "${service_user}" -m 640 "${env_example_source}" "${env_dir}/weather_server.env"
else
  chown root:"${service_user}" "${env_dir}/weather_server.env"
  chmod 640 "${env_dir}/weather_server.env"
fi

install -o root -g root -m 440 "${sudoers_source}" "/etc/sudoers.d/weather_server"
visudo -cf /etc/sudoers.d/weather_server

systemctl daemon-reload
systemctl enable "${service_name}"

echo "Pi host setup complete."
echo "Edit ${env_dir}/weather_server.env, then start with: sudo systemctl start ${service_name}"
