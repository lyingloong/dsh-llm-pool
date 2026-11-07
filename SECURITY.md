# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | Yes |

## Reporting a vulnerability

Please open a private security advisory on GitHub:
<https://github.com/lyingloong/dsh-llm-pool/security/advisories/new>

Do not open a public issue for a vulnerability. Include the affected version,
a minimal reproduction, and whether provider credentials could be exposed.

## Credential handling

- This plugin **does not store, read, or log provider API keys**. It delegates
  every real request to the provider routes already configured in DSH, which
  own their credential references.
- The Models panel API is protected by the same authenticated browser
  connection gate as the built-in Models page. It is not intended to be exposed
  to unauthenticated callers.
- The panel's “Test” action performs a real, billable provider request.
- Configuration written by the panel contains provider route names and model
  ids, not credentials. Keep panel screenshots and issue reports free of
  tokens and account identifiers.
