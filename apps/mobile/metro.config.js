const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

/* Monorepo: Metro muss die Workspace-Packages (@elearning/*) sehen.
   react/react-dom werden hart auf die App-Kopie gepinnt (19.1.0, passend
   zu React Native 0.81) – der Workspace-Root hält wegen Web-Peers eine
   andere react-Version vor; zwei React-Kopien im Bundle würden mit
   "Invalid hook call" crashen. */

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, "node_modules"),
  path.join(workspaceRoot, "node_modules"),
];

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isReactFamily =
    moduleName === "react" ||
    moduleName === "react-dom" ||
    moduleName.startsWith("react/") ||
    moduleName.startsWith("react-dom/");
  if (isReactFamily) {
    // Auflösung so behandeln, als käme der Import aus der App selbst –
    // findet immer apps/mobile/node_modules/react (19.1.0)
    context = {
      ...context,
      originModulePath: path.join(projectRoot, "package.json"),
    };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(
    context,
    moduleName,
    platform
  );
};

module.exports = config;
