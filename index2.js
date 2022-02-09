const fs = require("fs")
const { getBaseUrl, getFullPath, getHeadersArray, _getParameters, _getBodyParameters } = require("./parse-openapi")
const openApi = JSON.parse(fs.readFileSync("../play/openapi-github.json"))

const run = async () => {
  for (let path in openApi.paths) {
    for (let method in openApi.paths[path]) {

      const url = getBaseUrl(openApi, path, method) + getFullPath(openApi, path, method);

      const headers = getHeadersArray(openApi, path, method)
      headers.push({
        name: 'accept',
        description: 'This API is under preview and subject to change.',
        in: 'header',
        schema: {
          type: 'string',
          default: 'application/vnd.github.v3+json'
        },
        required: true
      })

      const params = _getParameters(openApi, path, method, {})

      const bodyParams = _getBodyParameters(openApi, path, method)
      
      console.log(bodyParams)
      
    }
  }

}

run()