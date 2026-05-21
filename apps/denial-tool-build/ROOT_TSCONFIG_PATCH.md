# PR-1 — required edit to the monorepo root tsconfig.json

Append one entry to the `references` array in `/tensaw-ui/tsconfig.json`,
after the existing `{ "path": "./apps/operations-console" }` line.

```diff
   "references": [
     { "path": "./packages/runtime" },
     { "path": "./packages/design-system" },
     { "path": "./packages/codes" },
     { "path": "./packages/visualization" },
     { "path": "./packages/composition" },
     { "path": "./packages/actions" },
     { "path": "./packages/wired-components" },
     { "path": "./packages/worklist" },
     { "path": "./packages/mock-server" },
     { "path": "./packages/archetypes" },
     { "path": "./packages/platform-rules" },
     { "path": "./apps/patient" },
-    { "path": "./apps/operations-console" }
+    { "path": "./apps/operations-console" },
+    { "path": "./apps/denial-tool" }
   ]
```

`pnpm-workspace.yaml` already covers `apps/*` (verified during PR-1
planning); no edit needed there.

After applying this and dropping `apps/denial-tool/` in place, the
following commands should pass from a fresh clone:

```bash
pnpm install
pnpm --filter @tensaw/app-denial-tool typecheck
pnpm --filter @tensaw/app-denial-tool lint
pnpm --filter @tensaw/app-denial-tool test
pnpm --filter @tensaw/app-denial-tool build
```
