const fs = require("fs");
const http = require("http")
const axios = require("axios")
const kebabCase = require("lodash/kebabCase")
const get = require("lodash/get")
const intersection = require("lodash/intersection")
const { spawn } = require('child_process');
const {
  camelize,
  supportedMediaTypes,
  getParams,
  getBody,
  getHeadrs,
  getSample,
  stringIsAValidUrl,
  santizeReservedKeywords
} = require("./utils");
const { defaultTemplates } = require("./templates")

const httpMethods = {}
http.METHODS.forEach(method => {
  httpMethods[method.toLowerCase()] = method
})



const getOpenAPISpec = async (path) => {
  const isUrl = stringIsAValidUrl(path, ["http", "https"])
  if(isUrl) {
    return (await axios({
      url: path
    })).data
  } else {
    return JSON.parse(await fs.promises.readFile(path))
  }
}

const getGeneratorInput = async (platform) => {
  const files = fs.readdirSync(`./platforms`)

  if(!files.find(f => f === platform)) {
    throw new Error("cannot find platform with name: " + platform)
  }

  const { getGeneratorInput: _getGeneratorInput } = require(`./platforms/${platform}`)

  const generatorInput = _getGeneratorInput()
  
  const platformFiles = fs.readdirSync(`./platforms/${platform}`)

  const path = platformFiles.find(f => f === "openapi.json") ? `./platforms/${platform}/openapi.json` : generatorInput.url

  if(!path) {
    throw new Error("Must specify a local openapi.json file or a valid remote url for the openapi spec in the generatorInput")
  }  

  let openapi

  try {
    openapi = getOpenAPISpec(path)
  } catch(e) {
    console.error("Error retreiving openapi spec")
    throw e
  }

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

const getDirName = ({ openapi, path, method }) => {
  return kebabCase(openapi.paths[path][method].operationId || openapi.paths[path][method].summary || openapi.paths[path][method].description || `${method.toUpperCase()} ${path}`)
}

const prettifyFiles = async ({ path }) => {
  const _spawn = spawn("npx", ["prettier", "--write", path])

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

const traverseEndpoints = async ({ openapi, paths, methods, config, callback, ...rest }) => {
  let context

  for (const path of paths || Object.keys(openapi.paths)) {
    for (const method of methods || Object.keys(openapi.paths[path])) {

      await callback({ openapi, path, method, config, ...rest, context })
    }
  }
  
  return context
}

const getEndpointData = ({ openapi, path, method }) => {
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

const getModifiedParams = ({ openapi, path, method, config = {} }) => {
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
        varName = camelize(splitHeaderName.slice(1).join("-")).replace(/-/g, "")
      } else {
        varName = camelize(param.name).replace(/-/g, "")
      }
    } else {
      varName = camelize(param.name).replace(".", "") //remove periods in names
    }

    param.varName = santizeReservedKeywords(varName)

    

    return param
  }

  pathParams = pathParams.map(param => modifyParam({ param, openapi, config }))
  queryParams = queryParams.map(param => modifyParam({ param, openapi, config }))
  headers = headers.map(param => modifyParam({ param, openapi, config }))

  if(body && body.schema) {
    if(body.schema.properties) { // body is object
      for(const property in body.schema.properties) {
        //TODO: set sample on entire object and then pull sample pieces?
        const required = !!get(body, "schema.required", []).find(p => p === property)
        body.schema.properties[property] = modifyParam({ param: { schema: body.schema.properties[property], name: property, required, in: "body" }, openapi, config })
      }
    }
    if(body.schema.items) { // body is array
      body = modifyParam({ param: { ...body, name: "$$body", in: "body" }, openapi, config })
    }
  }

  return {
    pathParams,
    queryParams,
    headers,
    body
  }
}

const getTemplatesResults = ({ openapi, path, method, config = {}, templates = defaultTemplates, ...rest }) => {
  const {
    pathParams,
    queryParams,
    headers,
    body
  } = getModifiedParams({ openapi, path, method, config })
  
  return templates.map(({ getTemplateResult, filename }) => {
    return { templateResult: getTemplateResult({ openapi, path, method, config, pathParams, queryParams, headers, body, ...rest }), filename }
  })
}

const generateOne = async ({ openapi, path, method, config = {}, ...rest }) => {
  if(shouldSkipEndpoint({ openapi, path, method })) {
    return
  }
  
  const templatesResults = getTemplatesResults({ openapi, path, method, config, ...rest })

  const actionName = getDirName({ openapi, path, method })

  templatesResults.forEach(({ templateResult, filename }) => {
    fs.mkdirSync(`generated/${config.platform}/${actionName}/`, { recursive: true })
    fs.writeFileSync(`generated/${config.platform}/${actionName}/${filename}`, templateResult)
  })
}

const generate = async ({ openapi, paths, methods, config, ...rest }) => {
  await traverseEndpoints({ openapi, paths, methods, config, ...rest, callback: generateOne })
  await prettifyFiles({ path: `generated/${config.platform}/` })
}


module.exports = {
  generate,
  generateOne,
  getGeneratorInput,
  prettifyFiles,
  getDirName,
}
