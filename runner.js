const { getGeneratorInput, generate, writeGeneratedFiles, prettifyFiles } = require("./index.js");

(async () => {
  const platforms = process.argv.slice(2)

  if(platforms.length === 0) {
    console.error("must provide at least one platform in arguments")
    return
  }

  for(const platform of platforms) {
    const generatorInput = await getGeneratorInput(platform)
    const generated = await generate(generatorInput)
    
    await writeGeneratedFiles({ ...generatorInput, platform, generated })
    await prettifyFiles({ platform })
  }
})()

