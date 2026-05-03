import { spawn } from "node:child_process";

const mode = process.argv[2];

if (mode !== "smoke" && mode !== "benchmark") {
  console.error("Usage: node scripts/run-editor-performance-e2e.mjs <smoke|benchmark>");
  process.exit(1);
}

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(
  command,
  ["playwright", "test", "tests/e2e/editor-performance.e2e.test.ts"],
  {
    env: {
      ...process.env,
      MDE_EDITOR_PERFORMANCE_MODE: mode,
    },
    stdio: "inherit",
  },
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
