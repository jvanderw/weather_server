#!/usr/bin/env bash
set -euo pipefail

required_vars=(
  DEPLOY_ARTIFACT
  PI_HOST
  PI_USER
  SSH_KEY_PATH
  REMOTE_APP_ROOT
  SERVICE_NAME
  HEALTH_URL
  RELEASE_ID
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required variable: ${var_name}" >&2
    exit 1
  fi
done

if [[ ! -f "${DEPLOY_ARTIFACT}" ]]; then
  echo "Artifact not found: ${DEPLOY_ARTIFACT}" >&2
  exit 1
fi

incoming_dir="${REMOTE_APP_ROOT}/incoming"
releases_dir="${REMOTE_APP_ROOT}/releases"
current_link="${REMOTE_APP_ROOT}/current"
artifact_name="weather_server_${RELEASE_ID}.tar.gz"

ssh_opts=(
  -i "${SSH_KEY_PATH}"
  -o BatchMode=yes
  -o StrictHostKeyChecking=yes
)

echo "Preparing deployment directories on Pi"
ssh "${ssh_opts[@]}" "${PI_USER}@${PI_HOST}" \
  "mkdir -p '${incoming_dir}' '${releases_dir}'"

echo "Transferring artifact to Pi"
rsync -av --progress -e "ssh -i ${SSH_KEY_PATH} -o BatchMode=yes -o StrictHostKeyChecking=yes" \
  "${DEPLOY_ARTIFACT}" "${PI_USER}@${PI_HOST}:${incoming_dir}/${artifact_name}"

echo "Executing remote release deployment"
ssh "${ssh_opts[@]}" "${PI_USER}@${PI_HOST}" bash -s -- \
  "${REMOTE_APP_ROOT}" "${SERVICE_NAME}" "${HEALTH_URL}" "${RELEASE_ID}" "${artifact_name}" <<'REMOTE_SCRIPT'
set -euo pipefail

app_root="$1"
service_name="$2"
health_url="$3"
release_id="$4"
artifact_name="$5"

incoming_dir="${app_root}/incoming"
releases_dir="${app_root}/releases"
current_link="${app_root}/current"
release_dir="${releases_dir}/${release_id}"

mkdir -p "${release_dir}"
tar -xzf "${incoming_dir}/${artifact_name}" -C "${release_dir}"

pushd "${release_dir}" > /dev/null
npm ci --omit=dev
popd > /dev/null

previous_target=""
if [[ -e "${current_link}" ]]; then
  previous_target="$(readlink -f "${current_link}" || true)"
fi

ln -sfn "${release_dir}" "${current_link}"
sudo systemctl daemon-reload
sudo systemctl restart "${service_name}"

if ! curl -fsS "${health_url}" > /dev/null; then
  echo "Health check failed after deploy" >&2
  if [[ -n "${previous_target}" ]]; then
    echo "Rolling back to previous release: ${previous_target}" >&2
    ln -sfn "${previous_target}" "${current_link}"
    sudo systemctl restart "${service_name}"
  fi
  exit 1
fi

echo "Deployment succeeded for release ${release_id}"
REMOTE_SCRIPT
