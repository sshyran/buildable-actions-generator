const fs = require("fs");
const http = require("http")
const axios = require("axios")
const { snakeCase } = require("snake-case");
const kebabCase = require("lodash/kebabCase")
const {titleCase} = require("title-case")
const get = require("lodash/get")
const union = require("lodash/union")
const omit = require("lodash/omit")
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
  requiredInputTemplate,
  optionalInputTemplate,
  mapWithTemplate,
  cleanConfigEnvVars,
  getTemplateString,
  getTemplateObjectAttribute,
  requiredSort
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
 * 
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
  imports,
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

${imports || `const axios = require("axios");`}

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

const run = async ({ baseURL, config, getParams, getTitle, getDescription, getDocs, getRunFile, getInputFile, getConfigFile, getAxiosCall, pathOrURL, isURL  } = {}) => {

  let openApi

  if(isURL) {
    openApi = (await axios({
      url: pathOrURL
    })).data
  } else {
    openApi = JSON.parse(fs.readFileSync(pathOrURL));
  }

  const httpMethods = {}
  http.METHODS.forEach(method => {
    httpMethods[method.toLowerCase()] = method
  })

  for (let path in openApi.paths) {
    // console.log(path)
    for (let method in openApi.paths[path]) {
      // console.log(">", method)
      if(!httpMethods[method] || openApi.paths[path][method].deprecated || Object.keys(get(openApi.paths[path][method], "requestBody.content", [])).find(i => i === "multipart/form-data")) {
        continue
      }

      let url = (baseURL || getBaseUrl(openApi, path, method)) + getFullPath(openApi, path, method);

      const auth = getEnvVarParams(config, ["auth"])

      const headers = [];

      const openApiHeaders = getHeaders(openApi, path, method)
      const envVarHeaders = getEnvVarParams(config, ["header"])
      
      for(let header of openApiHeaders) {
        const envVarHeader = envVarHeaders.find(p => p.headerName.toLowerCase() === header.name.toLowerCase())
        if(header.isAuth && envVarHeader) {
          headers.push({
            ...header,
            ...envVarHeader,
          })
        } else if (!header.isAuth) {
          headers.push(header)
        }
      }

      const params = getParams ? getParams(openApi, path, method) : getEnvVarParams(config, ["path", "query"]).concat(getParameters(openApi, path, method));

      const body = getEnvVarParams(config, ["body"]).concat(getBodyParameters(openApi, path, method));

      let axiosAuth = auth.length > 0
      ? `auth: {${auth.sort(requiredSort).map(getTemplateObjectAttribute).join(", ")}}`
      : ""

      let axiosHeaders = headers.length > 0 
      ? `headers: {${headers.sort(requiredSort).map(getTemplateObjectAttribute).join(", ")}}`
      : ""

      const queryParams = params.filter((i) => i.in === "query")
      let axiosParams = queryParams.length > 0
      ? `params: {${queryParams.sort(requiredSort).map(getTemplateObjectAttribute)}}`
      : ""

      let axiosData =
        body.length > 0
          ? `data: {${body.sort(requiredSort).map(getTemplateObjectAttribute)}}`
          : "";
      

      let imports = ""
      
      if(get(openApi.paths[path][method], "requestBody.content.application/x-www-form-urlencoded")) {
        imports = `const axios = require("axios");\nconst qs = require("qs");`
        axiosData = body.length > 0 ? `data: qs.stringify({${body.sort(requiredSort).map(getTemplateObjectAttribute)}})` : "";
      }

      (url.match(/{\w*}/g) || []).forEach(match => {
        const param = params.find(p => [p.name, p.camelizedName, p.envVarName].includes(match.substring(1, match.length - 1)))
        if(param) {
          url = url.replace(match, `\${${getInputName(param)}}`)
        }
      });
      
      let axiosCall = `
        method: ${getTemplateString(method)},
        url: ${getTemplateString(url)},
        ${[axiosHeaders, axiosAuth, axiosParams, axiosData].filter(i => !!i.trim()).join(",\n")}
      `;

      // first display env vars, then required, then optional
      const inputUnion = union(auth, headers, params, body)

      let inputEnvs = inputUnion
        .filter(i => !i.hardcoded && i.isEnvironmentVariable)
      
      let inputNonEnvs = inputUnion
        .filter(i => !i.hardcoded && !i.isEnvironmentVariable)
        .sort(requiredSort)
      
      let input = inputEnvs.concat(inputNonEnvs)
      

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

    
      const summary = openApi.paths[path][method].summary || openApi.paths[path][method].description || kebabCase(openApi.paths[path][method].operationId).replace(/-/g, " ") || `${method.toUpperCase()} ${path}`

      const title = (getTitle ? getTitle(openApi, path, method) : titleCase(summary)).substring(0, 100)

      const description = getDescription ? getDescription(openApi, path, method) : sentenceCase(summary) + ` using the ${titleCase(config.platform)} API`;

      const docs = getDocs ? getDocs(openApi, path, method) : get(openApi.paths[path][method], "externalDocs.url") 

      const runFileInput = {
        openApi, 
        path, 
        method,
        title,
        description,
        docs,
        imports,
        input: input.map((i) => getInputName(i)),
        axiosCall,
        url,
        axiosAuth, 
        axiosHeaders, 
        axiosParams, 
        axiosData,
        verifyInput,
        verifyErrors,
        verifyChecks,
      }

      const _runFile = getRunFile ? getRunFile(runFileInput) : runFile(runFileInput);

      const configFileName = camelize(openApi.paths[path][method].operationId || openApi.paths[path][method].summary || openApi.paths[path][method].description) + "Result"
      
      const configFileInput = {
        openApi, 
        path, 
        method,
        title,
        description,
        name: configFileName.length > 50 || configFileName.length === 0 ? "result" : configFileName,
        ...cleanConfigEnvVars(config)
      }

      const _configFile = getConfigFile ? getConfigFile(configFileInput) : configFile(omit(configFileInput, ["openApi", "path", "method"]));

      const inputFileParams = `
        ${mapWithTemplate(union(auth, headers, params, body)
          .filter(i => !i.hardcoded)
          .filter((p) => p.required), requiredInputTemplate)
          .join("\n")}
        
        ${mapWithTemplate(union(auth, headers, params, body)
          .filter(i => !i.hardcoded)
          .filter((p) => !p.required), optionalInputTemplate)
          .join("\n")}
      `;

      const inputFileInput = {
        openApi, 
        path, 
        method,
        title, 
        docs, 
        input: inputFileParams,
      }

      let _inputFile = getInputFile ? getInputFile(inputFileInput) : inputFile(inputFileInput);



      let dir = `generated/${kebabCase(openApi.paths[path][method].operationId || openApi.paths[path][method].summary || openApi.paths[path][method].description || `${method.toUpperCase()} ${path}`)}`;

      fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(`${dir}/run.js`, _runFile);
      fs.writeFileSync(`${dir}/config.json`, JSON.stringify(_configFile));
      fs.writeFileSync(`${dir}/input.js`, _inputFile);
    }
  }
};

// run({
//   // baseURL: "{TATUM_API_URL}", // can be hardcoded string (i.e https://my-api.com) and/or contain envVar replacement values (i.e https://{SOME_API_URL}/api)
//   config: {
//     type: "js-request-function",
//     envVars: {
//       TWITTER_BEARER_TOKEN: {
//         development: "",
//         production: "",
//         in: "header",
//         headerName: "authorization"
//       },
//     },
//     fee: 0,
//     category: "social",
//     accessType: "open",
//     language: "javascript",
//     price: "free",
//     platform: "twitter",
//     tags: ["twitter", "social"],
//     stateType: "stateless",
//     __version: "1.0.0",
//   },
//   pathOrURL: "https://api.twitter.com/2/openapi.json",
//   isURL: true,
//   getDocs: (openApi, path, method) => {
//     return `https://developer.twitter.com/en/docs/api-reference-index#twitter-api-v2`
//   },
//   getRunFile: ({
//     openApi, 
//     path, 
//     method,
//     url, 
//     axiosAuth, 
//     axiosHeaders, 
//     axiosParams, 
//     axiosData,
//     title,
//     description,
//     docs,
//     input,
//     axiosCall,
//     verifyInput,
//     verifyErrors,
//     verifyChecks,
//   }) => {
//     axiosParams = axiosParams.trim().length > 0 ? axiosParams + `,
//       paramsSerializer: (params) => {
//         return qs.stringify(params, { arrayFormat: "comma" });
//       }
//       ` : ""

//     return `
//     /**
//      * ----------------------------------------------------------------------------------------------------
//      * ${title} [Run]
//      *
//      * @description - ${description}
//      *
//      * @author    Buildable Technologies Inc.
//      * @access    open
//      * @license   MIT
//      * @docs      ${docs}
//      *
//      * ----------------------------------------------------------------------------------------------------
//      */
    
//     const axios = require("axios");${axiosParams.trim().length > 0 ? `\nconst qs = require("qs");` : ""}
    
    
//     /**
//      * The Node’s executable function
//      *
//      * @param {Run} input - Data passed to your Node from the input function
//      */
//     const run = async (input) => {
//       const { ${input} } = input;
    
//       verifyInput(input);
    
//       try {
//         const { data } = await axios({
//           method: "${method}",
//           url: \`${url}\`,
//           ${[axiosHeaders, axiosAuth, axiosParams, axiosData].filter(i => !!i.trim()).join(",\n")}
//         });
    
//         return data;
//       } catch (error) {
//         return {
//           failed: true,
//           message: error.message,
//           data: error.response.data,
//         };
//       }
//     };
    
//     /**
//      * Verifies the input parameters
//      */
//     const verifyInput = ({ ${verifyInput} }) => {
//       const ERRORS = {
//         ${verifyErrors}
//       };
    
//       ${verifyChecks}
//     };
//     `
//   }
// });


run({
  baseURL: "{SPOTIFY_BASE_URI}", // can be hardcoded string (i.e https://my-api.com) and/or contain envVar replacement values (i.e https://{SOME_API_URL}/api)
  config: {
    platform: "spotify",
    type: "js-request-function",
    envVars: {
      SPOTIFY_BASE_URI: {
        development: "https://api.spotify.com/v1",
        production: "https://api.spotify.com/v1",
        in: "path"
      },
      SPOTIFY_CLIENT_ID: {
        development: "",
        production: "",
        in: "auth",
        name: "username"
      },
      SPOTIFY_CLIENT_SECRET: {
        development: "",
        production: "",
        in: "auth",
        name: "password"
      }
    },
    fee: 0,
    category: "media",
    accessType: "open",
    language: "javascript",
    price: "free",
    tags: ["music", "podcasts"],
    stateType: "stateless",
    __version: "1.0.0",
  },
  pathOrURL: "./openapi-specs/spotify.json",
  isURL: false,
  getRunFile: ({
    title,
    description,
    docs,
    imports,
    input,
    url,
    method,
    axiosHeaders,
    axiosAuth,
    axiosParams,
    axiosData,
    verifyInput,
    verifyErrors,
    verifyChecks,
  }) => {
    return `
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
        const { data: { access_token } } = await axios({
          method: "post",
          url: "https://accounts.spotify.com/api/token",
          headers: { 
            "Content-Type": "application/x-www-form-urlencoded" 
          },
          auth: {
            username: SPOTIFY_CLIENT_ID,
            password: SPOTIFY_CLIENT_SECRET
          },
          data: qs.stringify({ grant_type: "client_credentials" })
        });
        
        const { ${input.includes("data") ? "data: _data" : "data"} } = await axios({
          method: ${getTemplateString(method)},
          url: ${getTemplateString(url)},
          headers: {
            Authorization: \`Bearer \${access_token}\`
          },
          ${[
            axiosParams,
            axiosData].filter(i => !!i.trim()).join(",\n")}
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
    };`
    
  }
});
