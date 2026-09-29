---
description: Run the repo validation suite, then commit if everything passes
---

Run this repo's validation suite and, only if all of it passes, commit the work.

## Validation results (captured live)

!`echo "### validate_repo"; python3 scripts/validate_repo.py 2>&1; echo "exit=$?"; echo; echo "### validate_date_table"; python3 scripts/validate_date_table.py 2>&1; echo "exit=$?"; echo; echo "### validate_pbir"; bash scripts/validate_pbir.sh 2>&1; echo "exit=$?"`

## Repository state (captured live)

!`echo "branch: $(git branch --show-current)"; echo "--- status ---"; git status --short; echo "--- diffstat vs HEAD ---"; git diff HEAD --stat`

Requested commit message: $ARGUMENTS

## Procedure

1. **Gate on validation — this is the whole point of the command.** Inspect the validation output above. If any script printed a non-zero `exit=` or any `[FAIL]` line, **stop**. Do not stage, do not commit. Report each failure with the specific check and file it names, and suggest the fix. Only continue if all three scripts exited 0. Do not "fix" a failure by editing the validator or weakening an assertion.

2. **Branch guard.** If the branch is `main`, **stop** and tell the user to move off it first (for example `git switch -c feat/<short-description>`). The repo guardrail in `CLAUDE.md` is to never work directly on `main`. Do not create or switch branches on your own.

3. **Secret guard.** Confirm nothing matching `.env`, `*.pem`, `*.pfx`, `secrets/`, or `*.pbix` is tracked or staged. `validate_repo.py` checks for a committed `.env`; if you see one, unstage it, stop, and tell the user. Never write credentials into a file, a commit message, or a diff summary.

4. **Stage deliberately.** `git add -A` the working tree, then run `git status --short` and show the user exactly what is staged. If anything staged looks like a local artifact, scratch file, or generated output that does not belong in the repo, unstage it with `git restore --staged <path>` and say so rather than committing it.

5. **Write the commit message.** Use the requested message from `$ARGUMENTS` if one was given. Otherwise derive it from the actual diff: a short imperative summary line, a blank line, then a body explaining the modeling or report change and why. If the change touches the semantic model, name the tables, measures, or relationships affected. Do not write a message that overstates the diff.

6. **Commit and report.** Run the commit, then report the short hash, the branch, and the files included. Do not push.

## Notes

- If `/pbi-sync` has not been run, remind the user that model edits live in the MCP server's memory until `database_operations` → `ExportToTmdlFolder` writes them to the `.tmdl` files. Committing before that export commits nothing.
- The repo ships `hooks/pre-commit` but it is not installed by default and it covers only two of the three validators (it omits `validate_pbir.sh`). Do not rely on it as the gate — this command is.
