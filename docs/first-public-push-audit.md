# First-public-push audit

Run 2026-11-10 by the Web Platform session, before the repo goes public (per ~/Code/CLAUDE.md). Visibility is changed by the owner, not by this audit.

| Check | Result |
| --- | --- |
| Commit authors (all history) | Only the noreply address (11632652+mgilardi@users.noreply.github.com) |
| Secrets in history (Stripe, AWS, GitHub, Slack, Resend keys, private keys, database URLs with passwords) | None found. The test secret `test-secret-not-for-production` and the test password are made up |
| Email addresses in tracked files | Only `admin@example.invalid` and `member@example.invalid` in the tests |
| Server addresses, IPs, private hosts, home paths | None |
| Personal names | None |
| Build output, dependencies, env files committed | None (`dist/`, `node_modules/`, `.env`, `.secrets/` are ignored) |
| Private terms (`scripts/leak-check.sh` locally, with ~/.leak-private-terms) | Passed |
| Leak check in CI | Yes, first step of `.github/workflows/ci.yml` |
| LICENSE | MIT, Copyright (c) 2026 Captive Origins (added in this audit; general Payload plugins are MIT per ~/Code/CLAUDE.md) |
| `package.json` | `private` removed so it can be published; license, repository, homepage, bugs and `files` set; typecheck and tests run before publish |
| Release workflow and RELEASING.md | Added, the same as the other Captive Origins packages, with a 15-minute timeout |
| README status line says what has and hasn't been tested | Yes |
| Details of a real site | None. The Captive Origins preset is the brand's public colors; tests use made-up themes and accounts |

## Notes

- `docs/decisions.md` quotes the owner's request as written in the platform session's chat. It names no person and nothing about how the site is set up or secured.
- `CLAUDE.md` is the standard ops starter file, as in the other plugins. It isn't in the npm package.

Result: clean.
