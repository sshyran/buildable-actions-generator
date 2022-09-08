const fs = require("fs");
const http = require("http")
const axios = require("axios")
const { snakeCase } = require("snake-case");
const kebabCase = require("lodash/kebabCase")
const {titleCase} = require("title-case")
const get = require("lodash/get")
const set = require("lodash/set")
const union = require("lodash/union")
const omit = require("lodash/omit")
const { spawn } = require('child_process');
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

const httpMethods = {}
http.METHODS.forEach(method => {
  httpMethods[method.toLowerCase()] = method
})

const _generate = async ({ openapi, path, method, baseURL, config, getParams, getTitle, getDescription, getDocs, getRunFile, getInputFile, getConfigFile, getConfigName } = {}) => {
  if(!httpMethods[method] || openapi.paths[path][method].deprecated || Object.keys(get(openapi.paths[path][method], "requestBody.content", [])).find(i => i === "multipart/form-data")) {
    return
  }

  let url = (baseURL || getBaseUrl(openapi, path, method)) + getFullPath(openapi, path, method);

  const auth = getEnvVarParams(config, ["auth"])

  const headers = [];

  const openapiHeaders = getHeaders(openapi, path, method)
  const envVarHeaders = getEnvVarParams(config, ["header"])
  
  for(let header of openapiHeaders) {
    const envVarHeader = envVarHeaders.find(p => p.name.toLowerCase() === header.name.toLowerCase())
    if(header.isAuth && envVarHeader) {
      headers.push({
        ...header,
        ...envVarHeader,
      })
    } else if (!header.isAuth) {
      headers.push(header)
    }
  }

  const params = getParams ? getParams(openapi, path, method) : getEnvVarParams(config, ["path", "query"]).concat(getParameters(openapi, path, method));

  const body = getEnvVarParams(config, ["body"]).concat(getBodyParameters(openapi, path, method));

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
  
  if(get(openapi.paths[path][method], "requestBody.content.application/x-www-form-urlencoded")) {
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


  const summary = openapi.paths[path][method].summary || openapi.paths[path][method].description || kebabCase(openapi.paths[path][method].operationId).replace(/-/g, " ") || `${method.toUpperCase()} ${path}`

  const title = (getTitle ? getTitle(openapi, path, method) : titleCase(summary)).substring(0, 100)

  const formattedSummary = sentenceCase(summary).endsWith(".") ? sentenceCase(summary).slice(0, -1) : sentenceCase(summary)

  const description = getDescription ? getDescription(openapi, path, method) : formattedSummary + ` using the ${titleCase(config.platform)} API`;

  const docs = getDocs ? getDocs(openapi, path, method) : get(openapi.paths[path][method], "externalDocs.url") 

  const runFileInput = {
    openapi, 
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

  const configName = getConfigName ? getConfigName({ openapi, path, method }) : camelize(openapi.paths[path][method].operationId || openapi.paths[path][method].summary || openapi.paths[path][method].description) + "Result"
  
  const configFileInput = {
    openapi, 
    path, 
    method,
    title,
    description,
    name: configName.length > 50 || configName.length === 0 ? "result" : configName,
    ...cleanConfigEnvVars(config)
  }

  const _configFile = getConfigFile ? getConfigFile(configFileInput) : configFile(omit(configFileInput, ["openapi"]));

  const inputFileParams = `
    ${mapWithTemplate(union(auth, headers, params, body)
      .filter(i => !i.hardcoded)
      .filter((p) => p.required)
      .sort((a, b) => {
        if(a.isEnvironmentVariable) {
          return -1
        }

        if(b.isEnvironmentVariable) {
          return 1
        }

        if(a.in === "header") {
          return -1
        }

        if(b.in === "header") {
          return 1
        }
      }), requiredInputTemplate)
      .join("\n")}
    
    ${mapWithTemplate(union(auth, headers, params, body)
      .filter(i => !i.hardcoded)
      .filter((p) => !p.required), optionalInputTemplate)
      .join("\n")}
  `;

  const inputFileInput = {
    openapi, 
    path, 
    method,
    title, 
    docs, 
    input: inputFileParams,
  }

  let _inputFile = getInputFile ? getInputFile(inputFileInput) : inputFile(inputFileInput);
  
  return {
    input: _inputFile,
    run: _runFile,
    config: _configFile,
  }

}

const getGeneratorInput = async (platform) => {
  const files = fs.readdirSync(`./platforms`)

  if(!files.find(f => f === platform)) {
    throw new Error("cannot find platform with name: " + platform)
  }

  const { getGeneratorInput } = require(`./platforms/${platform}`)

  const generatorInput = getGeneratorInput()

  let openapi

  if(generatorInput.url) {
    try {
      openapi = (await axios({
        url: generatorInput.url
      })).data
    } catch(e) {
      console.error("Error parsing retrieving openapi spec from url:", generatorInput.url)
    }
  }

  if(!openapi) {
    try {
      openapi = JSON.parse(fs.readFileSync(`./platforms/${platform}/openapi.json`))
    } catch(e) {
      console.error("Error parsing openapi spec")
      throw e
    }
  }

  return {
    ...generatorInput,
    openapi,
  }
}

const generate = async ({ openapi, paths, methods, ...rest }) => {
  const result = {}

  for (const path of paths || Object.keys(openapi.paths)) {
    for (const method of methods || Object.keys(openapi.paths[path])) {

      const res = await _generate({ ...rest, openapi, path, method })

      if(res) {
        const { input, run, config } = res

        set(result, `["${path}"]["${method}"].input`, input)
        set(result, `["${path}"]["${method}"].run`, run)
        set(result, `["${path}"]["${method}"].config`, config)
      }
      
      
    }
  }

  return result
}

const getDirName = ({ openapi, path, method }) => {
  return kebabCase(openapi.paths[path][method].operationId || openapi.paths[path][method].summary || openapi.paths[path][method].description || `${method.toUpperCase()} ${path}`)
}

const writeGeneratedFiles = async ({ platform, generated, openapi, getDirName: _getDirName }) => {
  // console.log(JSON.stringify(generated, null, 2))
  for(const path in generated) {
    for(const method in generated[path]) {
      const res = generated[path][method]

      if(res) {
        const { input, run, config } = res
        // console.log(path, method)
        const dir = `generated/${platform}/${_getDirName ? _getDirName({ openapi, path, method }) : getDirName({ openapi, path, method }) }`;

        await fs.promises.mkdir(dir, { recursive: true });
  
        await fs.promises.writeFile(`${dir}/run.js`, run);
        await fs.promises.writeFile(`${dir}/config.json`, JSON.stringify(config));
        await fs.promises.writeFile(`${dir}/input.js`, input);
      }
    }
  }
}

const prettifyFiles = async ({ platform }) => {
  const _spawn = spawn("npx", ["prettier", "--write", `generated/${platform}/**/*.{js,json}`])

  return new Promise((resolve, reject) => {
    _spawn.stdout.on('data', function(msg){         
      console.log(msg.toString())
    });
  
    _spawn.stderr.on('data', function(msg){         
      console.log(msg.toString())
    });
  
    _spawn.on('close', (code) => {
      console.log("exited with code:", code)
      resolve()
    });
  })
}

module.exports = {
  generate,
  getGeneratorInput,
  writeGeneratedFiles,
  prettifyFiles,
  getDirName,
  inputFile,
  runFile
}
