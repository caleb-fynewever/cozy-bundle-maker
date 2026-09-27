import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/"))
    specifier = new URL("../src/" + specifier.slice(2), import.meta.url).href;
  if ((specifier.startsWith("file:") || specifier.startsWith(".")) && context.parentURL) {
    const url = new URL(specifier, context.parentURL);
    if (!/\.[a-z]+$/i.test(url.pathname))
      for (const ext of [".ts", ".tsx", ".js"]) {
        if (existsSync(fileURLToPath(url) + ext))
          return next(pathToFileURL(fileURLToPath(url) + ext).href, context);
      }
  }
  return next(specifier, context);
}
