#!/usr/bin/env bash
# Validate the proposal-generator plugin structure.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
err(){ echo "FAIL: $1"; fail=1; }
ok(){ echo "ok: $1"; }

for f in .claude-plugin/plugin.json .claude-plugin/marketplace.json README.md LICENSE; do
  [ -f "$root/$f" ] && ok "$f" || err "missing $f"
done

python3 -c "import json; d=json.load(open('$root/.claude-plugin/plugin.json')); assert d.get('name'); assert d.get('skills')" \
  && ok "plugin.json valid" || err "plugin.json invalid (need name + skills)"
python3 -c "import json; json.load(open('$root/.claude-plugin/marketplace.json'))" \
  && ok "marketplace.json valid" || err "marketplace.json invalid JSON"

found=0
while IFS= read -r skill; do
  found=1
  head -20 "$skill" | grep -q '^name:' || err "$skill missing 'name:' frontmatter"
  head -40 "$skill" | grep -q 'description:' || err "$skill missing 'description:' frontmatter"
  ok "skill $(basename "$(dirname "$skill")")"
done < <(find "$root/skills" -name SKILL.md)
[ "$found" -eq 1 ] || err "no skills/*/SKILL.md found"

for r in call-deck-framework send-proposal-structure critique-checklist; do
  find "$root/skills" -path "*reference/$r.md" | grep -q . && ok "reference/$r.md" || err "missing reference/$r.md"
done

[ "$fail" -eq 0 ] && echo "ALL CHECKS PASSED" || { echo "VALIDATION FAILED"; exit 1; }
