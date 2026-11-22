#!/bin/bash
input=$(cat 2>/dev/null)

cwd=$(echo "$input" | jq -r '.cwd // empty' 2>/dev/null | tr '\\' '/')

[ -z "$cwd" ] && cwd="$PWD"

project=$(cd "$cwd" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null || echo "$cwd")
title=$(basename "$project")

# Salvar session_id para rastreamento de role por terminal
session_id=$(echo "$input" | jq -r '.session_id // empty' 2>/dev/null)
if [ -n "$session_id" ] && [ -n "$project" ]; then
  bash_project=$(echo "$project" | tr '\\' '/')
  if [[ "$bash_project" =~ ^([A-Za-z]):(/.*)? ]]; then
    drive=$(echo "${BASH_REMATCH[1]}" | tr '[:upper:]' '[:lower:]')
    bash_project="/${drive}${BASH_REMATCH[2]}"
  fi
  mkdir -p "${bash_project}/.claude/sessions" 2>/dev/null
  echo "$session_id" > "${bash_project}/.claude/current-session.tmp"
fi

# Grava o título num arquivo para o hook do PowerShell ler no próximo prompt
echo "$title" > "$HOME/.claude/current-title.tmp"
echo "$title"
