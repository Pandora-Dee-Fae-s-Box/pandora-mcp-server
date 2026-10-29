@echo off
rem Pandora MCP Server launcher (Windows CMD)

if not defined GITHUB_APP_ID set "GITHUB_APP_ID=5525018"
if not defined GITHUB_INSTALLATION_ID set "GITHUB_INSTALLATION_ID=176513629"
if not defined GITHUB_PRIVATE_KEY_PATH set "GITHUB_PRIVATE_KEY_PATH=F:/PDA-SEASIDE/Fae-library/pandora-mcp/secrets/github_app_private_key.pem"

if not defined GITHUB_TOKEN if not defined GITHUB_APP_ID if exist "%USERPROFILE%\.pandora-secrets\github_token" (
  set /p GITHUB_TOKEN=<"%USERPROFILE%\.pandora-secrets\github_token"
)

npx -y supergateway --stdio "node %~dp0pandora-mcp-server.cjs" --port 8002 --cors "*" --ssePath /mcp --messagePath /messages --outputTransport streamableHttp
