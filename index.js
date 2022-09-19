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
const intersection = require("lodash/intersection")
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
  requiredSort,
  supportedMediaTypes,
  getParams,
  getBody,
  getHeadrs,
  getSample
} = require("./utils");
const { intersection } = require("lodash");
const { getEndpoint } = require("openapi-snippet/openapi-to-har");



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

const generateOne = async ({ openapi, path, method, baseURL, config, getParams, getTitle, getDescription, getDocs, getRunFile, getInputFile, getConfigFile, getConfigName } = {}) => {
  

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
    method: "${method}",
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
  
  const platformFiles = fs.readdirSync(`./platforms/${platform}`)

  let openapi

  if(platformFiles.find(f => f === "openapi.json")) {
    try {
      openapi = JSON.parse(fs.readFileSync(`./platforms/${platform}/openapi.json`))
    } catch(e) {
      console.error("Error parsing openapi spec")
      throw e
    }
  } else if (generatorInput.url) {
    try {
      openapi = (await axios({
        url: generatorInput.url
      })).data
    } catch(e) {
      console.error("Error parsing retrieving openapi spec from url:", generatorInput.url)
      throw e
    }
  } else {
    throw new Error("Must specify a local openapi.json file or a valid remote url for the openapi spec in the generatorInput")
  }

  return {
    ...generatorInput,
    openapi,
  }
}

const shouldSkipEndpoint = ({ openapi, path, method }) => {
  if(!httpMethods[method] || openapi.paths[path][method].deprecated) {
   return true
  }
  
  const requestBodyMediaTypes = Object.keys(get(openapi.paths[path][method], "requestBody.content", {}))

  if(requestBodyMediaTypes.length > 0 && intersection(supportedMediaTypes, requestBodyMediaTypes).length === 0) {
    return true
  }

  return false
}

const generate = async ({ openapi, paths, methods, ...rest }) => {
  const result = {}

  for (const path of paths || Object.keys(openapi.paths)) {
    for (const method of methods || Object.keys(openapi.paths[path])) {

      if(!shouldSkipEndpoint({ openapi, path, method })) {
        const res = await generateOne({ ...rest, openapi, path, method })

        if(res) {
          const { input, run, config } = res
  
          set(result, `["${path}"]["${method}"].input`, input)
          set(result, `["${path}"]["${method}"].run`, run)
          set(result, `["${path}"]["${method}"].config`, config)
        }
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


const traverseEndpoints = async ({ openapi, paths, methods, cb }) => {
  for (const path of paths || Object.keys(openapi.paths)) {
    for (const method of methods || Object.keys(openapi.paths[path])) {

      await cb({ openapi, path, method })
    }
  }
}

const getEndpointData = async ({ openapi, path, method }) => {
  const parameters = getParams({ openapi, path, method }) || []

  const pathParams = parameters.filter(p => p.in === "path")
  const queryParams = parameters.filter(p => p.in === "query")
  
  const headers = getHeadrs({ openapi, path, method })
  
  const body = getBody({ openapi, path, method })

  return {
    pathParams,
    queryParams,
    headers,
    body
  }
}

const getRunFile = ({ openapi, path, method, config, pathParams, queryParams, headers, body }) => {
  const input = union(pathParams, queryParams, headers)

  if(body && body.schema) {
    if(body.schema.properties) {
      for(const property in body.schema.properties) {
        input.push(body.schema.properties[property])
      }
    } else if (body.schema.items) {
      input.push(body)
    }
  }

  const paramsSort = (a, b) => {
    const orderOfImportance = [
      "isEnvironmentVariable",
      "required",
    ]

    const aPropertyIndex = orderOfImportance.findIndex(property => a[property])
    const bPropertyIndex = orderOfImportance.find(property => b[property])

    if(aPropertyIndex === bPropertyIndex) {
      if(a.varName < b.varName) {
        return -1
      } else {
        return 1
      }
    }

    return aPropertyIndex - bPropertyIndex
  }
  
  input.sort(paramsSort).map(p => p.varName)

  const isFormUrlEncoded = body && body.mediaType === "application/x-www-form-urlencoded"

  //handle basic auth explicitly from the config - TODO: change this?
  const auth = []
  for(const key in config.envVars) {
    const envVar = config.envVars[key]
    if(envVar.in === "auth") {
      auth.push({ ...envVar, envVarName: key })
    }
  }

  let axiosAuth = auth.length > 0
  ? `auth: {${auth.map(i => `"${i.name}": $env.${i.envVarName}`).join(", ")}}`
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

  if(body.schema.items) {
    axiosData = `data: ${body.name}` // pass entire body
  }
  if(body.schema.properties && isFormUrlEncoded) {
    axiosData = body.length > 0 ? `data: qs.stringify({${Object.values(body.schema.properties).sort(requiredSort).map(getTemplateObjectAttribute)}})` : "";
  }

  let url = (config.baseURL || getBaseUrl(openapi, path, method)) + path;

  (url.match(/{(\w|-)*}/g) || []).forEach(match => {
    const param = pathParams.find(p => [p.name, p.varName, p.envVarName].includes(match.substring(1, match.length - 1)))
    if(param) {
      url = url.replace(match, `\${${p.varName}}`)
    }
  });

  const axiosCall = `
    method: ${getTemplateString(method)},
    url: ${getTemplateString(url)},
    ${[axiosHeaders, axiosAuth, axiosParams, axiosData].filter(i => !!i.trim()).join(",\n")}
  `;

  const verifyInput = input
    .filter((i) => i.required)
    .map((i) => i.varName);

  const verifyErrors = input
    .filter((i) => i.required)
    .map(
      (i) =>
        `INVALID_${snakeCase(i.varName).toUpperCase()}: "A valid ${
          i.varName
        } field (${typeof i.sample}) was not provided in the input.",`
    )
    .join("\n");

  const verifyChecks = input
    .filter((i) => i.required)
    .map(
      (i) =>
        `if (typeof ${
          i.varName
        } !== "${typeof i.sample}") throw new Error(ERRORS.INVALID_${snakeCase(
          i.varName
        ).toUpperCase()});`
    )
    .join("\n");

  return `
  ${`const axios = require("axios");` + isFormUrlEncoded ? `\nconst qs require("qs");` : ""}
  
  const run = async (input) => {
    const { ${input.join(",")} } = input;
  
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
}

//traverse through all properties, add sample data
//pass data with sample to templates
//write template to file

const _ = () => {
  const cb = async ({ openapi, path, method, config = {} }) => {
    let { pathParams, queryParams, headers, body } = getEndpointData({ openapi, path, method })
    //get endpoint data
    //set samples
    //loop through templates, passing endpoint data with samples
      //each template grabs needed data and returns file contents as text
    //loop through template results and write them to files as indicated

    const modifyParam = ({ param, openapi, config }) => {

      //associate with envVars
      for(const key in config.envVars) {
        const envVar = config.envVars[key]
        if(envVar.name === param.name && envVar.in === param.in) {
          param.isEnvironmentVariable = true
          param.envVarName = key
        }
      }

      //add sample
      param.sample = getSample({ openapi, schema: param.schema })

      //add varName
      let varName
      if(param.isEnvironmentVariable) {
        varName = param.envVarName
      } else if(param.in === "header") {
        let splitName = param.name.split("-")
        if(splitName[0].toLowerCase === "x") { //header name with X-Some-Value
          varName = santizeReservedKeywords(camelize(splitHeaderName.slice(1).join("-")).replace(/-/g, ""))
        } else {
          varName = santizeReservedKeywords(camelize(param.name).replace(/-/g, ""))
        }
      } else {
        varName = camelize(param.name).replace(".", "") //remove periods in names
      }

      param.varName = varName

      

      return param
    }

    pathParams = pathParams.map(param => modifyParam({ param, openapi, config }))
    queryParams = queryParams.map(param => modifyParam({ param, openapi, config }))
    headers = headers.map(param => modifyParam({ param, openapi, config }))

    if(body && body.schema) {
      if(body.schema.properties) { // body is object
        for(const property in body.schema.properties) {
          body.schema.properties[property] = modifyParam({ param: { ...body.schema.properties[property], name: property }, openapi, config })
        }
      }
      if(body.schema.items) { // body is array
        body = modifyParam({ param: { ...body, name: "$$body" }, openapi, config })
      }
    }

    const templates = config.templates || [{ getTemplateResult: getRunFile, filename: "run.js" }, { getTemplateResult: getInputFile, filename: "input.js" }, { getTemplateResult: getConfigFile, filename: "config.json" }]
    
    const templateResults = Promise.all(templates.map(({ getTemplateResult, filename }) => {
      return { templateResult: getTemplateResult({ openapi, path, method, config, pathParams, queryParams, headers, body }), filename }
    }))

    const actionName = getDirName({ openapi, path, method })

    templateResults.forEach(({ templateResult, filename }) => {
      fs.writeFileSync(`generated/${config.platform}/${actionName}/${filename}`, templateResult)
    })

  }
  
  traverseEndpoints({ openapi, paths, methods, cb })
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
