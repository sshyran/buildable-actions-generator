const { getGeneratorInput, generate } = require("./index.js");

(async () => {
  const platforms = process.argv.slice(2)

  if(platforms.length === 0) {
    throw new Error("must provide at least one platform in arguments")
  }

  for(const platform of platforms) {
    const generatorInput = await getGeneratorInput(platform)
    await generate(generatorInput)
  }
})()

