const { readFileSync } = require("node:fs");
const { stripTypeScriptTypes } = require("node:module");
const { dirname, resolve } = require("node:path");

// Execute the real module with explicit dependency mocks, without Electron.
module.exports = (filename, imports, globals = {}) => {
  let source = stripTypeScriptTypes(readFileSync(filename, "utf8"));
  const exportedClasses = [];
  source = source
    .replace(
      /^import\s+([\s\S]*?)\s+from\s+"([^"]+)";/gm,
      (_, binding, name) => {
        const value = `require(${JSON.stringify(name)})`;
        if (binding.startsWith("* as "))
          return `const ${binding.slice(5)} = ${value};`;
        if (binding.startsWith("{")) return `const ${binding} = ${value};`;
        return `const ${binding} = ${value}.default;`;
      },
    )
    .replace(/^export class (\w+)/gm, (_, name) => {
      exportedClasses.push(name);
      return `class ${name}`;
    })
    .replace(/^export function /gm, "function ")
    .replace(/^export\s*\{([\s\S]*?)\};/gm, "return {$1};");
  if (exportedClasses.length)
    source += `\nreturn {${exportedClasses.join(",")}};`;
  const requireMock = (name) => {
    if (Object.hasOwn(imports, name)) return imports[name];
    if (name.startsWith("node:")) return require(name);
    throw new Error(`Missing mock for ${name} in ${filename}`);
  };
  return new Function("require", "__dirname", ...Object.keys(globals), source)(
    requireMock,
    dirname(resolve(filename)),
    ...Object.values(globals),
  );
};
