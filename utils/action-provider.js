
require("dotenv").config()

const { generate, inputFile, runFile, getGeneratorInput, writeGeneratedFiles, getDirName, prettifyFiles } = require("../index.js");


const initActionProvider = async ({ platform }) => {
  const generatorInput = await getGeneratorInput(platform);

  generatorInput.getRunFile = (args) => {
    return runFile(args) + `\nmodule.exports = { run }`;
  };

  generatorInput.getInputFile = (args) => {
    return inputFile(args) + `\nmodule.exports = { nodeInput }`;
  };

  const generated = await generate(generatorInput);

  await writeGeneratedFiles({ ...generatorInput, platform, generated });

  await prettifyFiles({ platform });

  const provider = {
    call: async ({ path, method, input, $body, $headers, $actions }) => {
      const dirNameInput = { openapi: generatorInput.openapi, path, method }
      const actionName = generatorInput.getDirName ? generatorInput.getDirName(dirNameInput) : getDirName(dirNameInput)

      const { nodeInput } = require(`../generated/${platform}/${actionName}/input.js`);
      const { run } = require(`../generated/${platform}/${actionName}/run.js`);

      const _input = nodeInput({ $body, $headers, $actions, $env: process.env });
      const result = run({ ..._input, ...input })

      return result
    }
  };

  return { provider, openapi: generatorInput.openapi };
};

module.exports = {
  initActionProvider
}