const { getGeneratorInput, generate, writeGeneratedFiles, prettifyGeneratedFiles } = require("./index.js");

(async () => {
  //TODO: allow all/multiple platforms
  
  const platforms = process.argv.slice(2)

  if(platforms.length === 0) {
    console.error("must provide at least one platform in arguments")
    return
  }

  for(const platform of platforms) {
    const generatorInput = await getGeneratorInput(platform)
    const generated = await generate(generatorInput)
    writeGeneratedFiles({ ...generatorInput, platform, generated })
    prettifyGeneratedFiles({ platform })
  }
})()

