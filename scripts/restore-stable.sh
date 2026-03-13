#!/bin/bash

echo "Lumina Restore System"
echo "Restoring main branch to stable..."

git fetch origin
git checkout main
git reset --hard origin/stable
git push --force

echo "Restore complete."
echo "Main branch now matches stable."
