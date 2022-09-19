
require("dotenv").config()
const get = require("lodash/get")
const { generate, getGeneratorInput, getDirName } = require("../index.js");
const { defaultTemplates } = require("../templates")

const getGeneratorInputWithModuleExportInTemplates = generatorInput => {
  const templates = Array.isArray(generatorInput.templates) && generatorInput.templates.length > 0 ? generatorInput.templates : defaultTemplates
  return {
    ...generatorInput,
    templates: templates.map(t => ({ ...t, getTemplateResult: (args) => t.getTemplateResult(args) + `\nmodule.exports = { ${t.filename === "input.js" ? "nodeInput" : t.filename.split(".").pop().join(".") } }`}))
  }
}

const initActionProvider = async (generatorInput = {}) => {
  const provider = {
    call: async ({ path, method, input, $body, $headers, $actions }) => {
      const platform = get(generatorInput, "config.platform")
      const dirNameInput = { openapi: generatorInput.openapi, path, method }
      const actionName = generatorInput.getDirName ? generatorInput.getDirName(dirNameInput) : getDirName(dirNameInput)

      const files = fs.readdirSync(`../generated/${platform}/${actionName}`)

      const inputFile = files.find(f => f === "input.js")
      const runFile = files.find(f => f === "run.js")

      if(inputFile && runFile) {
        const { nodeInput } = require(`../generated/${platform}/${actionName}/input.js`);
        const { run } = require(`../generated/${platform}/${actionName}/run.js`);

        const _input = nodeInput({ $body, $headers, $actions, $env: process.env });
        const result = run({ ..._input, ...input })

        return result
      } else {
        throw new Error("Unknown way to handle generated files for the action")
      }
    }
  };

  return { provider };
};

const setupTests = async (platform) => {
  let generatorInput = await getGeneratorInput(platform);

  generatorInput = getGeneratorInputWithModuleExportInTemplates(generatorInput)

  await generate(generatorInput)

  const { provider } = await initActionProvider(generatorInput)

  return { provider }
}

module.exports = {
  initActionProvider,
  getGeneratorInputWithModuleExportInTemplates,
  writeAndPrettyGenerated,
  setupTests
}