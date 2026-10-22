import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && context.parentURL) {
    const parentPath = fileURLToPath(context.parentURL);
    const parentDir = path.dirname(parentPath);
    const targetPath = path.resolve(parentDir, specifier);

    if (!path.extname(specifier)) {
      if (fs.existsSync(targetPath + '.ts')) {
        return {
          url: pathToFileURL(targetPath + '.ts').href,
          shortCircuit: true,
        };
      }
      if (fs.existsSync(targetPath + '.json')) {
        return {
          url: pathToFileURL(targetPath + '.json').href,
          shortCircuit: true,
        };
      }
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file://')) {
    const filePath = fileURLToPath(url);

    if (filePath.endsWith('.ts')) {
      const source = fs.readFileSync(filePath, 'utf8');
      const stripped = stripTypeScriptTypes(source);
      return {
        format: 'module',
        shortCircuit: true,
        source: stripped,
      };
    }

    if (filePath.endsWith('.json')) {
      const content = fs.readFileSync(filePath, 'utf8');
      return {
        format: 'module',
        shortCircuit: true,
        source: `export default ${content};`,
      };
    }
  }

  return nextLoad(url, context);
}
