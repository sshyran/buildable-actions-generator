const fs = require("fs");
const { snakeCase } = require("snake-case");
const kebabCase = require("lodash/kebabCase")
const {titleCase} = require("title-case")
const get = require("lodash/get")
const axios = require("axios")
const {
  getBaseUrl,
  getFullPath,
  getHeadersArray,
  _getParameters,
  _getBodyParameters,
} = require("./parse-openapi");
const openApi = JSON.parse(fs.readFileSync("../../Desktop/tatum-openapi.json"));

function camelize(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, "");
}

function sentenceCase(theString) {
	var newString = theString.toLowerCase().replace(/(^\s*\w|[\.\!\?]\s*\w)/g,function(c){return c.toUpperCase()});
  return newString;
}

let configFile = ({ name, title, description }) => ({
  name: name,
  title: title,
  description: description,
  type: "js-request-function",
  envVars: {
    TATUM_API_KEY: {
      development: "",
      production: "",
    },
  },
  fee: 0,
  image: "https://assets.buildable.dev/catalog/node-templates/tatum.svg",
  category: "blockchain",
  accessType: "open",
  language: "javascript",
  price: "free",
  platform: "tatum",
  tags: ["blockchain", "cryptocurrency"],
  stateType: "stateless",
  __version: "1.0.0",
});

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
`;

let runFile = ({
  title,
  description,
  docs,
  input,
  axiosCall,
  verifyInput,
  verifyErrors,
  verifyChecks,
}) => `
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
    const { ${input.includes("data") ? "data: _data" : "data"} } = await axios({
      ${axiosCall}
    });

    return ${input.includes("data") ? "_data" : "data"};
  } catch (error) {
    return {
      failed: true,
      message: error.message,
      data: error.response.data,
    };
  }
};

/**
 * Verifies the input parameters
 */
const verifyInput = ({ ${verifyInput} }) => {
  const ERRORS = {
    ${verifyErrors}
  };

  ${verifyChecks}
};
`;

const run = async () => {
  // const openApi = (await axios({
  //   url: "https://api.twitter.com/2/openapi.json"
  // })).data

  for (let path in openApi.paths) {
    // console.log(path)
    for (let method in openApi.paths[path]) {
      // console.log(">", method)
      if(openApi.paths[path][method].deprecated || Object.keys(get(openApi.paths[path][method], "requestBody.content", [])).find(i => i === "application/x-www-form-urlencoded" || i === "multipart/form-data")) {
        //skip deprecated methods
        continue
      }

      const url =
        "https://api-eu1.tatum.io" + getFullPath(openApi, path, method); // free tier api keys are in eu

      const headers = getHeadersArray(openApi, path, method)
        .map(header => {
          if(header.value && header.value.includes("REPLACE_KEY_VALUE")) {
            header.isEnvironmentVariable = true
            header.required = true
            header.envVarName = "TATUM_API_KEY"
            header.sample = "$trigger.env.TATUM_API_KEY"
          } else {
            header.sample = header.sample || header.example || (header.schema && (header.schema.default || header.schema.type))
          }

          
          if(header.name.split("-")[0] === "x" || header.name.split("-")[0] === "X") {
            header.camelizedName = camelize(header.name.split("-").slice(1).join("-")).replace(/-/g, "")
          } else {
            header.camelizedName = camelize(header.name).replace(/-/g, "")
          }

          

          return header
        });

      const params = _getParameters(openApi, path, method, {}).filter(p => !p.deprecated && !headers.find(h => h.name === p.name)).map(i => {
        i.camelizedName = camelize(i.name).replace(".", "")

        return i
      });

      const body = _getBodyParameters(openApi, path, method).filter(p => !p.deprecated).map(i => {
        i.camelizedName = camelize(i.name).replace(".", "")

        return i
      });

      console.log("body", body)

      const auth = []

      let title = titleCase(openApi.paths[path][method].summary)     

      let description =
        sentenceCase(openApi.paths[path][method].summary) + " using the Tatum API";

      let docs = `https://tatum.io/apidoc.php#operation/${openApi.paths[path][method].operationId}`


      let input = auth
        .concat(headers)
        .concat(params)
        .concat(body)
        .sort((a, b) => { // sort required first
          if (a.isEnvironmentVariable) {
            return -1;
          }

          if (b.isEnvironmentVariable) {
            return 1;
          }

          if (a.required) {
            return -1;
          }

          if (b.required) {
            return 1;
          }

          return 0;
        })
        .map((i) => i.envVarName || i.camelizedName || i.name)

      let axiosData =
        body.length > 0
          ? `data: {${body
              .sort((a, b) => { // sort required first
                if (a.required) {
                  return -1;
                }
                if (b.required) {
                  return 1;
                }

                return 0;
              })
              .map((i) => {
                if(i.name.includes(".")) {
                  return i.required ? `"${i.name}": ${i.camelizedName}` : `...(${i.camelizedName} ? { "${i.name}": ${i.camelizedName} } : {})`
                }
    
                return i.required ? `${i.name}` : `...(${i.name} ? { ${i.name} } : {})`
              })}}`
          : "";

      let axiosCall = `
        method: "${method}",
        url: \`${url.replace(/{/g, "${")}\`,
        headers: {${headers
          .sort((a, b) => { // sort required first
            if (a.required) {
              return -1;
            }
            if (b.required) {
              return 1;
            }

            return 0;
          })
          .map((i) => {
            if(i.required) {
              return `"${i.name}": \`\${${i.envVarName || i.camelizedName || i.name}}\``
            } else {
              return `...(${i.envVarName || i.camelizedName || i.name} ? { "${i.name}": \`\${${i.envVarName || i.camelizedName || i.name}}\`  } : {})`
            }
          })
          .join(", ")}},
        params: {${params
          .filter((i) => i.in === "query")
          .sort((a, b) => { // sort required first
            if (a.required) {
              return -1;
            }
            if (b.required) {
              return 1;
            }

            return 0;
          })
          .map((i) => {
            if(i.name.includes(".")) {
              return i.required ? `"${i.name}": ${i.camelizedName}` : `...(${i.camelizedName} ? { "${i.name}": ${i.camelizedName} } : {})`
            }

            return i.required ? `${i.name}` : `...(${i.name} ? { ${i.name} } : {})`
          }
          )}},
        ${axiosData}
      `;
      

      let verifyInput = headers
        .concat(params)
        .concat(body)
        .filter((i) => i.required)
        .map((i) => i.envVarName || i.camelizedName || i.name);
      let verifyErrors = headers
        .concat(params)
        .concat(body)
        .filter((i) => i.required)
        .map(
          (i) =>
            `INVALID_${snakeCase(i.envVarName || i.camelizedName || i.name).toUpperCase()}: "A valid ${
              i.envVarName || i.camelizedName || i.name
            } field (${typeof i.sample}) was not provided in the input.",`
        )
        .join("\n");
      let verifyChecks = headers
        .concat(params)
        .concat(body)
        .filter((i) => i.required)
        .filter(p => p.in !== "header" || p.envVarName)
        .map(
          (i) =>
            `if (typeof ${
              i.envVarName || i.camelizedName || i.name
            } !== "${typeof i.sample}") throw new Error(ERRORS.INVALID_${snakeCase(
              i.envVarName || i.camelizedName || i.name
            ).toUpperCase()});`
        )
        .join("\n");

      let _runFile = runFile({
        title,
        description,
        docs,
        input,
        axiosCall,
        verifyInput,
        verifyErrors,
        verifyChecks,
      });

      

      let _configFile = configFile({
        title,
        description,
        name:
          camelize(openApi.paths[path][method].summary).replace(/\W/g, '') +
          "Result",
      });

      const handleJSONSampleQuotes = (json) => {
        return json.replace(/\uFFFF/g, '\\"');
      };

      let inputFileInput = `
      ${auth
        .concat(headers)
        .concat(params)
        .concat(body)
        .filter((p) => p.required)
        .map((p) => {
          if (p.sample && typeof p.sample === "string") {
            if (p.isEnvironmentVariable) {
              return `${p.envVarName || p.camelizedName || p.name}: ${
                p.sample && typeof p.sample === "object"
                  ? handleJSONSampleQuotes(JSON.stringify(p.sample))
                  : p.sample
              }, // Required`;
            }

            return `${p.camelizedName}: \`${p.sample.replace(/"/g, "")}\`, // Required`;
          }

          return `${p.camelizedName}: ${
            p.sample && typeof p.sample === "object"
              ? handleJSONSampleQuotes(JSON.stringify(p.sample))
              : p.sample
          }, // Required`;
        })
        .join("\n")}
      
      ${auth
        .concat(headers)
        .concat(params)
        .concat(body)
        .filter((p) => !p.required)
        .map((p) => {
          if (p.sample && typeof p.sample === "string") {
            if (p.isEnvironmentVariable) {
              return `${p.envVarName || p.camelizedName || p.name}: ${
                p.sample && typeof p.sample === "object"
                  ? handleJSONSampleQuotes(JSON.stringify(p.sample))
                  : p.sample
              }, // Required`;
            }

            return `// ${p.camelizedName}: \`${p.sample.replace(/"/g, "")}\`,`;
          }

          return `// ${p.camelizedName}: ${
            p.sample && typeof p.sample === "object"
              ? handleJSONSampleQuotes(JSON.stringify(p.sample))
              : p.sample
          },`;
        })
        .join("\n")}
      `;

      let _inputFile = inputFile({ title, docs, input: inputFileInput });

      let dir = `generated/${kebabCase(openApi.paths[path][method].summary)}`;

      fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(`${dir}/run.js`, _runFile);
      fs.writeFileSync(`${dir}/config.json`, JSON.stringify(_configFile));
      fs.writeFileSync(`${dir}/input.js`, _inputFile);
    }
  }
};

run();
