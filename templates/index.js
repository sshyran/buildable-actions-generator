const { snakeCase } = require("snake-case");
const kebabCase = require("lodash/kebabCase")
const {titleCase} = require("title-case")
const get = require("lodash/get")
const pick = require("lodash/pick")
const union = require("lodash/union")
const cloneDeep = require("lodash/cloneDeep")
const {
  camelize,
  sentenceCase,
  getBaseUrl,
  requiredInputTemplate,
  optionalInputTemplate,
  mapWithTemplate,
  getTemplateString,
  getTemplateObjectAttribute,
  requiredSort,
} = require("../utils");

const getTemplateInputAuth = ({ config }) => {
  //handle basic auth explicitly from the config - TODO: change this?
  const auth = []
  for(const key in config.envVars) {
    const envVar = config.envVars[key]
    if(envVar.in === "auth") {
      auth.push({ ...envVar, required: true, isEnvironmentVariable: true, sample: `$env.${key}`, envVarName: key, varName: key })
    }
  }
  
  return auth
}



const paramsSort = (a, b) => {
  const firstOrder = [
    { key: "isEnvironmentVariable", value: true },
    { key: "required", value: true },
  ]

  const secondOrder = [
    { key: "in", value: "header" },
    { key: "in", value: "path" },
    { key: "in", value: "query" },
    { key: "in", value: "body" }
  ]

  const thirdOrder = "varName"

  const orders = [firstOrder, secondOrder, thirdOrder]

  for(const order of orders) {
    if(Array.isArray(order)) {
      const aIndex = order.findIndex(({ key, value }) => a[key] === value)
      const bIndex = order.findIndex(({ key, value }) => b[key] === value)
      if(aIndex < bIndex) {
        return -1
      } else if (aIndex > bIndex) {
        return 1
      }
    } else if(typeof order === "string") {
      if(a[order] < b[order]) {
        return -1
      } else if (a[order] > b[order]) {
        return 1
      }
    }
  }

  return 0
}

const getTemplateInput = ({ openapi, path, method, config, pathParams, queryParams, headers, body }) => {
  const auth = getTemplateInputAuth({ config })

  const input = union(pathParams, queryParams, headers, auth)

  if(body && body.schema) {
    if(body.schema.properties) {
      for(const property in body.schema.properties) {
        input.push(body.schema.properties[property])
      }
    } else if (body.schema.items) {
      input.push(body)
    }
  }
  
  input.sort(paramsSort)

  return input
}

const getRunFile = ({ openapi, path, method, config, pathParams, queryParams, headers, body, baseURL }) => {

  const input = getTemplateInput({ openapi, path, method, config, pathParams, queryParams, headers, body })

  const isFormUrlEncoded = body && body.mediaType === "application/x-www-form-urlencoded"

  const _auth = input.filter(i => i.in === "auth")
  const _headers = input.filter(i => i.in === "header")
  const _pathParams = input.filter(i => i.in === "path")
  const _queryParams = input.filter(i => i.in === "query")
  const _body = input.filter(i => i.in === "body")

  let axiosAuth = _auth.length > 0
  ? `auth: {${_auth.map(i => `"${i.name}": ${i.varName}`).join(", ")}}`
  : ""

  let axiosHeaders = _headers.length > 0 
  ? `headers: {${_headers.map(getTemplateObjectAttribute).join(", ")}}`
  : ""

  let axiosParams = _queryParams.length > 0
  ? `params: {${_queryParams.map(getTemplateObjectAttribute).join(", ")}}`
  : ""

  let axiosData = ""

  if(get(body, "schema.items")) {
    axiosData = `data: ${body.name}` // pass entire body
  }
  if(get(body, "schema.properties")) {
    const formattedBodyProperties = _body.map(getTemplateObjectAttribute)

    if(isFormUrlEncoded) {
      axiosData = _body.length > 0 ? `data: qs.stringify({${formattedBodyProperties}})` : "";
    } else {
      axiosData = _body.length > 0 ? `data: {${formattedBodyProperties}}`: "";
    }
  }

  let url = (baseURL || getBaseUrl(openapi, path, method)) + path;

  (url.match(/{(\w|-)*}/g) || []).forEach(match => {
    const param = pathParams.find(p => [p.name, p.varName, p.envVarName].includes(match.substring(1, match.length - 1)))
    if(param) {
      url = url.replace(match, `\${${param.varName}}`)
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

  const inputVarNames = input.map(i => i.varName)

  return `
  ${`const axios = require("axios");` + (isFormUrlEncoded ? `\nconst qs = require("qs");` : "")}
  
  const run = async (input) => {
    const { ${inputVarNames.join(",")} } = input;
  
    verifyInput(input);
  
    try {
      const { ${inputVarNames.includes("data") ? "data: _data" : "data"} } = await axios({
        ${axiosCall}
      });
  
      return ${inputVarNames.includes("data") ? "_data" : "data"};
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

const getInputFile = ({ openapi, path, method, config, pathParams, queryParams, headers, body }) => {

  const input = getTemplateInput({ openapi, path, method, config, pathParams, queryParams, headers, body })

  const inputFileParams = `
    ${mapWithTemplate(input
      .filter(i => !i.hardcoded)
      .filter((p) => p.required), requiredInputTemplate)
      .join("\n")}
    
    ${mapWithTemplate(input
      .filter(i => !i.hardcoded)
      .filter((p) => !p.required), optionalInputTemplate)
      .join("\n")}
  `;

  return `
  const nodeInput = ({ $body, $headers, $env, $data }) => {
    return {
      ${inputFileParams}
    };
  }`;
}

const getConfigFile = ({ openapi, path, method, config, pathParams, queryParams, headers, body }) => {
    
  const clonedConfig = cloneDeep(config)
  for(const envVar in clonedConfig.envVars) {
    clonedConfig.envVars[envVar] = pick(clonedConfig.envVars[envVar], ["development", "production"])
  }

  const summary = openapi.paths[path][method].summary || openapi.paths[path][method].description || kebabCase(openapi.paths[path][method].operationId).replace(/-/g, " ") || `${method.toUpperCase()} ${path}`

  const title = titleCase(summary).substring(0, 100)

  const configName = camelize(openapi.paths[path][method].operationId || openapi.paths[path][method].summary || openapi.paths[path][method].description) + "Result"

  const name = configName.length > 50 || configName.length === 0 ? "result" : configName

  const sentanceCaseSummary = sentenceCase(summary)

  const description = sentanceCaseSummary.endsWith(".") ? sentanceCaseSummary.slice(0, -1) : sentanceCaseSummary

  return JSON.stringify({
    name,
    title,
    description,
    image: `https://assets.buildable.dev/catalog/node-templates/${config.platform}.svg`,
    ...clonedConfig
  });
}

const defaultTemplates = [{ getTemplateResult: getRunFile, filename: "run.js" }, { getTemplateResult: getInputFile, filename: "input.js" }, { getTemplateResult: getConfigFile, filename: "config.json" }]

module.exports = {
  getRunFile,
  getInputFile,
  getConfigFile,
  defaultTemplates
}