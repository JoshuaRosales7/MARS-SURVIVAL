# Security policy

## Supported code

Security fixes target the current `main` branch. This educational project does not maintain long-term release branches.

## Reporting a vulnerability

Do not open a public issue for vulnerabilities, exposed credentials, unsafe deployment configuration, or private mission data.

Contact the repository owner privately through the GitHub profile associated with the repository. Include:

- the affected component and commit;
- reproduction steps;
- expected impact;
- a minimal proof of concept with secrets removed;
- a suggested mitigation when available.

Please allow reasonable time for investigation before public disclosure.

## Secrets and data

- Never commit `OPENAI_API_KEY` or other service credentials.
- Keep `.env` files local; use `.env.example` for documented variable names only.
- Treat exported mission packages and logs as potentially sensitive when they contain real people or operational details.
- The frontend must never receive server-side API secrets.

## Scope note

RedReturn is educational and experimental. Security fixes do not make it certified operational, medical, or navigation software.
