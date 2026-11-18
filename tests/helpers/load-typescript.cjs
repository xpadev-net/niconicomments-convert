const { readFileSync } = require("node:fs");
const { createRequire, stripTypeScriptTypes } = require("node:module");
const { dirname, resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

// Execute application code with explicit dependency mocks, without Electron.
function evaluate(source, filename, imports, globals, compiled) {
  const exported = [];
  const absolutePath = resolve(filename);
  const requireFromFile = createRequire(absolutePath);
  source = source
    .replace(
      /^import\s+([\s\S]*?)\s+from\s+"([^"]+)";/gm,
      (_, binding, name) => {
        const value = `loadDependency(${JSON.stringify(name)})`;
        if (binding.startsWith("* as "))
          return `const ${binding.slice(5)} = ${value};`;
        if (binding.startsWith("{")) return `const ${binding} = ${value};`;
        return `const ${binding} = ${value}${compiled ? "" : ".default"};`;
      },
    )
    .replace(/^export (class|const|function) (\w+)/gm, (_, kind, name) => {
      exported.push(name);
      return `${kind} ${name}`;
    })
    .replace(/^export\s*\{([\s\S]*?)\};/gm, (_, names) => {
      exported.push(
        ...names
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean),
      );
      return "";
    })
    .replace(/\bimport\.meta\b/g, "moduleMeta");
  const loadDependency = (name) => {
    if (Object.hasOwn(imports, name)) return imports[name];
    if (name.startsWith(".")) {
      const legacyName = name.replace(/(?:\/index)?\.js$/, "");
      if (Object.hasOwn(imports, legacyName)) return imports[legacyName];
    }
    if (compiled || name.startsWith("node:")) return requireFromFile(name);
    throw new Error(`Missing mock for ${name} in ${filename}`);
  };
  return new Function(
    "loadDependency",
    "moduleMeta",
    "__dirname",
    ...Object.keys(globals),
    `${source}\nreturn {${exported.join(",")}};`,
  )(
    loadDependency,
    { dirname: dirname(absolutePath), url: pathToFileURL(absolutePath).href },
    dirname(absolutePath),
    ...Object.values(globals),
  );
}

module.exports = (filename, imports, globals = {}) =>
  evaluate(
    stripTypeScriptTypes(readFileSync(filename, "utf8")),
    filename,
    imports,
    globals,
    false,
  );

module.exports.loadCompiled = (filename, imports, globals = {}) =>
  evaluate(readFileSync(filename, "utf8"), filename, imports, globals, true);
