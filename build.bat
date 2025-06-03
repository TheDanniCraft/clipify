@echo off
setlocal enabledelayedexpansion

set args=

for /f "usebackq tokens=1* delims==" %%A in (".secrets") do (
    set "key=%%A"
    set "value=%%B"
    rem Prozentzeichen verdoppeln
    set "value=!value:%%=%%%%!"
    rem Argument zusammenbauen
    set args=!args! --build-arg !key!="!value!"
)

docker build %args% -t test .
