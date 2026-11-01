# Security

Report a vulnerability privately through GitHub: **Security → Report a vulnerability** on
this repository (private vulnerability reporting). Please do not open a public issue for it.

In scope: the `aiv` CLI, the engines and the shared packages, the CI configuration, and
anything that could leak secrets or personal data through committed files. Renders run
local code and local browsers by design; a video's own `src/` is trusted code.

Expect an acknowledgement within a week. This is a one-person project, so fixes land on
`main` without backports.
