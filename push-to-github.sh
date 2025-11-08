#!/bin/bash

# Helper script to push to GitHub using stored GITHUB_TOKEN
# This keeps your token secure and never displays it

echo "🔧 Setting up GitHub remote..."

# Get your GitHub username
read -p "Enter your GitHub username: " GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
  echo "❌ GitHub username is required"
  exit 1
fi

if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ GITHUB_TOKEN not found in environment"
  exit 1
fi

echo "📡 Configuring remote repository..."

# Remove existing origin if it exists
git remote remove origin 2>/dev/null

# Add the remote with authentication
git remote add origin "https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@github.com/shield-xrpfinance/shieldfinance.git"

echo "✅ Remote configured successfully"
echo "🚀 Pushing to GitHub..."

# Push to GitHub
git push -u origin main

if [ $? -eq 0 ]; then
  echo "✅ Successfully pushed to GitHub!"
  echo "🌐 View your repository at: https://github.com/shield-xrpfinance/shieldfinance"
else
  echo "❌ Push failed. Please check the error messages above."
fi
