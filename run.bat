@echo off
rem Generic launcher (Windows CMD). Set env vars in env.bat or before running.
if exist "%~dp0env.bat" call "%~dp0env.bat"
npx -y supergateway --stdio "node %~dp0pandora-mcp-server.cjs" --port 8002 --cors "*" --ssePath /mcp --messagePath /messages --outputTransport streamableHttp
