const fs = require("fs");
const { promises: { readdir } } = require('fs');
var Mustache = require('mustache');

const readFile = async (filePath) => {
  try {
    return await fs.promises.readFile(filePath, "utf8");
  } catch(err) {
    console.log(err)
  }
}

const writeFile = async (filePath, content) => {
  try {
    return await fs.promises.writeFile(filePath, content, {
      encoding: "utf8"
    });
  } catch(err) {
    console.log(err)
  }
}

const getDirectories = async source =>
(await readdir(source, { withFileTypes: true }))
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name)


const generateChangelogs = async (name) => {
  const directories = await getDirectories("generated/");
  const actionDirectories = directories.map(dir => `generated/${dir}/`);

  const changelogTemplate = await readFile("templates/changelog.handlebars");
  
  for (let directory of actionDirectories) {
    const templateData = {
      templateName: `${name}/${directory.split("/")[1]}`,
      date: new Date().toLocaleString().split(",")[0]
    };

    const output = Mustache.render(changelogTemplate, templateData);

    const outputPath = directory + "CHANGELOG.md";

    console.log("Creating: " + outputPath);

    await writeFile(outputPath, output);  
  }
}

module.exports = {
  generateChangelogs
};
