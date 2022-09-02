const { generate, inputFile, runFile, getGeneratorInput, writeGeneratedFiles, prettifyGeneratedFiles } = require("../../index.js")

const platform = __dirname.split("/").pop()

describe(`Testing ${platform}`, () => {
  beforeAll(async () => {
    const generatorInput = await getGeneratorInput(platform)

    generatorInput.getRunFile = (args) => {
      return runFile(args) + `\nmodule.exports = { run }`
    }
    
    generatorInput.getInputFile = (args) => {
      return inputFile(args) + `\nmodule.exports = { nodeInput }`
    }
    
    const generated = await generate(generatorInput)

    await writeGeneratedFiles({ ...generatorInput, platform, generated })

    await prettifyGeneratedFiles({ platform })
  })

  it("do nothing", () => {})
})

