const OpenAPISampler = require('openapi-sampler');
const get = require("lodash/get")
const cloneDeep = require("lodash/cloneDeep")
const pick = require("lodash/pick")
const prettier = require("prettier")

function camelize(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, "")
    .replace(/\W/g, '')
}

function sentenceCase(theString) {
	var newString = theString.toLowerCase().replace(/(^\s*\w|[\.\!\?]\s*\w)/g,function(c){return c.toUpperCase()});
  return newString;
}

/**
* Returns the value referenced in the given reference string
*
* @param  {object} openApi  OpenAPI document
* @param  {string} ref      A reference string
* @return {any}
*/
const resolveRef = function (openApi, ref) {
  const parts = ref.split('/');

  if (parts.length <= 1) return {}; // = 3

  const recursive = function (obj, index) {
    if (index + 1 < parts.length) {
      // index = 1
      let newCount = index + 1;
      return recursive(obj[parts[index]], newCount);
    } else {
      return obj[parts[index]];
    }
  };
  return recursive(openApi, 1);
};

/**
* Gets the base URL constructed from the given openApi.
*
* @param  {Object} openApi OpenAPI document
* @return {string}         Base URL
*/
const getBaseUrl = function (openApi, path, method) {
  if (openApi.paths[path][method].servers)
    return openApi.paths[path][method].servers[0].url;
  if (openApi.paths[path].servers) return openApi.paths[path].servers[0].url;
  if (openApi.servers) return openApi.servers[0].url;

  let baseUrl = '';
  if (typeof openApi.schemes !== 'undefined') {
    baseUrl += openApi.schemes[0];
  } else {
    baseUrl += 'http';
  }

  if (openApi.basePath === '/') {
    baseUrl += '://' + openApi.host;
  } else {
    baseUrl += '://' + openApi.host + openApi.basePath;
  }

  return baseUrl;
};

/**
* Return the path with the parameters example values used if specified.
*
* @param  {Object} openApi OpenApi document
* @param  {string} path    Key of the path
* @param  {string} method  Key of the method
* @return {string}         Full path including example values
*/
const getFullPath = function (openApi, path, method) {
  let fullPath = path;
  const parameters =
    openApi.paths[path].parameters || openApi.paths[path][method].parameters;

  if (typeof parameters !== 'undefined') {
    for (let i in parameters) {
      let param = parameters[i];
      if (typeof param['$ref'] === 'string' && /^#/.test(param['$ref'])) {
        param = resolveRef(openApi, param['$ref']);
      }
      if (
        typeof param.in !== 'undefined' &&
        param.in.toLowerCase() === 'path'
      ) {
        if (typeof param.example !== 'undefined') {
          // only if the schema has an example value
          //  fullPath = fullPath.replace('{' + param.name + '}', param.example);
        }
      }
    }
  }
  return fullPath;
};

/**
  * Get an array of objects describing the header for a path and method pair
  * described in the given OpenAPI document.
  *
  * @param  {Object} openApi OpenAPI document
  * @param  {string} path    Key of the path
  * @param  {string} method  Key of the method
  * @return {array}          List of objects describing the header
  */
 const getHeadersArray = function (openApi, path, method) {
  const headers = [];
  const pathObj = openApi.paths[path][method];

  // 'accept' header:
  if (typeof pathObj.consumes !== 'undefined') {
    for (let i in pathObj.consumes) {
      const type = pathObj.consumes[i];
      headers.push({
        name: 'accept',
        value: type,
      });
    }
  }

  // headers defined in path object:
  if (typeof pathObj.parameters !== 'undefined') {
    for (let k in pathObj.parameters) {
      const param = pathObj.parameters[k];
      if (
        typeof param.in !== 'undefined' &&
        param.in.toLowerCase() === 'header'
      ) {
        if(param.name === "Content-Type") {
          param.required = true,
          param.hardcoded = true
        }

        headers.push(param);
      }
    }
  }

  // security:
  let basicAuthDef;
  let apiKeyAuthDef;
  let oauthDef;
  if (typeof pathObj.security !== 'undefined') {
    for (var l in pathObj.security) {
      const secScheme = Object.keys(pathObj.security[l])[0];
      const secDefinition = openApi.securityDefinitions
        ? openApi.securityDefinitions[secScheme]
        : openApi.components.securitySchemes[secScheme];
      const authType = secDefinition.type.toLowerCase();
      let authScheme = null;

      if (authType !== 'apikey' && secDefinition.scheme != null) {
        authScheme = secDefinition.scheme.toLowerCase();
      }

      switch (authType) {
        case 'basic':
          basicAuthDef = secScheme;
          break;
        case 'apikey':
          if (secDefinition.in === 'header') {
            apiKeyAuthDef = secDefinition;
          }
          break;
        case 'oauth2':
          oauthDef = secScheme;
          break;
        case 'http':
          switch (authScheme) {
            case 'bearer':
              oauthDef = secScheme;
              break;
            case 'basic':
              basicAuthDef = secScheme;
              break;
          }
          break;
      }
    }
  } else if (typeof openApi.security !== 'undefined') {
    // Need to check OAS 3.0 spec about type http and scheme
    for (let m in openApi.security) {
      const secScheme = Object.keys(openApi.security[m])[0];
      const secDefinition = openApi.components.securitySchemes[secScheme];
      const authType = secDefinition.type.toLowerCase();
      let authScheme = null;

      if (authType !== 'apikey' && authType !== 'oauth2') {
        authScheme = secDefinition.scheme.toLowerCase();
      }

      switch (authType) {
        case 'http':
          switch (authScheme) {
            case 'bearer':
              oauthDef = secScheme;
              break;
            case 'basic':
              basicAuthDef = secScheme;
              break;
          }
          break;
        case 'basic':
          basicAuthDef = secScheme;
          break;
        case 'apikey':
          if (secDefinition.in === 'header') {
            apiKeyAuthDef = secDefinition;
          }
          break;
        case 'oauth2':
          oauthDef = secScheme;
          break;
      }
    }
  }

  if (basicAuthDef) {
    headers.push({
      name: 'Authorization',
      value: 'Basic ' + 'REPLACE_BASIC_AUTH',
      isAuth: true,
      isBasicAuth: true
    });
  } else if (apiKeyAuthDef) {
    headers.push({
      name: apiKeyAuthDef.name,
      value: 'REPLACE_KEY_VALUE',
      isAuth: true,
      
    });
  } else if (oauthDef) {
    headers.push({
      name: 'Authorization',
      value: 'Bearer ' + 'REPLACE_BEARER_TOKEN',
      isAuth: true,
    });
  }

  if(get(pathObj, "requestBody.content.application/x-www-form-urlencoded")) {
    headers.push({
      name: "Content-Type",
      value: "application/x-www-form-urlencoded",
      required: true,
      hardcoded: true
    })
  }

  let _headers = []

  for(let i = 0; i < headers.length; i++) {
    let skip = false
    for(let j = i + 1; j < headers.length; j++) {
      if(headers[i].name === headers[j].name) {
        headers[j] = {
          ...headers[i],
          ...headers[j]
        }
        
        skip = true
      }
    }

    if(skip) {
      continue
    }

    _headers.push(headers[i])
  }

  return _headers;
};

const getHeaders = (openApi, path, method) => {
  const headers = getHeadersArray(openApi, path, method)

  return headers.map(header => {
    if(header.isAuth && header.value) {
      header.isEnvironmentVariable = true
      header.required = true
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
}



const _parseParameters = function (openApi, parameters, values) {
  const params = {};

  for (let i in parameters) {
    let param = parameters[i];
    if (typeof param['$ref'] === 'string' && /^#/.test(param['$ref'])) {
      param = resolveRef(openApi, param['$ref']);
    }
    if (typeof param.schema !== 'undefined') {
      if (
        typeof param.schema['$ref'] === 'string' &&
        /^#/.test(param.schema['$ref'])
      ) {
        param.schema = resolveRef(openApi, param.schema['$ref']);
        if (typeof param.schema.type === 'undefined') {
          // many schemas don't have an explicit type
          param.schema.type = 'object';
        }
      }
    }

    let sample
    try {
      sample = OpenAPISampler.sample(
        param.schema,
        { skipReadOnly: true },
        openApi
      );
    } catch (err) {
      console.log(err);
    }
    
    params[param.name] = { sample, ...param };
  }

  return params;
};

const _getParameters = function (openApi, path, method, values) {
  // Set the optional parameter if it's not provided
  if (typeof values === 'undefined') {
    values = {};
  }

  let pathParams = {};
  let methodParams = {};

  // First get any parameters from the path
  if (typeof openApi.paths[path].parameters !== 'undefined') {
    pathParams = _parseParameters(
      openApi,
      openApi.paths[path].parameters,
      values
    );
  }

  if (typeof openApi.paths[path][method].parameters !== 'undefined') {
    methodParams = _parseParameters(
      openApi,
      openApi.paths[path][method].parameters,
      values
    );
  }

  // Merge query strings, with method overriding path
  // from the spec:
  // If a parameter is already defined at the Path Item, the new definition will override
  // it but can never remove it.
  // https://swagger.io/specification/
  const queryStrings = Object.assign(pathParams, methodParams);
  return Object.values(queryStrings);
};

const getParameters = (openApi, path, method) => {
  return _getParameters(openApi, path, method, {}).filter(p => !p.deprecated && !getHeaders(openApi, path, method).find(h => h.name === p.name)).map(i => {
    i.camelizedName = camelize(i.name).replace(".", "")

    return i
  })
}

 /**
  * Get the payload definition for the given endpoint (path + method) from the
  * given OAI specification. References within the payload definition are
  * resolved.
  *
  * @param  {object} openApi
  * @param  {string} path
  * @param  {string} method
  * @return {array}  A list of payload objects
  */
const _getBodyParameters = function (openApi, path, method) {
  let bodyParameters = []
  if (typeof openApi.paths[path][method].parameters !== 'undefined') {
    for (let i in openApi.paths[path][method].parameters) {
      const param = openApi.paths[path][method].parameters[i];
      if (
        typeof param.in !== 'undefined' &&
        param.in.toLowerCase() === 'body' &&
        typeof param.schema !== 'undefined'
      ) {
        let sample
        try {
          sample = OpenAPISampler.sample(
            param.schema,
            { skipReadOnly: true },
            openApi
          );
        } catch (err) {
          console.log(err);
        }

        bodyParameters.push({ ...param, sample })
      }
    }
  }

  if (
    openApi.paths[path][method].requestBody &&
    openApi.paths[path][method].requestBody['$ref']
  ) {
    openApi.paths[path][method].requestBody = resolveRef(
      openApi,
      openApi.paths[path][method].requestBody['$ref']
    );
  }

  if (
    openApi.paths[path][method].requestBody &&
    openApi.paths[path][method].requestBody.content
  ) {
    [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
    ].forEach((type) => {
      const content = openApi.paths[path][method].requestBody.content[type];
      if (content && content.schema) {

        if (type === 'application/json' || type === 'application/x-www-form-urlencoded') {            
          const parameters = []

          //todo: handle allOf and others
          if(content.schema.oneOf) {
            //todo: handle multiple types of payloads in node templates
            content.schema = content.schema.oneOf[0]
          }

          if(content.schema["$ref"]) {
            content.schema = resolveRef(
              openApi,
              content.schema["$ref"]
            );
          }

          if(content.schema.properties) {
            for(let p in content.schema.properties) {
              const property = content.schema.properties[p]

              let sample
              try {
                sample = OpenAPISampler.sample(
                  property,
                  { skipReadOnly: true },
                  openApi
                );
                if(sample === undefined) {
                  sample = property.example || property.default
                }
              } catch (e) {
                console.error(e)
              }

              parameters.push({
                name: p,
                description: property.description,
                in: "body",
                required: !!(content.schema.required || []).find(r => r === p),
                schema: property,
                sample,
              })
            }
          } else if (content.schema.example) {
            for(let p in content.schema.example) {
              parameters.push({
                name: p,
                in: "body",
                required: !!(openApi.paths[path][method].requestBody.required === true || (content.schema.required || []).find(r => r === p)),
                schema: {
                  type: typeof content.schema.example[p]
                },
                sample: content.schema.example[p],
              })
            }
          }

          
          
          bodyParameters = bodyParameters.concat(Object.values(_parseParameters(openApi, parameters)))

          return // exit, take the first requestBody type

        } else if (type === 'multipart/form-data') {
          // how to handle?
        } else if (type == 'application/x-www-form-urlencoded') {
          // how to handle?
        }
      }
    });
  }
  return bodyParameters;
};

const getBodyParameters = (openApi, path, method) => {
  return _getBodyParameters(openApi, path, method).filter(p => !p.deprecated).map(i => {
    i.camelizedName = camelize(i.name).replace(".", "")

    return i
  })
}

const getInput = (openApi, path, method) => {
  const headers = getHeadersArray(openApi, path, method).map(header => ({ ...header, in: "header" }))
  const parameters = _getParameters(openApi, path, method) // `in` can be query or path
  const body = _getBodyParameters(openApi, path, method).map(header => ({ ...header, in: "body" }))

  return [headers, parameters, body].flat()
}

const getEnvVarParams = (config, types = []) => {
  let _p = []
  const envVars = get(config, "envVars", {})
  for(let envVar of Object.keys(envVars)) {
    const envVarValue = envVars[envVar]
    if(types.includes(envVarValue.in)) {
      _p.push({
        ...envVarValue,
        required: true,
        isEnvironmentVariable: true,
        envVarName: envVar,
        sample: `$trigger.env.${envVar}`
      })
    }
  }
  
  return _p
}

const getInputName = (input = {}) => {
  return input.envVarName || input.camelizedName || input.name
}

const sortAndMapRequired = (array = []) => {
  return array.sort((a = {}, b = {}) => { // sort required first
    if (a.required) {
      return -1;
    }
    if (b.required) {
      return 1;
    }

    return 0;
  })
  .map((i = {}) => {
    if(i.hardcoded) {
      return `"${i.name}": \`${i.sample || i.value}\``
    }

    if(i.value) {
      let value = i.value.split(" ").map(v => v.includes("REPLACE") ? `\${${getInputName(i)}}` : v).join(" ")

      if(i.required) {
        return `"${i.name}": \`${value}\``
      } else {
        return `...(${getInputName(i)} ? { "${i.name}": \`${value}\` } : {})`
      }
    }

    const nameFormat = i.name === getInputName(i) ? i.name : `"${i.name}": ${getInputName(i)}`
    if(i.required) {
      return nameFormat
    } else {
      return `...(${getInputName(i)} ? { ${nameFormat} } : {})`
    }
  })
}

const handleJSONSampleQuotes = (json) => {
  return json.replace(/\uFFFF/g, '\\"');
};



const requiredInputTemplate = (data) => `${data}, // Required`
const optionalInputTemplate = (data) => {
  // run prettier on code before commenting (prettier doesn't touch comments)
  let _data = prettier.format("let x = {" + data + "}", {
    "semi": false,
    "trailingComma": "none",
    "singleQuote": false,
    "printWidth": 100,
    "useTabs": false,
    "tabWidth": 2,
    parser: "babel"
  })
  _data = _data.substring("let x = {".length, _data.length - 2).trim() //remove added code (for prettier)
  return `${(_data).split("\n").map(i => `// ${i}`).join("\n")},` //handle multiline data
}

const mapWithTemplate = (array = [], template = () => {}) => {
  return array.map((p) => {
    
    const handleObjectQuotes = obj => {
      return obj.sample && typeof obj.sample === "object"
        ? handleJSONSampleQuotes(JSON.stringify(obj.sample))
        : obj.sample
    }

    if (typeof p.sample === "string" && !p.isEnvironmentVariable) {
      return template(`${getInputName(p)}: \`${p.sample.replace(/"/g, "")}\``);
    }

    return template(`${getInputName(p)}: ${handleObjectQuotes(p)}`);
  })
}

const cleanConfigEnvVars = (config, included = ["development", "production"]) => {
  let clonedConfig = cloneDeep(config)
  for(let envVar in clonedConfig.envVars) {
    clonedConfig.envVars[envVar] = pick(clonedConfig.envVars[envVar], included)
  }
  return clonedConfig
}

module.exports = {
  camelize,
  sentenceCase,
  getBaseUrl,
  getFullPath,
  getHeadersArray,
  getHeaders,
  getBodyParameters,
  _getParameters,
  getParameters,
  _getBodyParameters,
  getInput,
  getEnvVarParams,
  getInputName,
  sortAndMapRequired,
  handleJSONSampleQuotes,
  requiredInputTemplate,
  optionalInputTemplate,
  mapWithTemplate,
  cleanConfigEnvVars
}