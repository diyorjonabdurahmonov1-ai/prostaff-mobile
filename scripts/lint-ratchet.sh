#!/usr/bin/env bash
# Lint may not get worse.
#
# The code already has a number of errors from the React Compiler rules; fixing
# them is a separate job and each fix risks a change in behaviour. What this
# stops is new ones: the count may stay or go down, never up. When it goes
# down, lower scripts/lint-baseline.txt to match.
set -uo pipefail
cd "$(dirname "$0")/.."

baseline=$(tr -d '[:space:]' < scripts/lint-baseline.txt)
npx eslint . -f json > /tmp/eslint.json 2>/dev/null || true
errors=$(node -e "
const r = JSON.parse(require('fs').readFileSync('/tmp/eslint.json', 'utf8'));
console.log(r.reduce((n, f) => n + f.errorCount, 0));
")

echo "lint errors: $errors (baseline $baseline)"
if [ "$errors" -gt "$baseline" ]; then
  echo "More lint errors than the baseline. The new ones:"
  npx eslint . --quiet || true
  exit 1
fi
if [ "$errors" -lt "$baseline" ]; then
  echo "Fewer errors than the baseline: lower scripts/lint-baseline.txt to $errors."
fi
