import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const files = ["0003_app_database", "0004_seed_catalog"];
mkdirSync("docs", { recursive: true });
writeFileSync(
  "docs/install-backend.sql",
  "-- Run once, after existing migrations 0000–0002. The transaction rolls back entirely on error.\nBEGIN;\n" +
    files
      .map((name) => "\n-- " + name + "\n" + readFileSync(`drizzle/migrations/${name}.sql`, "utf8"))
      .join("\n") +
    "\nCOMMIT;\n",
);
console.log("Wrote docs/install-backend.sql");
