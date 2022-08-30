const {
  getTemplateString,
} = require("../../utils");

const getGeneratorInput = () => ({
  baseURL: "{SPOTIFY_BASE_URI}", // can be hardcoded string (i.e https://my-api.com) and/or contain envVar replacement values (i.e https://{SOME_API_URL}/api)
  config: {
    platform: "spotify",
    type: "js-request-function",
    envVars: {
      BUILDABLE_SPOTIFY_BASE_URI: {
        development: "https://api.spotify.com/v1",
        production: "https://api.spotify.com/v1",
        in: "path"
      },
      BUILDABLE_SPOTIFY_CLIENT_ID: {
        development: "",
        production: "",
        in: "auth",
        name: "username"
      },
      BUILDABLE_SPOTIFY_CLIENT_SECRET: {
        development: "",
        production: "",
        in: "auth",
        name: "password"
      }
    },
    fee: 0,
    category: "media",
    accessType: "open",
    language: "javascript",
    price: "free",
    tags: ["music", "podcasts"],
    stateType: "stateless",
    __version: "1.0.0",
  },
  pathOrURL: "openapi.json",
  isURL: false,
  connections: [
    {
      id: "62d865290bd36f737a23f632",
      type: "integration"
    }
  ],
  getRunFile: ({
    title,
    description,
    docs,
    imports,
    input,
    url,
    method,
    axiosHeaders,
    axiosAuth,
    axiosParams,
    axiosData,
    verifyInput,
    verifyErrors,
    verifyChecks,
  }) => {
    return `
    const axios = require("axios");
    const qs = require("qs");
    
    const run = async (input) => {
      const { ${input} } = input;
    
      verifyInput(input);
    
      try {
        const { data: { access_token } } = await axios({
          method: "post",
          url: "https://accounts.spotify.com/api/token",
          headers: { 
            "Content-Type": "application/x-www-form-urlencoded" 
          },
          auth: {
            username: SPOTIFY_CLIENT_ID,
            password: SPOTIFY_CLIENT_SECRET
          },
          data: qs.stringify({ grant_type: "client_credentials" })
        });
        
        const { ${input.includes("data") ? "data: _data" : "data"} } = await axios({
          method: ${getTemplateString(method)},
          url: ${getTemplateString(url)},
          headers: {
            Authorization: \`Bearer \${access_token}\`
          },
          ${[
            axiosParams,
            axiosData].filter(i => !!i.trim()).join(",\n")}
        });
    
        return data;
      } catch (error) {
        return {
          failed: true,
          message: error.message,
          data: error.response.data,
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
    };`
    
  }
})

module.exports = {
  getGeneratorInput
}