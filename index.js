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
} = require("./utils");

const { generateChangelogs } = require("./generate-changelogs");



let configFile = ({ name, title, description, ...rest }) => ({
  name: name,
  title: title,
  description: description,
  image: `https://assets.buildable.dev/catalog/node-templates/${rest.platform}.svg`,
  ...rest
});

let inputFile = ({ title, docs, input }) => `
const nodeInput = ({ $body, $headers, $env, $data }) => {
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
${imports || `const axios = require("axios");`}

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
      message: error?.message,
      data: error?.response?.data,
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

const run = async ({ baseURL, config, getParams, getTitle, getDescription, getDocs, getRunFile, getInputFile, getConfigFile, getConfigName, getAxiosCall, getDirName, pathOrURL, isURL  } = {}) => {

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
    console.log(path)
    for (let method in openApi.paths[path]) {
      console.log(">", method)
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

      (url.match(/{(\w|-)*}/g) || []).forEach(match => {
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

      const formattedSummary = sentenceCase(summary).endsWith(".") ? sentenceCase(summary).slice(0, -1) : sentenceCase(summary)

      const description = getDescription ? getDescription(openApi, path, method) : formattedSummary + ` using the ${titleCase(config.platform)} API`;

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

      const configName = getConfigName ? getConfigName({ openApi, path, method }) : camelize(openApi.paths[path][method].operationId || openApi.paths[path][method].summary || openApi.paths[path][method].description) + "Result"
      
      const configFileInput = {
        openApi, 
        path, 
        method,
        title,
        description,
        name: configName.length > 50 || configName.length === 0 ? "result" : configName,
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



      let dir = `generated/${getDirName ? getDirName({ openApi, path, method }) : kebabCase(openApi.paths[path][method].operationId || openApi.paths[path][method].summary || openApi.paths[path][method].description || `${method.toUpperCase()} ${path}`)}`;

      fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(`${dir}/run.js`, _runFile);
      fs.writeFileSync(`${dir}/config.json`, JSON.stringify(_configFile));
      fs.writeFileSync(`${dir}/input.js`, _inputFile);
    }
  }

  await generateChangelogs(config.platform); // Generate changelogs
};


run({
  baseURL: `https://api.stripe.com`,
  config: {
    platform: "stripe",
    type: "js-request-function",
    envVars: {
      BUILDABLE_STRIPE_SECRET_KEY: {
        development: "",
        production: "",
        in: "header",
        // name: "password",
        headerName: "authorization"
      }
    },
    fee: 0,
    category: "payments",
    accessType: "open",
    language: "javascript",
    price: "free",
    tags: ["payments", "accounts"],
    stateType: "stateless",
    __version: "1.0.0",
    connections: [
      {
        id: "627aceaf971c67182d1d76ca",
        type: "integration"
      }
    ]
  },
  pathOrURL: "./openapi-specs/stripe-merged.json",
  isURL: false,
  getConfigName({ openApi, path, method }) {
    return camelize(openApi.paths[path][method].summary || openApi.paths[path][method].operationId) + "Result"
  },
  getDirName({ openApi, path, method }) {
    return kebabCase(openApi.paths[path][method].summary || openApi.paths[path][method].operationId)
  }
})
