#!/bin/sh
# ============================================================
#  EXAM PROVISION LOADER
#  Decrypts and executes a named provision script in-memory.
#
#  Usage (called by Vagrantfile):
#    sh /vagrant/provision/loader.sh <script_name>
#    e.g.: sh /vagrant/provision/loader.sh attacker
#
#  Requires:
#    - /vagrant/provision/.exam_key  (distributed separately)
#    - /vagrant/provision/<name>.sh.enc
# ============================================================

SCRIPT_NAME="$1"
KEY_FILE="/vagrant/provision/.exam_key"
ENC_FILE="/vagrant/provision/${SCRIPT_NAME}.sh.enc"

if [ -z "$SCRIPT_NAME" ]; then
    echo "[ERROR] loader.sh: no script name provided." >&2
    exit 1
fi

if [ ! -f "$KEY_FILE" ]; then
    echo "" >&2
    echo "============================================================" >&2
    echo "  EXAM SETUP ERROR" >&2
    echo "  Missing: provision/.exam_key" >&2
    echo "" >&2
    echo "  You need the exam key file to provision this environment." >&2
    echo "  Obtain it from your instructor and place it at:" >&2
    echo "    exams/final/provision/.exam_key" >&2
    echo "============================================================" >&2
    echo "" >&2
    exit 1
fi

if [ ! -f "$ENC_FILE" ]; then
    echo "[ERROR] loader.sh: encrypted script not found: ${ENC_FILE}" >&2
    exit 1
fi

# Ensure openssl is available (Alpine may need it installed)
if ! command -v openssl > /dev/null 2>&1; then
    apk add -q openssl
fi

KEY=$(cat "$KEY_FILE")

# Decrypt and pipe directly to sh — never touches disk as plaintext
openssl enc -aes-256-cbc -d -pbkdf2 -iter 100000 \
    -in  "$ENC_FILE" \
    -k   "$KEY" | sh -s

EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
    echo "[ERROR] loader.sh: provisioning failed for '${SCRIPT_NAME}' (exit ${EXIT_CODE})" >&2
    echo "        Verify your .exam_key file is correct and try: vagrant provision" >&2
    exit $EXIT_CODE
fi
