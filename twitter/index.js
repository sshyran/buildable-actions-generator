const fs = require("fs");
const { snakeCase } = require("snake-case");
const kebabCase = require("lodash/kebabCase")
const get = require("lodash/get")
const axios = require("axios")
const {
  getBaseUrl,
  getFullPath,
  getHeadersArray,
  _getParameters,
  _getBodyParameters,
} = require("./parse-openapi");
// const openApi = JSON.parse(fs.readFileSync("../play/openapi-github.json"));

function camelize(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, "");
}

let configFile = ({ name, title, description }) => ({
  name: name,
  title: title,
  description: description,
  type: "js-request-function",
  envVars: {
    TWITTER_BEARER_TOKEN: {
      development: "",
      production: "",
    },
  },
  fee: 0,
  image: "https://assets.buildable.dev/catalog/node-templates/twitter.svg",
  category: "social",
  accessType: "open",
  language: "javascript",
  price: "free",
  platform: "twitter",
  tags: ["twitter", "social"],
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
const qs = require("qs");

/**
 * The Node’s executable function
 *
 * @param {Run} input - Data passed to your Node from the input function
 */
const run = async (input) => {
  const { ${input} } = input;

  verifyInput(input);

  try {
    const { data } = await axios({
      ${axiosCall}
    });

    return data;
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
  const openApi = (await axios({
    url: "https://api.twitter.com/2/openapi.json"
  })).data

  for (let path in openApi.paths) {
    console.log(path)
    for (let method in openApi.paths[path]) {
      console.log(">", method)
      if(openApi.paths[path][method].deprecated || Object.keys(get(openApi.paths[path][method], "requestBody.content", [])).find(i => i === "application/x-www-form-urlencoded" || i === "multipart/form-data") || !get(openApi.paths[path][method], "security", []).find((i) => Object.keys(i).find(j => j === "BearerToken"))) {
        //skip deprecated methods
        continue
      }

      const url =
        getBaseUrl(openApi, path, method) + getFullPath(openApi, path, method);

      // const headers = getHeadersArray(openApi, path, method);

      // console.log(headers)

      const headers = [
        {
          name: "authorization",
          schema: {
            default: "\`Bearer ${TWITTER_BEARER_TOKEN}\`"
          }
        }
      ]

      const params = [{
        name: "TWITTER_BEARER_TOKEN",
        required: true,
        in: "headers",
        schema: {
          type: "string"
        },
        sample: "$trigger.env.TWITTER_BEARER_TOKEN",
        isEnvironmentVariable: true,
      }].concat(_getParameters(openApi, path, method, {}).filter(p => !p.deprecated).map(i => {
        i.camelizedName = camelize(i.name).replace(".", "")

        return i
      }));

      const body = _getBodyParameters(openApi, path, method).filter(p => !p.deprecated).map(i => {
        i.camelizedName = camelize(i.name).replace(".", "")

        return i
      });

      const auth = []

      let title = openApi.paths[path][method].summary
        .split(" ")
        .map((i) => i.charAt(0).toUpperCase() + i.slice(1))
        .join(" ");

      let description =
        title + " using the Twitter v2 API";

      let docs = "https://developer.twitter.com/en/docs/api-reference-index#twitter-api-v2"

      let input = auth
        .concat(params)
        .concat(body)
        .map((i) => i.camelizedName || i.name);

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
        auth: {${auth.map((i) => `${i.field}: ${i.name}`).join(", ")}},
        headers: {${headers
          .map((i) => `${i.name}: ${i.schema.default}`)
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
        paramsSerializer: params => {
          return qs.stringify(params, { arrayFormat: "comma" })
        },
        ${axiosData}
      `;
      

      let verifyInput = params
        .concat(body)
        .filter((i) => i.required && !i.isEnvironmentVariable)
        .map((i) => i.name);
      let verifyErrors = params
        .concat(body)
        .filter((i) => i.required && !i.isEnvironmentVariable)
        .map(
          (i) =>
            `INVALID_${snakeCase(i.name).toUpperCase()}: "A valid ${
              i.name
            } field (${typeof i.sample}) was not provided in the input.",`
        )
        .join("\n");
      let verifyChecks = params
        .concat(body)
        .filter((i) => i.required && !i.isEnvironmentVariable)
        .map(
          (i) =>
            `if (typeof ${
              i.name
            } !== "${typeof i.sample}") throw new Error(ERRORS.INVALID_${snakeCase(
              i.name
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
        .concat(params)
        .concat(body)
        .filter((p) => p.required)
        .map((p) => {
          if (p.sample && typeof p.sample === "string") {
            if (p.isEnvironmentVariable) {
              return `${p.name}: ${
                p.sample && typeof p.sample === "object"
                  ? handleJSONSampleQuotes(JSON.stringify(p.sample))
                  : p.sample
              }, // Required`;
            }

            return `${p.camelizedName}: "${p.sample.replace(/"/g, "")}", // Required`;
          }

          return `${p.camelizedName}: ${
            p.sample && typeof p.sample === "object"
              ? handleJSONSampleQuotes(JSON.stringify(p.sample))
              : p.sample
          }, // Required`;
        })
        .join("\n")}
      
      ${auth
        .concat(params)
        .concat(body)
        .filter((p) => !p.required)
        .map((p) => {
          if (p.sample && typeof p.sample === "string") {
            if (p.isEnvironmentVariable) {
              return `${p.name}: ${
                p.sample && typeof p.sample === "object"
                  ? handleJSONSampleQuotes(JSON.stringify(p.sample))
                  : p.sample
              }, // Required`;
            }

            return `// ${p.camelizedName}: "${p.sample.replace(/"/g, "")}",`;
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

      console.log(docs)

      let dir = `generated/${kebabCase(openApi.paths[path][method].operationId)}`;

      fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(`${dir}/run.js`, _runFile);
      fs.writeFileSync(`${dir}/config.json`, JSON.stringify(_configFile));
      fs.writeFileSync(`${dir}/input.js`, _inputFile);
    }
  }
};

run();
