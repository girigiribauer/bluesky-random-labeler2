#!/bin/bash
set -e

echo "🔍 [Skill] Running Static Analysis (cargo check)..."
cargo check

echo "🧪 [Skill] Running Test Suite (cargo test)..."
cargo test

echo "✅ [Skill] Verification Complete. All checks passed."
