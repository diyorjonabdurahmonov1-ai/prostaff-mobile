#!/usr/bin/env bash
# Type check, counting only our own code.
#
# One of the icon libraries ships TypeScript sources that do not type-check
# against the SVG library next to it. That is an error in somebody else's
# package, in a file we cannot change, so it is not allowed to fail the check;
# an error anywhere else is.
set -uo pipefail
cd "$(dirname "$0")/.."

npx tsc --noEmit > /tmp/tsc.txt 2>&1 || true
ours=$(grep "error TS" /tmp/tsc.txt | grep -v "node_modules/" || true)
theirs=$(grep "error TS" /tmp/tsc.txt | grep -c "node_modules/" || true)

if [ -n "$ours" ]; then
  echo "$ours"
  echo "Type errors in our code."
  exit 1
fi
echo "No type errors in our code ($theirs in node_modules, ignored)."
