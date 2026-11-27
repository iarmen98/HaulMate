# Security policy

## Supported versions

Only the latest release is supported.

## Reporting a vulnerability

Please use [GitHub private vulnerability reporting](https://github.com/iarmen98/HaulMate/security/advisories/new). Do not open a public issue. You can expect a first answer within 7 days.

## Scope

Haulmate runs entirely in your browser and reads one local file, `Game.log`. Relevant reports include anything that could make the app read other files, send log content off the machine, or render untrusted content from a log line as HTML.
