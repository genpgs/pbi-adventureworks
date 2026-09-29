---
description: Export the in-memory Power BI semantic model to TMDL files and review the git diff
---

Export the connected Power BI semantic model to TMDL on disk, then review what changed.

Target folder: `$1` (defaults to `AdventureWorksSales.SemanticModel/definition` if not given).

Follow these steps in order.

1. **Preflight.** Run `git status --short` scoped to the target folder. If the tree already has uncommitted changes, stop and report them before doing anything else. Exporting on top of a dirty tree makes the resulting diff ambiguous.

2. **Ensure a connection exists.** Call `powerbi.connection_operations` with `operation: "ListConnections"` (it takes no required arguments — do not use `GetConnection`, which needs a `connectionName`). Reuse an existing connection whose `folderPath` matches the target folder. If there is none, call `operation: "ConnectFolder"` with `folderPath` set to the absolute path of the target folder. Do not connect to Power BI Desktop or Fabric — this project works from the PBIP on disk.

3. **Persist the model.** Call `powerbi.database_operations` with `operation: "ExportToTmdlFolder"` and `tmdlFolderPath` set to the same absolute path. This is the step that actually writes the `.tmdl` files. Without it, every model edit stays in the server's memory only and is lost when the connection closes.

4. **Show the diff.** Run `git diff --stat` and then `git diff` for the target folder.

5. **Review and report.**
   - Which tables, measures, columns, and relationships changed, grouped by object type.
   - Which changes look unintended or destructive.
   - Whether the bulk of the diff is pure reformat noise — line reordering, whitespace, GUID churn — rather than a real modeling change. Say so plainly if that is the case.
   - Any object that was deleted or renamed.

6. **Stop there.** Do not stage, commit, or revert anything. Leave the working tree for the user to review.
