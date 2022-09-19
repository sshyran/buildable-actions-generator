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

  let axiosParams = queryParams.length > 0
  ? `params: {${queryParams.sort(requiredSort).map(getTemplateObjectAttribute)}}`
  : ""

  let axiosData = ""

  if(get(body, "schema.items")) {
    axiosData = `data: ${body.name}` // pass entire body
  }
  if(get(body, "schema.properties")) {
    const bodyProperties = Object.values(body.schema.properties)
    if(isFormUrlEncoded) {
      axiosData = bodyProperties.length > 0 ? `data: qs.stringify({${bodyProperties.sort(requiredSort).map(getTemplateObjectAttribute)}})` : "";
    } else {
      axiosData =
      bodyProperties.length > 0
          ? `data: {${bodyProperties.sort(requiredSort).map(getTemplateObjectAttribute)}}`
          : "";
    }
  }

  let url = (config.baseURL || getBaseUrl(openapi, path, method)) + path;

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
  ${`const axios = require("axios");` + isFormUrlEncoded ? `\nconst qs = require("qs");` : ""}
  
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

  const inputFileParams = `
    ${mapWithTemplate(input
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