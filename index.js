const fs = require("fs");
const axios = require("axios")
const { snakeCase } = require("snake-case");
const kebabCase = require("lodash/kebabCase")
const {titleCase} = require("title-case")
const get = require("lodash/get")
const union = require("lodash/union")
const {
  camelize,
  sentenceCase,
  getBaseUrl,
  getFullPath,
  getHeadersArray,
  getHeaders,
  getParameters,
  getBodyParameters,
  _getParameters,
  _getBodyParameters,
  getEnvVarParams,
  getInputName,
  sortAndMapRequired,
  handleJSONSampleQuotes,
  requiredInputTemplate,
  optionalInputTemplate,
  mapWithTemplate
} = require("./utils")



let configFile = ({ name, title, description, ...rest }) => ({
  name: name,
  title: title,
  description: description,
  image: `https://assets.buildable.dev/catalog/node-templates/${rest.platform}.svg`,
  ...rest
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

const run = async ({ baseURL, config, getTitle, getDescription, getDocs, pathOrURL, isURL  } = {}) => {

  let openApi

  if(isURL) {
    openApi = (await axios({
      url: pathOrURL
    })).data
  } else {
    openApi = JSON.parse(fs.readFileSync(pathOrURL));
  }

  for (let path in openApi.paths) {
    // console.log(path)
    for (let method in openApi.paths[path]) {
      // console.log(">", method)
      if(openApi.paths[path][method].deprecated || Object.keys(get(openApi.paths[path][method], "requestBody.content", [])).find(i => i === "application/x-www-form-urlencoded" || i === "multipart/form-data")) {
        continue
      }

      const url = (baseURL || getBaseUrl(openApi, path, method)) + getFullPath(openApi, path, method);

      const auth = getEnvVarParams(config, ["auth"])

      const headers = [];

      const openApiHeaders = getHeaders(openApi, path, method)
      const envVarHeaders = getEnvVarParams(config, ["header"])
      for(let header of openApiHeaders) {
        const envVarHeader = envVarHeaders.find(p => p.headerName === header.name)
        if(header.isAuth && envVarHeader) {
          headers.push({
            ...envVarHeader,
            ...header,
          })
        } else {
          headers.push(header)
        }
      }

      const params = getEnvVarParams(config, ["path", "query"]).concat(getParameters(openApi, path, method));

      const body = getEnvVarParams(config, ["body"]).concat(getBodyParameters(openApi, path, method));

      let axiosHeaders = headers.length > 0 
      ? `headers: {${sortAndMapRequired(headers).join(", ")}},`
      : ""

      const queryParams = params.filter((i) => i.in === "query")
      let axiosParams = queryParams.length > 0
      ? `params: {${sortAndMapRequired(queryParams)}},`
      : ""

      let axiosData =
        body.length > 0
          ? `data: {${sortAndMapRequired(body)}}`
          : "";

      let axiosCall = `
        method: "${method}",
        url: \`${url.replace(/{/g, "${")}\`,
        ${[axiosHeaders, axiosParams, axiosData].filter(i => !!i.trim()).join("\n")}
      `;


      let input = union(auth, headers, params, body)
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
      

      let verifyInput = input
        .filter((i) => i.required)
        .map((i) => getInputName(i));

      let verifyErrors = input
        .filter((i) => i.required)
        .map(
          (i) =>
            `INVALID_${snakeCase(getInputName(i)).toUpperCase()}: "A valid ${
              getInputName(i)
            } field (${typeof i.sample}) was not provided in the input.",`
        )
        .join("\n");

      const verifyChecks = input
        .filter((i) => i.required)
        .map(
          (i) =>
            `if (typeof ${
              getInputName(i)
            } !== "${typeof i.sample}") throw new Error(ERRORS.INVALID_${snakeCase(
              getInputName(i)
            ).toUpperCase()});`
        )
        .join("\n");

    
      

      const title = getTitle ? getTitle(openApi, path, method) : titleCase(openApi.paths[path][method].summary)     

      const description = getDescription ? getDescription(openApi, path, method) : sentenceCase(openApi.paths[path][method].summary) + ` using the ${titleCase(config.platform)} API`;

      const docs = getDocs ? getDocs(openApi, path, method) : get(openApi.paths[path][method], "externalDocs.url") 


      const _runFile = runFile({
        title,
        description,
        docs,
        input: input.map((i) => getInputName(i)),
        axiosCall,
        verifyInput,
        verifyErrors,
        verifyChecks,
      });
      

      const _configFile = configFile({
        title,
        description,
        name:
          camelize(openApi.paths[path][method].summary).replace(/\W/g, '') +
          "Result",
        ...config
      });

      const inputFileInput = `
      ${mapWithTemplate(union(auth, headers, params, body)
        .filter((p) => p.required), requiredInputTemplate)
        .join("\n")}
      
        ${mapWithTemplate(union(auth, headers, params, body)
          .filter((p) => !p.required), optionalInputTemplate)
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

run({
  baseURL: "{TATUM_API_URL}", // can be hardcoded string (i.e https://my-api.com) and/or contain envVar replacement values (i.e https://{SOME_API_URL}/api)
  config: {
    envVars: {
      TATUM_API_URL: {
        development: "https://api-us-west1.tatum.io",
        production: "https://api-us-west1.tatum.io",
        in: "path"
      },
      TATUM_API_KEY: {
        development: "",
        production: "",
        in: "header",
        headerName: "x-api-key"
      },
    },
    type: "js-request-function",
    fee: 0,
    category: "blockchain",
    accessType: "open",
    language: "javascript",
    price: "free",
    platform: "tatum",
    tags: ["blockchain", "cryptocurrency", "web3"],
    stateType: "stateless",
    __version: "1.0.0",
  },
  pathOrURL: "../../Desktop/tatum-openapi.json",
  isURL: false,
  getDocs: (openApi, path, method) => {
    return `https://tatum.io/apidoc.php#operation/${openApi.paths[path][method].operationId}`
  }
});
