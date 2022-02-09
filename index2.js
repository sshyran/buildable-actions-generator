const fs = require("fs")
const { getBaseUrl, getFullPath, getHeadersArray, _getParameters, _getBodyParameters } = require("./parse-openapi")
const openApi = JSON.parse(fs.readFileSync("../play/openapi-github.json"))

let configFile = ({ name, title, description }) => ({
  "name": name,
  "title": title,
  "description": description,
  "type": "js-request-function",
  "envVars": {
    "GITHUB_API_TOKEN": {
      "development": "",
      "production": ""
    },
    "GITHUB_API_USERNAME": {
      "development": "",
      "production": ""
    }
  },
  "fee": 0,
  "image": "https://assets.buildable.dev/catalog/node-templates/github.svg",
  "category": "git",
  "accessType": "open",
  "language": "javascript",
  "price": "free",
  "platform": "github",
  "tags": [
    "git",
    "github"
  ],
  "stateType": "stateless",
  "__version": "1.0.0"
})

let inputFile = ({ title, docs, input }) => `
/**
 * ----------------------------------------------------------------------------------------------------
 * ${title} [Input]
 *
 * @author    Buildable Technologies Inc.
 * @access    open
 * @license   MIT
 * @docs      ${docs}
 * ----------------------------------------------------------------------------------------------------
 */

/**
 * Lets you select the input for your Node's run function
 *
 * @param {Params} params
 * @param {Object} $trigger - This Flow's request object
 * @param {Object} $nodes - Data from above Nodes
 */
const nodeInput = ({ $trigger, $nodes }) => {
  return {
    ${input}
  };
};
`

let runFile = ({ title, description, docs, input, axiosCall }) => `
/**
 * ----------------------------------------------------------------------------------------------------
 * ${title} [Run]
 *
 * @description - ${description}
 *
 * @author    Buildable Technologies Inc.
 * @access    open
 * @license   MIT
 * @docs      ${docs}
 *
 * ----------------------------------------------------------------------------------------------------
 */

const axios = require("axios");

/**
 * The Node’s executable function
 *
 * @param {Run} input - Data passed to your Node from the input function
 */
const run = async (input) => {
  const { ${input} } = input;

  verifyInput(input);

  try {
    const result = await axios({
      ${axiosCall}
    });

    return result.data;
  } catch (error) {
    return {
      failed: true,
      message: error.message,
      data: error.response.data,
    };
  }
};
`

const run = async () => {
  for (let path in openApi.paths) {
    for (let method in openApi.paths[path]) {

      const url = getBaseUrl(openApi, path, method) + getFullPath(openApi, path, method);

      const headers = getHeadersArray(openApi, path, method)
      //GitHub specific
      headers.push({
        name: 'accept',
        description: 'This API is under preview and subject to change.',
        in: 'header',
        schema: {
          type: 'string',
          default: 'application/vnd.github.v3+json'
        },
        required: true,
      })

      //GitHub specific
      const auth = [
        {
          name: "GITHUB_API_USERNAME",
          in: "auth",
          field: "username",
          required: true, // not actually, but doesn't break if provide null values,
          schema: {
            type: "string"
          },
          sample: "$trigger.env.GITHUB_API_USERNAME",
          ignoreSurroundingSampleQuotes: true
        },
        {
          name: "GITHUB_API_TOKEN",
          field: "password",
          in: "auth",
          required: true, // not actually, but doesn't break if provide null values,
          schema: {
            type: "string"
          },
          sample: "$trigger.env.GITHUB_API_TOKEN",
          ignoreSurroundingSampleQuotes: true
        }

      ]

      const params = _getParameters(openApi, path, method, {})

      const body = _getBodyParameters(openApi, path, method)


      
      let title = openApi.paths[path][method].summary.split(" ").map(i => i.charAt(0).toUpperCase() + i.slice(1)).join(" ")

      let description = openApi.paths[path][method].summary + " using the GitHub API"

      let docs = openApi.paths[path][method].externalDocs.url

      let input = auth.concat(params).concat(body).map(i => i.name)

      let axiosData = body.length > 0 ? `data: {${body.map(i => i.required ? `${i.name}` : `...(${i.name} ? { ${i.name} } : {})`)}}` : ""

      let axiosCall = `
        method: "${method}",
        url: \`${url.replace(/{/g, "${")}\`,
        auth: {${auth.map(i => `${i.field}: ${i.name}`).join(", ")}},
        headers: {${headers.map(i => `${i.name}: "${i.schema.default}"`).join(", ")}},
        params: {${params.map(i => i.required ? `${i.name}` : `...(${i.name} ? { ${i.name} } : {})`)}},
        ${axiosData}
      `

      let _runFile = runFile({ title, description, docs, input, axiosCall })

      function camelize(str) {
        return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function(word, index) {
          return index === 0 ? word.toLowerCase() : word.toUpperCase();
        }).replace(/\s+/g, '');
      }

      let _configFile = configFile({ title, description, name: camelize(openApi.paths[path][method].summary.replace("-", " ")) + "Result" })

      let inputFileInput =
      `
      ${auth.concat(params).concat(body).filter(p => p.required).map(p => {
        if(p.sample && p.schema.type === "string" && !p.ignoreSurroundingSampleQuotes) {
          return `${p.name}: "${p.sample.replace('"', "")}", // Required`
        }
        return `${p.name}: ${p.sample}, // Required`
      }).join("\n")}
      ${auth.concat(params).concat(body).filter(p => !p.required).map(p => {
        if(p.sample && p.schema.type === "string" && !p.ignoreSurroundingSampleQuotes) {
          return `// ${p.name}: "${p.sample.replace(/"/g, "")}",`
        }
        return `// ${p.name}: ${p.sample},`
      }).join("\n")}
      `

      let _inputFile = inputFile({ title, docs, input: inputFileInput })

      let dir = `generated/${docs.split("#")[1]}`

      fs.mkdirSync(dir, { recursive: true })

      fs.writeFileSync(`${dir}/run.js`, _runFile)
      fs.writeFileSync(`${dir}/config.json`, JSON.stringify(_configFile))
      fs.writeFileSync(`${dir}/input.js`, _inputFile)
      
    }
  }

}

run()