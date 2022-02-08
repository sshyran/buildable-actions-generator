const fs = require("fs")
const axios = require("axios")
const get = require("lodash/get")

let configFile = () => ({
  "name": "pullRequests",
  "title": "List Pull Requests",
  "description": "List pull requests using the GitHub API",
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

let runFile = ({ title, description, docs, input, axiosCall }) => `
/**
 * ----------------------------------------------------------------------------------------------------
 * ${title} [Run]
 *
 * @description - ${description} using the GitHub API
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
      let params = []
      let data = []
      let accept = []
      let contentType = ""

      
      
      const methodParameters = openAPISchema.paths[path][method].parameters || []
      
      methodParameters.forEach(parameter => {

        if(parameter["$ref"]) {
          parameter = get(openAPISchema, parameter["$ref"].replace("#/", "").replace(/\//g, "."))
        }

        switch(parameter.in) {
          // case "header":
          //   console.log("is header", parameter)
          //   headers[parameter.name] = ""
          //   break;
          case "query":
            inputParams.push(parameter.name)
            if(parameter.required) {
              params.push(parameter.name)
            } else {
              params.push(`...(${parameter.name} ? { ${parameter.name} } : {})`)
            }
            
            break;
          case "path":
            inputParams.push(parameter.name)
            break;
        }
        
      })

      const requestBody = openAPISchema.paths[path][method].requestBody

      // console.log("requestBody", requestBody)

      if(get(requestBody, "content.application/json.schema.type") === "object") {
        data = Object.keys(requestBody.content["application/json"].schema.properties || [])
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
          inputParams.push("data")
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

      let description = openAPISchema.paths[path][method].summary

      let docs = openAPISchema.paths[path][method].externalDocs.url

      let input = `GITHUB_API_USERNAME, GITHUB_API_TOKEN, ${inputParams.concat(data).join(", ")}`

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
        params: {${params.join(", ")}},
        ${axiosCallData}
      `

      
      // console.log(axiosCall)

      // console.log(input)

      let _runFile = runFile({ title, description, docs, input, axiosCall })

      let dir = `generated/${docs.split("#")[1]}`

      fs.mkdirSync(dir, { recursive: true })

      fs.writeFileSync(`${dir}/run.js`, _runFile)

    })
  })
}

run().catch(console.error)
