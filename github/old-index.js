const fs = require("fs")
const axios = require("axios")
const get = require("lodash/get")

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
  // const results = await axios({
  //   url: "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/ghes-3.3/ghes-3.3.json"
  // })

  // console.log(results)

  // const openAPISchema = results.data

  const openAPISchema = JSON.parse(fs.readFileSync("../play/openapi-github.json"))

  // console.log(openAPISchema)

  

  Object.keys(openAPISchema.paths).forEach(path => {
    console.log(path)
    Object.keys(openAPISchema.paths[path]).forEach(method => {
      console.log(">", method)

      let inputParams = []
      let inputRunParams = []
      let axiosParams = []
      let data = []
      let accept = []
      let contentType = ""

      
      
      const methodParameters = openAPISchema.paths[path][method].parameters || []
      
      methodParameters.forEach(parameter => {

        if(parameter["$ref"]) {
          parameter = get(openAPISchema, parameter["$ref"].replace("#/", "").replace(/\//g, "."))
        }

        inputParams.push(parameter)

        switch(parameter.in) {
          // case "header":
          //   console.log("is header", parameter)
          //   headers[parameter.name] = ""
          //   break;
          case "query":
            inputRunParams.push(parameter.name)
            if(parameter.required) {
              axiosParams.push(parameter.name)
            } else {
              axiosParams.push(`...(${parameter.name} ? { ${parameter.name} } : {})`)
            }
            
            break;
          case "path":
            inputRunParams.push(parameter.name)
            break;
        }
        
      })

      const requestBody = openAPISchema.paths[path][method].requestBody

      // console.log("requestBody", requestBody)

      if(get(requestBody, "content.application/json.schema.type") === "object") {

        data = Object.keys(requestBody.content["application/json"].schema.properties || [])

      } else if (get(requestBody, "content.application/x-www-form-urlencoded.schema.type") === "object") {

        data = Object.keys(requestBody.content["application/x-www-form-urlencoded"].schema.properties || [])
        contentType = Object.keys(get(requestBody, "content", []))[0]

      } else if (Object.keys(get(requestBody, "content", [])).reduce((acc, curr) => acc || curr.includes("text/"), false)) {

        data = ""
        contentType = Object.keys(get(requestBody, "content", []))[0]

      }

      let axiosCallData = ""

      if(method !== "get") {
        if(Array.isArray(data)) {
          axiosCallData = `data: {${data.join(", ")}}`
        } else if (typeof data === "string") {
          axiosCallData = `data`
          inputRunParams.push("data")
          data = []
        }
      }

      Object.keys(openAPISchema.paths[path][method].responses).forEach(response => {
        const content = openAPISchema.paths[path][method].responses[response].content
        if(response.charAt(0) === "2" && content) {
          Object.keys(content).forEach(type => {
            if(type === "application/json") {
              accept.push("application/vnd.github.v3+json")
            } else {
              accept.push(type)
            }
          })
        }
      })


      let title = openAPISchema.paths[path][method].summary.split(" ").map(i => i.charAt(0).toUpperCase() + i.slice(1)).join(" ")

      let description = openAPISchema.paths[path][method].summary + " using the GitHub API"

      let docs = openAPISchema.paths[path][method].externalDocs.url

      let input = `GITHUB_API_USERNAME, GITHUB_API_TOKEN, ${inputRunParams.concat(data).join(", ")}`

      contentType = contentType ? `"content-type": "${contentType}",` : ""

      accept = accept.length > 0 ? `"accept": "${accept.join(", ")}",` : ""

      let axiosCall = `
        method: "${method}",
        url: \`https://api.github.com${path.replace(/{/g, "${")}\`,
        auth: {
          username: GITHUB_API_USERNAME,
          password: GITHUB_API_TOKEN,
        },
        headers: {${accept} ${contentType}},
        params: {${axiosParams.join(", ")}},
        ${axiosCallData}
      `

      
      // console.log(axiosCall)

      // console.log(input)

      let _runFile = runFile({ title, description, docs, input, axiosCall })

      function camelize(str) {
        return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function(word, index) {
          return index === 0 ? word.toLowerCase() : word.toUpperCase();
        }).replace(/\s+/g, '');
      }

      let _configFile = configFile({ title, description, name: camelize(openAPISchema.paths[path][method].summary.replace("-", " ")) + "Result" })

      let inputFileInput = 
      `
      GITHUB_API_TOKEN: $trigger.env.GITHUB_API_TOKEN, // Required for private repos
      GITHUB_API_USERNAME: $trigger.env.GITHUB_API_USERNAME, // Required for private repos
      ${inputParams.filter(p => p.required).map(p => {
        return `${p.name}: "", // Required`
      }).join("\n")}
      ${inputParams.filter(p => !p.required).map(p => {
        return `// ${p.name}: "",`
      }).join("\n")}
      `

      let _inputFile = inputFile({ title, docs, input: inputFileInput })

      let dir = `generated/${docs.split("#")[1]}`

      fs.mkdirSync(dir, { recursive: true })

      fs.writeFileSync(`${dir}/run.js`, _runFile)
      fs.writeFileSync(`${dir}/config.json`, JSON.stringify(_configFile))
      fs.writeFileSync(`${dir}/input.js`, _inputFile)

    })
  })
}

run().catch(console.error)
