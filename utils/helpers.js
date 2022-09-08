
require("dotenv").config()
const get = require("lodash/get")
const { generate, inputFile, runFile, getGeneratorInput, writeGeneratedFiles, getDirName, prettifyFiles } = require("../index.js");

const getGeneratorInputWithModuleExportInRunAndInput = generatorInput => {
  return {
    ...generatorInput,
    getRunFile: (args) => {
      return (generatorInput.getRunFile ? generatorInput.getRunFile(args) : runFile(args)) + `\nmodule.exports = { run }`;
    },
    getInputFile: (args) => {
      return (generatorInput.getInputFile ? generatorInput.getInputFile(args) : inputFile(args)) + `\nmodule.exports = { nodeInput }`;
    },
  }
}

const writeAndPrettyGenerated = async (generatorInput) => {
  const generated = await generate(generatorInput);

  const platform = get(generatorInput, "config.platform")

  await writeGeneratedFiles({ ...generatorInput, platform, generated });

  await prettifyFiles({ platform });
}

const initActionProvider = async (generatorInput = {}) => {
  const provider = {
    call: async ({ path, method, input, $body, $headers, $actions }) => {
      const platform = get(generatorInput, "config.platform")
      const dirNameInput = { openapi: generatorInput.openapi, path, method }
      const actionName = generatorInput.getDirName ? generatorInput.getDirName(dirNameInput) : getDirName(dirNameInput)

      const { nodeInput } = require(`../generated/${platform}/${actionName}/input.js`);
      const { run } = require(`../generated/${platform}/${actionName}/run.js`);

      const _input = nodeInput({ $body, $headers, $actions, $env: process.env });
      const result = run({ ..._input, ...input })

      return result
    }
  };

  return { provider };
};

const setupTests = async (platform) => {
  let generatorInput = await getGeneratorInput(platform);

  generatorInput = getGeneratorInputWithModuleExportInRunAndInput(generatorInput)

  await writeAndPrettyGenerated(generatorInput)

  const { provider } = await initActionProvider(generatorInput)

  return { provider }
}

module.exports = {
  initActionProvider,
  getGeneratorInputWithModuleExportInRunAndInput,
  writeAndPrettyGenerated,
  setupTests
}