#!/bin/bash
# EAS Pre-build script
# This script runs before the EAS build starts

echo "🧹 Cleaning project..."

# Remove node_modules to ensure clean install
if [ -d "node_modules" ]; then
  echo "Removing node_modules..."
  rm -rf node_modules
fi

# Remove package-lock.json to avoid conflicts
if [ -f "package-lock.json" ]; then
  echo "Removing package-lock.json..."
  rm -f package-lock.json
fi

# Remove .expo cache
if [ -d ".expo" ]; then
  echo "Removing .expo cache..."
  rm -rf .expo
fi

echo "✅ Pre-build cleanup complete"
