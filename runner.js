const { getGeneratorInput, generate, writeGeneratedFiles } = require("./index.js");

(async () => {
  //TODO: allow all/multiple platforms
  
  const platform = process.argv[2]

  if(!platform) {
    console.error("missing platform name in argument")
    return
  }

  console.log("platform", platform)
  
  writeGeneratedFiles(generate(getGeneratorInput(platform)))
})()

