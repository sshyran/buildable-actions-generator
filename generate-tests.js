const _ = require("lodash")

const fs = require("fs")

// const schema = JSON.parse(pm.collectionVariables.get('coll-schema'));
const schema = JSON.parse(fs.readFileSync("platforms/stripe/openapi.json"))

let schemaTests = [];
for (let prop in schema.paths) {
  const pathName = prop;
  let path = {
    path: schema.servers[0].url + pathName,
    parameters: schema.paths[prop].parameters,
  };

  for (let method in schema.paths[prop]) {
    if (method.toLowerCase() == 'parameters' || isMockEndpoint(schema.paths[prop][method])) {
      continue;
    }

    let currentPath = _.cloneDeep(path);
    currentPath.method = method.toUpperCase();
    let pathMethod = schema.paths[prop][method];
    currentPath.parameters = combineParameters(currentPath.parameters, pathMethod.parameters);
    // let securityExtension = pm.environment.get('env-securityExtensionName');
    let securityExtension = false
    if (securityExtension && pathMethod[securityExtension] && pathMethod[securityExtension].length > 0) {
      currentPath.allowedRole = pathMethod[securityExtension][0];
    }

    const expectedResponses = getExpectedResponses(pathMethod);
    currentPath.responses = expectedResponses;

    if (pathMethod.requestBody) {
      let bodyModel;
      if (pathMethod.requestBody.content['application/json']?.schema?.$ref) {
        bodyModel = getSchemaReference(schema, pathMethod.requestBody.content['application/json'].schema.$ref);
      }
      else if (pathMethod.requestBody.content['application/json']?.schema) {
        bodyModel = pathMethod.requestBody.content['application/json'].schema;
      }
      else {
        continue;
      }

      const models = buildModels(schema, bodyModel);
      const mutations = buildModelMutations(models);

      mutations.forEach((mutation) => {
        let schemaTest = _.cloneDeep(currentPath);
        Object.assign(schemaTest, mutation);
        schemaTest.name = `${schemaTest.method} - ${pathName} - ${schemaTest.description} - SUCCESS: ${schemaTest.success}`;
        schemaTests.push(schemaTest);
      });
    }
    else {
      currentPath.name = `${currentPath.method} - ${pathName} - No Request Body - SUCCESS: true`;
      currentPath.success = true;
      schemaTests.push(currentPath);
    }
  }
}
schemaTests = moveDeleteEndpointsToEnd(schemaTests);
require("fs").writeFileSync("schemaTests.json", JSON.stringify(schemaTests))
// pm.collectionVariables.set('coll-schemaTests', JSON.stringify(schemaTests));


// 
// Move delete endpoints to the end for cleanup
//
function moveDeleteEndpointsToEnd(schemaTests) {
  let sortedTests = [...schemaTests];
  try {
    let successfulDeletes = sortedTests.filter(schemaTest => schemaTest.method == 'DELETE' && schemaTest.success);

    if (successfulDeletes) {
      // order deletes from the deepest entity to highest level entity based on path
      successfulDeletes.sort((a, b) => b.path.split('/').length - a.path.split('/').length);
      sortedTests = sortedTests.filter(schemaTest => !successfulDeletes.find(sd => sd == schemaTest));
      sortedTests = sortedTests.concat(successfulDeletes);
    }
  }
  catch (err) {
    console.log('An error occurred when sorting delete tests', err);
  }

  return sortedTests;
}

//
// Supporting Methods Below
//
function buildModels(schema, object) {
  let models = [];

  if (object['$ref']) {
    object = getSchemaReference(schema, object['$ref']);
  }

  if (object.type && object.type.toLowerCase() == 'object') {
    if (object.required && object.required.length > 0) {
      models.push({});
      _.forEach(object.required, function (param) {
        const property = object.properties[param];

        if (property.type && ['string', 'number', 'integer', 'boolean'].includes(property.type.toLowerCase())) {
          for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
            let model = models[modelIndex];
            model[param] = property.example;
          }
        }
        else {
          const nestedObjects = buildModels(schema, property);
          models = addToModels(models, nestedObjects, param);
        }
      });
    }

    if (object.minProperties) {
      _.forEach(models, function (model) {
        if (Object.keys(model).length < object.minProperties) {
          for (let i = Object.keys(model).length; i < object.minProperties; i++) {
            for (const [key, value] of Object.entries(object.properties)) {
              if (['string', 'number', 'integer', 'boolean'].includes(value.type.toLowerCase()) && model[key] == undefined) {
                model[key] = value.example;
                break;
              }
            }
          }
        }
      })
    }
  }
  else if (object.type && object.type.toLowerCase() == 'array') {
    let items = buildModels(schema, object.items);
    if (Array.isArray(items)) {
      for (let i = 0; i < items.length; i++) {
        models.push([items[i]]);
      }
    }
    else {
      models.push([items]);
    }
  }
  else if (object.oneOf) {
    _.forEach(object.oneOf, function (component) {
      let items = buildModels(schema, component);
      models = models.concat(items);
    });
  }
  else if (object.allOf) {
    let pieces = [{}];
    _.forEach(object.allOf, function (component) {
      let componentModels = buildModels(schema, component);
      pieces = addToModels(pieces, componentModels);
    });

    models = pieces;
  }
  else if (object.anyOf) {
    let pieces = [];
    let combinedPieces = [{}];
    _.forEach(object.anyOf, function (component) {
      let componentModels = buildModels(schema, component);
      combinedPieces = addToModels(combinedPieces, componentModels);
      pieces = pieces.concat(componentModels);
    });

    models = pieces.concat(combinedPieces);
  }
  else {
    // All other options are primitive values
    return object.example;
  }
  return models;
}

function getSchemaReference(schema, referenceName) {
  const refPieces = referenceName.split('/');
  let reference = schema;
  for (let i = 1; i < refPieces.length; i++) {
    reference = reference[refPieces[i]];
  }

  return reference;
}

function addToModels(models, newPieces, name) {
  let newModels = [];
  _.forEach(models, function (model) {
    _.forEach(newPieces, function (newPiece) {
      let newModel = _.cloneDeep(model);
      if (name) {
        newModel[name] = newPiece;
      }
      else {
        Object.assign(newModel, newPiece);
      }
      newModels.push(newModel);
    });
  });

  return newModels;
}

function buildModelMutations(models) {
  let modelMutations = [];
  _.forEach(models, function (model) {
    addMutation(true, 'Has all required fields', model, modelMutations);
    let mutations = buildMutation(model);
    modelMutations = modelMutations.concat(mutations);
  });

  return modelMutations;
}

function buildMutation(model) {
  let mutations = [];

  for (const [key, value] of Object.entries(model)) {
    if (typeof value == 'object') {
      let nestedMutations = buildMutation(value);
      nestedMutations.forEach((nestedMutation) => {
        let mutation = _.cloneDeep(model);
        mutation[key] = nestedMutation.body;
        addMutation(false, `${nestedMutation.description} in ${key} object`, mutation, mutations);
      });

      let mutation = _.cloneDeep(model);
      delete mutation[key];
      addMutation(false, `Missing ${key} object`, mutation, mutations);

      let emptyMutation = _.cloneDeep(model);
      emptyMutation[key] = {};
      addMutation(false, `Empty ${key} object`, emptyMutation, mutations);
    }
    else {
      if (Array.isArray(value)) {
        console.log('probably an error');
      }
      let mutation = _.cloneDeep(model);
      delete mutation[key];
      addMutation(false, `Missing ${key} property`, mutation, mutations);

      let blankMutation = _.cloneDeep(model);
      blankMutation[key] = '';
      addMutation(false, `Blank ${key} property`, blankMutation, mutations);
    }
  }

  return mutations;
}

function addMutation(isSuccess, description, mutation, mutations) {
  mutations.push({
    success: isSuccess,
    description: description,
    body: mutation
  });
}

function getExpectedResponses(pathMethod) {
  const responses = [];
  for (const [statusCode, value] of Object.entries(pathMethod.responses)) {
    let response = {
      statusCode: Number(statusCode)
    };

    if (value['x-postman-variables'] && Array.isArray(value['x-postman-variables'])) {
      response.variables = value['x-postman-variables'].filter(variable => variable.type.toLowerCase() === 'save');
    }

    if (value.$ref) {
      response.$ref = value.$ref;
    }
    else {
      if (value.content?.['application/json']?.schema) {
        if (value.content['application/json'].schema.$ref) {
          response.$ref = value.content['application/json'].schema.$ref;
        }
        else {
          response.schema = value.content['application/json'].schema;
        }
      }
    }

    responses.push(response);
  }
  return responses;
}

function isMockEndpoint(pathMethod) {
  let isMock = false;
  if (pathMethod && pathMethod['x-amazon-apigateway-integration'] && pathMethod['x-amazon-apigateway-integration'].type
    && pathMethod['x-amazon-apigateway-integration'].type.toLowerCase() == 'mock') {
    isMock = true;
  }

  return isMock;
}

function combineParameters(endpointParameters, methodParameters) {
  if (!endpointParameters && !methodParameters) {
    return;
  }
  let parameters = [];
  if (endpointParameters && endpointParameters.length) {
    parameters = [...endpointParameters];
  }

  if (methodParameters && methodParameters.length) {
    parameters = [...parameters, ...methodParameters];
  }

  return parameters;
}


// "let schemaTests = pm.collectionVariables.get('coll-schemaTests');
// "if(schemaTests){
// "    schemaTests = JSON.parse(schemaTests);
// "    if(!schemaTests || !schemaTests.length){
// "        postman.setNextRequest('More APIs to Process?');
// "    }
// "}"

const url = require('url');

// const schema = JSON.parse(pm.collectionVariables.get('coll-schema'));
// let schemaTests = JSON.parse(pm.collectionVariables.get('coll-schemaTests'));

let requests = []

while(schemaTests.length > 0) {
  let request = {
    headers: [],
    query: []
  }
  const schemaTest = schemaTests.shift();
  // pm.collectionVariables.set('coll-schemaTests', JSON.stringify(schemaTests));
  // pm.variables.set('currentSchemaTest', JSON.stringify(schemaTest));
  
  const path = replacePathParameters(schema, schemaTest.path, schemaTest.parameters);
  request.path = path
  request.requestName = schemaTest.name
  request.body = JSON.stringify(schemaTest.body)
  
  // if (pm.request.url.protocol) {
  //   pm.request.url.protocol = pm.request.url.protocol.replace(/\\:$/, '');
  // } else {
  //   pm.request.url.protocol = 'https';
  // }
  // pm.request.method = schemaTest.method;
  // pm.request.name = schemaTest.name;
  
  // pm.variables.set('requestName', schemaTest.name);
  // pm.variables.set('body', JSON.stringify(schemaTest.body));
  
  // Add top level parameters from the path
  // const roleHeaderName = pm.environment.get('env-roleHeaderName');
  
  if (schemaTest.parameters) {
    for (let i = 0; i < schemaTest.parameters.length; i++) {
      let param = schemaTest.parameters[i];
  
      if (param.$ref) {
        let pieces = param.$ref.split('/');
        const name = pieces[pieces.length - 1];
        const schemaParam = schema.components.parameters[name];
        const paramType = schemaParam.in.toLowerCase();
        const paramValue = loadParameterValue(schemaParam);
        if (paramType == 'header' && schemaParam.required == true) {
          if (roleHeaderName && schemaParam.name.toLowerCase() == roleHeaderName.toLowerCase()) {
            request.headers.push({ key: schemaParam.name, value: schemaTest.allowedRole });
          }
          else {
            request.headers.push({ key: schemaParam.name, value: paramValue });
          }
        } else if (paramType == 'query' && schemaParam.required == true) {
          request.query.push({ key: schemaParam.name, value: paramValue });
        }
      } else {
        const paramType = param.in.toLowerCase();
        const paramValue = loadParameterValue(param);
        if (paramType == 'header') {
          request.headers.push({ key: param.name, value: paramValue });
        } else if (paramType == 'query' && param.required == true) {
          request.query.push({ key: param.name, value: paramValue });
        }
      }
    }
  }
  
  function loadParameterValue(parameter) {
    let parameterValue;
    if (parameter['x-postman-variables']) {
      let variable = parameter['x-postman-variables'].find(v => v.type.toLowerCase() === 'load');
      if (variable && pm.collectionVariables.has(variable.name)) {
        parameterValue = pm.collectionVariables.get(variable.name);
      }
      else {
        parameterValue = resolveParameterExample(parameter);
      }
    }
    else {
      parameterValue = resolveParameterExample(parameter);
    }
  
    return parameterValue;
  }
  
  function resolveParameterExample(parameter) {
    let paramValue = (parameter.schema.example != undefined) ? parameter.schema.example : parameter.example;
    if(!paramValue) {
      return
    }
    let value = paramValue;
    if (typeof paramValue !== 'number' && typeof paramValue !== 'boolean') {
      let pathVariableRegex = /^{{\\$.*}}$/;
      let matches = paramValue.match(pathVariableRegex);
  
      if (matches && matches.length) {
        // value = pm.variables.replaceIn(paramValue);
        console.log(matches)
      }
    }
  
    return encodeURIComponent(value);
  }
  
  function replacePathParameters(schema, pathName, parameters) {
    let replacedPathName = pathName;
    let pathVariableRegex = /{([^}]*)}/g;
    let matches = pathName.match(pathVariableRegex);
    _.forEach(matches, function (match) {
      let paramName = match.substring(1, match.length - 1);
      _.forEach(parameters, function (param) {
        if (param.$ref) {
          let parameter = getSchemaReference(schema, param.$ref);
          if (parameter.in && parameter.in.toLowerCase() == 'path' && parameter.name && parameter.name == paramName) {
            let parameterValue = loadParameterValue(parameter);
            replacedPathName = replacedPathName.replace(match, parameterValue);
            return false;
          }
        } else {
          if (param.in && param.in.toLowerCase() == 'path' && param.name && param.name == paramName) {
            let parameterValue = loadParameterValue(param);
            replacedPathName = replacedPathName.replace(match, parameterValue);
            return false;
          }
        }
      });
    });
  
    return url.parse(replacedPathName);
  }
  
  function getSchemaReference(schema, referenceName) {
    const refPieces = referenceName.split('/');
    let reference = schema;
    for (let i = 1; i < refPieces.length; i++) {
      reference = reference[refPieces[i]];
    }
  
    return reference;
  }
  
  requests.push(request)
}

  
fs.writeFileSync("requests.json", JSON.stringify(requests))