const OpenAPISampler = require('openapi-sampler');
const get = require("lodash/get")
const cloneDeep = require("lodash/cloneDeep")
const pick = require("lodash/pick")
const prettier = require("prettier")
import JsonPointer from 'json-pointer';

const sampleOverrides = require("../sampler-override")
OpenAPISampler._registerSampler("string", sampleOverrides.sampleString)

function santizeReservedKeywords(str) {
  const reserved = [
    //https://github.com/OpenAPITools/openapi-generator/blob/master/modules/openapi-generator/src/main/java/org/openapitools/codegen/languages/AbstractTypeScriptClientCodegen.java#L284
    "abstract", "await", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue", "debugger", "default", "delete", "do", "double", "else", "enum", "export", "extends", "false", "final", "finally", "float", "for", "function", "goto", "if", "implements", "import", "in", "instanceof", "int", "interface", "let", "long", "native", "new", "null", "package", "private", "protected", "public", "return", "short", "static", "super", "switch", "synchronized", "this", "throw", "transient", "true", "try", "typeof", "var", "void", "volatile", "while", "with", "yield",

    "string",
    "String",
    "boolean",
    "Boolean",
    "Double",
    "Integer",
    "Long",
    "Float",
    "Object",
    "Array",
    "ReadonlyArray",
    "Date",
    "number",
    "any",
    "File",
    "Error",
    "Map",
    "object",
    "Set"
  ]

  if(reserved.includes(str)) {
    return `_${str}`
  }

  return str
}

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

const capitalCase = (str) => {
  return str.charAt(0).toUpperCase() + str.substring(1, str.length).toLowerCase()
}

const schemaKeywordTypes = {
  multipleOf: 'number',
  maximum: 'number',
  exclusiveMaximum: 'number',
  minimum: 'number',
  exclusiveMinimum: 'number',

  maxLength: 'string',
  minLength: 'string',
  pattern: 'string',

  items: 'array',
  maxItems: 'array',
  minItems: 'array',
  uniqueItems: 'array',
  additionalItems: 'array',

  maxProperties: 'object',
  minProperties: 'object',
  required: 'object',
  additionalProperties: 'object',
  properties: 'object',
  patternProperties: 'object',
  dependencies: 'object'
};

function inferType(schema) {
  if (schema.type !== undefined) {
    return Array.isArray(schema.type) ? schema.type.length === 0 ? null : schema.type[0] : schema.type;
  }
  const keywords = Object.keys(schemaKeywordTypes);
  for (var i = 0; i < keywords.length; i++) {
    let keyword = keywords[i];
    let type = schemaKeywordTypes[keyword];
    if (schema[keyword] !== undefined) {
      return type;
    }
  }

  return null;
}

function getResultForCircular(type) {
  return {
    value: type === 'object' ?
        {}
      : type === 'array' ? [] : undefined
  };
}

function mergeDeep(...objects) {
  const isObject = obj => obj && typeof obj === 'object';

  return objects.reduce((prev, obj) => {
    Object.keys(obj).forEach(key => {
      const pVal = prev[key];
      const oVal = obj[key];

      if (isObject(pVal) && isObject(oVal)) {
        prev[key] = mergeDeep(pVal, oVal);
      } else {
        prev[key] = oVal;
      }
    });

    return prev;
  }, Array.isArray(objects[objects.length - 1]) ? [] : {});
}


//original: openapi-sampler traverse.js
const traverse = (schema, options, spec, context) => {

  if (schema.$ref) {
    if (!spec) {
      throw new Error('Your schema contains $ref. You must provide full specification in the third parameter.');
    }
    let ref = decodeURIComponent(schema.$ref);
    if (ref.startsWith('#')) {
      ref = ref.substring(1);
    }

    const referenced = JsonPointer.get(spec, ref);
    let result;

    if ($refCache[ref] !== true) {
      $refCache[ref] = true;
      result = traverse(referenced, options, spec, context);
      $refCache[ref] = false;
    } else {
      const referencedType = inferType(referenced);
      result = getResultForCircular(referencedType);
    }
    // popSchemaStack(seenSchemasStack, context);
    return result;
  }

  if (schema.example !== undefined) {
    // popSchemaStack(seenSchemasStack, context);
    return {
      value: schema.example,
      readOnly: schema.readOnly,
      writeOnly: schema.writeOnly,
      type: schema.type,
    };
  }

  if (schema.allOf !== undefined) {
    // popSchemaStack(seenSchemasStack, context);
    return tryInferExample(schema) || allOfSample(
      { ...schema, allOf: undefined },
      schema.allOf,
      options,
      spec,
      context,
    );
  }

  if (schema.oneOf && schema.oneOf.length) {
    if (schema.anyOf) {
      if (!options.quiet) console.warn('oneOf and anyOf are not supported on the same level. Skipping anyOf');
    }
    // popSchemaStack(seenSchemasStack, context);

    // Make sure to pass down readOnly and writeOnly annotations from the parent
    const firstOneOf = Object.assign({
      readOnly: schema.readOnly,
      writeOnly: schema.writeOnly
    }, schema.oneOf[0]);

    return (
      tryInferExample(schema) || traverse(firstOneOf, options, spec, context)
    );
  }

  if (schema.anyOf && schema.anyOf.length) {
    // popSchemaStack(seenSchemasStack, context);
    return tryInferExample(schema) || traverse(schema.anyOf[0], options, spec, context);
  }

  if (schema.if && schema.then) {
    // popSchemaStack(seenSchemasStack, context);
    return tryInferExample(schema) || traverse(mergeDeep(schema.if, schema.then), options, spec, context);
  }

  let example = inferExample(schema);
  let type = null;
  if (example === undefined) {
    example = null;
    type = schema.type;
    if (Array.isArray(type) && schema.type.length > 0) {
      type = schema.type[0];
    }
    if (!type) {
      type = inferType(schema);
    }
    let sampler = _samplers[type];
    if (sampler) {
      example = sampler(schema, options, spec, context);
    }
  }

  popSchemaStack(seenSchemasStack, context);
  return {
    value: example,
    readOnly: schema.readOnly,
    writeOnly: schema.writeOnly,
    type: type
  };
}

/**
* Returns the value referenced in the given reference string
*
* @param  {object} openApi  OpenAPI document
* @param  {string} ref      A reference string
* @return {any}
*/
const resolveRef = function (openApi, ref) {
  const parts = ref.split('/').map(part => part.replace(/application~1json/g, "application/json"));

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

    let splitHeaderName = header.name.split("-")
    splitHeaderName = splitHeaderName.map(i => capitalCase(i))
    if(splitHeaderName[0] === "x" || splitHeaderName[0] === "X") {
      header.camelizedName = santizeReservedKeywords(camelize(splitHeaderName.slice(1).join("-")).replace(/-/g, ""))
    } else {
      header.camelizedName = santizeReservedKeywords(camelize(header.name).replace(/-/g, ""))
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
    i.camelizedName = santizeReservedKeywords(camelize(i.name).replace(".", ""))

    return i
  })
}

const getParams = ({ openapi, path, method }) => {
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
      
      params[param.name] = param;
    }
  
    return params;
  };

  // Set the optional parameter if it's not provided
  if (typeof values === 'undefined') {
    values = {};
  }

  let pathParams = {};
  let methodParams = {};

  // First get any parameters from the path
  if (typeof openapi.paths[path].parameters !== 'undefined') {
    pathParams = _parseParameters(
      openapi,
      openapi.paths[path].parameters,
      values
    );
  }

  if (typeof openapi.paths[path][method].parameters !== 'undefined') {
    methodParams = _parseParameters(
      openapi,
      openapi.paths[path][method].parameters,
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
}

const getBody = ({ openapi, path, method }) => {
  if (
    openapi.paths[path][method].requestBody &&
    openapi.paths[path][method].requestBody['$ref']
  ) {
    openapi.paths[path][method].requestBody = resolveRef(
      openapi,
      openapi.paths[path][method].requestBody['$ref']
    );
  }

  if (
    openapi.paths[path][method].requestBody &&
    openapi.paths[path][method].requestBody.content
  ) {
    const mediaType = Object.keys(openapi.paths[path][method].requestBody.content).find(mediaType => supportedMediaTypes.includes(mediaType))
    const content = openapi.paths[path][method].requestBody.content[mediaType];
    if (content && content.schema) {
      if(content.schema.oneOf) {
        content.schema = content.schema.oneOf[0]
      } else if(content.schema.anyOf) {
        content.schema = content.schema.anyOf[0]
      } else if (content.schema.allOf) {
        //inspiration from openapi-sampler allOf.js
        const { allOf, ...rest } = content.schema
        const res = rest

        const children = []
        for(let schema of content.schema.allOf) {
          if(schema["$ref"]) {
            schema = resolveRef(
              openapi,
              schema["$ref"]
            );
          }

          if (res.type && schema.type && schema.type !== res.type) {
            console.warn('allOf: schemas with different types can\'t be merged');
            res.type = schema.type;
          }

          children.push(schema)
        }

        if (res.type === 'object') {
          content.schema = mergeDeep(res, ...children.filter(child => child.type === 'object'));
        } else {
          if (res.type === 'array') {
            // TODO: implement arrays
            if (!options.quiet) console.warn('Found allOf with "array" type. Result may be incorrect');
          }
          content.schema = { ...res, ...children[children.length - 1] };
        }
      }

      if(content.schema["$ref"]) {
        content.schema = resolveRef(
          openapi,
          content.schema["$ref"]
        );
      }

      return {
        content,
        mediaType
      }
    }
  }

  return result
}

const getHeadrs = function ({ openApi, path, method }) {
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

const getSample = ({ openapi, schema }) => {
  let sample
  try {
    sample = OpenAPISampler.sample(
      schema,
      { skipReadOnly: true },
      openapi
    );
  } catch (err) {
    console.log(err);
  }
  return sample
}

const supportedMediaTypes = [
  'application/json',
  'application/x-www-form-urlencoded',
]

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

    //order of supportedMediaTypes matters here, we prefer application/json usually
    const content = supportedMediaTypes.find(type => !!openApi.paths[path][method].requestBody.content[type])

    if (content && content.schema) {
      const parameters = []

      if(content.schema.oneOf) {
        content.schema = content.schema.oneOf[0]
      } else if(content.schema.anyOf) {
        content.schema = content.schema.anyOf[0]
      } else if (content.schema.allOf) {
        //inspiration from openapi-sampler allOf.js
        const { allOf, ...rest } = content.schema
        const res = rest

        const children = []
        for(let schema of content.schema.allOf) {
          if(schema["$ref"]) {
            schema = resolveRef(
              openApi,
              schema["$ref"]
            );
          }

          if (res.type && schema.type && schema.type !== res.type) {
            console.warn('allOf: schemas with different types can\'t be merged');
            res.type = schema.type;
          }

          children.push(schema)
        }

        if (res.type === 'object') {
          content.schema = mergeDeep(res, ...children.filter(child => child.type === 'object'));
        } else {
          if (res.type === 'array') {
            // TODO: implement arrays
            if (!options.quiet) console.warn('Found allOf with "array" type. Result may be incorrect');
          }
          content.schema = { ...res, ...children[children.length - 1] };
        }
      }

      if(content.schema["$ref"]) {
        content.schema = resolveRef(
          openApi,
          content.schema["$ref"]
        );
      }

      if(content.schema.properties) { // object
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
      } else if(content.schema.items) { //body is a JSON array
        let sample
        try {
          sample = OpenAPISampler.sample(
            content.schema.items,
            { skipReadOnly: true },
            openApi
          );
          if(sample === undefined) {
            sample = content.schema.example || content.schema.default
          }
        } catch (e) {
          console.error(e)
        }

        return {
          isArrayBody: true,
          in: "body",
          required: !!(openApi.paths[path][method].requestBody.required === true || (content.schema.required || []).find(r => r === p)),
          schema: content.schema,
          sample,
        }
      }

      
      
      bodyParameters = bodyParameters.concat(Object.values(_parseParameters(openApi, parameters)))

      return // exit, take the first requestBody type

    
    }
  
  }
  return bodyParameters;
};

const getBodyParameters = (openApi, path, method) => {
  return _getBodyParameters(openApi, path, method).filter(p => !p.deprecated).map(i => {
    i.camelizedName = santizeReservedKeywords(camelize(i.name).replace(".", ""))

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
        sample: `$env.${envVar}`
      })
    }
  }
  
  return _p
}

const getInputName = (input = {}) => {
  return input.envVarName || input.camelizedName || input.name
}

const requiredSort = (a = {}, b = {}) => {
  if(a.required && b.required) {
    return 0
  }

  if(a.required) {
    return -1
  }

  if(b.required) {
    return 1
  }

  return 0
}

const getTemplateObjectAttribute = (i = {}) => {
  if(i.hardcoded) {
    return `"${i.name}": ${getTemplateString(i.sample || i.value)}`
  }

  if(i.value) {
    let splitValue = i.value.split(" ")
    let value = splitValue.map(v => {
      
      if(v.includes("REPLACE")) {
        v = getInputName(i)
        if(splitValue.length > 1) {
          v = `\${${v}}`
        }
      }
      
      return v

    }).join(" ")

    if(splitValue.length > 1) {
      value = getTemplateString(value)
    }

    if(i.required) {
      return `"${i.name}": ${value}`
    } else {
      return `...(${getInputName(i)} ? { "${i.name}": ${value} } : {})`
    }
  }

  const nameFormat = i.name === getInputName(i) ? i.name : `"${i.name}": ${getInputName(i)}`
  if(i.required) {
    return nameFormat
  } else {
    return `...(${getInputName(i)} ? { ${nameFormat} } : {})`
  }
}



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
        ? JSON.stringify(obj.sample)
        : obj.sample
    }

    if (typeof p.sample === "string" && !p.isEnvironmentVariable) {
      return template(`${getInputName(p)}: ${getTemplateString(p.sample.replace(/"/g, ""))}`);
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

const getTemplateString = (value) => {
  if(typeof value === "string") {
    if(value.includes("\n") || value.includes("${")) {
      return `\`${value}\``
    }

    return `"${value}"`
  }

  return value
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
}