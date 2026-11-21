@echo off
rem Mode Shrine MCP Server launcher (Windows CMD)
rem Browser-safe: stdio server exposed over streamable HTTP via supergateway, with CORS on.
rem Serves http://localhost:8000/mcp. Only this machine can reach it, unless a key file exists at
rem ..\secrets\mode-shrine.key (one key per line; secrets\ is git-ignored): then other devices can
rem reach it too, and every request must carry one of those keys as a bearer token.

set "KEYFILE=%~dp0..\secrets\mode-shrine.key"
if exist "%KEYFILE%" (
  npx -y supergateway --stdio "node %~dp0mode-shrine-server.cjs" --port 8000 --outputTransport streamableHttp --cors "*" --apiKeyFile "%KEYFILE%"
) else (
  npx -y supergateway --stdio "node %~dp0mode-shrine-server.cjs" --port 8000 --outputTransport streamableHttp --cors "*" --host 127.0.0.1
)
