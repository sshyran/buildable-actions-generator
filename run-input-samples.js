const tatum = {
  baseURL: "{TATUM_API_URL}", // can be hardcoded string (i.e https://my-api.com) and/or contain envVar replacement values (i.e https://{SOME_API_URL}/api)
  config: {
    envVars: {
      BUILDABLE_TATUM_API_URL: {
        development: "https://api-us-west1.tatum.io",
        production: "https://api-us-west1.tatum.io",
        in: "path"
      },
      BUILDABLE_TATUM_API_KEY: {
        development: "",
        production: "",
        in: "header",
        headerName: "x-api-key"
      },
    },
    type: "js-request-function",
    fee: 0,
    category: "web3",
    accessType: "open",
    language: "javascript",
    price: "free",
    platform: "tatum",
    tags: ["blockchain", "crypto", "nft"],
    stateType: "stateless",
    __version: "1.0.0",
    connections: [
      { 
        id: "62d868570bd36f737a23f634",
        type: "integration"
      }
    ]
  },
  pathOrURL: "./openapi-specs/tatum-openapi.json",
  isURL: false,
  getDocs: (openApi, path, method) => {
    return `https://tatum.io/apidoc.php#operation/${openApi.paths[path][method].operationId}`
  },
}

const twitter = {
  // baseURL: "{TATUM_API_URL}", // can be hardcoded string (i.e https://my-api.com) and/or contain envVar replacement values (i.e https://{SOME_API_URL}/api)
  config: {
    type: "js-request-function",
    envVars: {
      BUILDABLE_TWITTER_BEARER_TOKEN: {
        development: "",
        production: "",
        in: "header",
        headerName: "authorization"
      },
    },
    fee: 0,
    category: "social",
    accessType: "open",
    language: "javascript",
    price: "free",
    platform: "twitter",
    tags: ["news", "tweet"],
    stateType: "stateless",
    __version: "1.0.0",
    connections: [
      {
        id: "62d86a790bd36f737a23f636",
        type: "integration"
      }
    ],
  },
  pathOrURL: "https://api.twitter.com/2/openapi.json",
  isURL: true,
  getDocs: (openApi, path, method) => {
    return `https://developer.twitter.com/en/docs/api-reference-index#twitter-api-v2`
  },
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
    const axios = require("axios");${axiosParams.length > 0 ? `\nconst qs = require("qs");` : ""}

    const run = async (input) => {
      const { ${input} } = input;
    
      verifyInput(input);
    
      try {
        const { ${input.includes("data") ? "data: _data" : "data"} } = await axios({
          method: ${getTemplateString(method)},
          url: ${getTemplateString(url)},
          ${[
            axiosHeaders, 
            axiosAuth, 
            axiosParams, 
            axiosParams.length > 0 ? `paramsSerializer: (params) => { return qs.stringify(params, { arrayFormat: "comma" }); }` : "", 
            axiosData].filter(i => !!i.trim()).join(",\n")}
        });
    
        return ${input.includes("data") ? "_data" : "data"};
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
    
  },
}

const github = {
  baseURL: "https://api.github.com", // can be hardcoded string (i.e https://my-api.com) and/or contain envVar replacement values (i.e https://{SOME_API_URL}/api)
  config: {
    platform: "github",
    type: "js-request-function",
    envVars: {
      BUILDABLE_GITHUB_ACCESS_TOKEN: {
        development: "",
        production: "",
        in: "auth",
        name: "password"
      },
      BUILDABLE_GITHUB_ACCOUNT_USERNAME: {
        development: "",
        production: "",
        in: "auth",
        name: "username"
      },
    },
    fee: 0,
    category: "git",
    accessType: "open",
    language: "javascript",
    price: "free",
    tags: ["git", "code"],
    stateType: "stateless",
    __version: "1.0.0",
    connections: [
      {
        id: "62dace890bd36f737a23f655",
        type: "integration"
      }
    ]
  },
  pathOrURL: "./openapi-specs/openapi-github.json",
  isURL: false,
}

const twilio = {
  // baseURL: "https://api.github.com", // can be hardcoded string (i.e https://my-api.com) and/or contain envVar replacement values (i.e https://{SOME_API_URL}/api)
  config: {
    platform: "twilio",
    envVars: {
      BUILDABLE_TWILIO_ACCOUNT_SID: {
        development: "",
        production: "",
        in: "auth",
        name: "username"
      },
      BUILDABLE_TWILIO_AUTH_TOKEN: {
        development: "",
        production: "",
        in: "auth",
        name: "password"
      },
    },
    fee: 0,
    category: "communication",
    accessType: "open",
    language: "javascript",
    price: "free",
    tags: ["marketing", "messages", "text"],
    stateType: "stateless",
    __version: "1.0.0",
    type: "js-request-function",
    connections: [
      {
        id: "62d8691d0bd36f737a23f635",
        type: "integration"
      }
    ],
  },
  pathOrURL: "./openapi-specs/twilio-openapi.json",
  isURL: false,
  getParams: (openApi, path, method) => {
    return getParameters(openApi, path, method).filter(p => p.name !== "AccountSid")
  },
  getDocs: () => {
    return `https://www.twilio.com/docs`
  },
  getTitle: (openApi, path, method) => {
    return titleCase(kebabCase(openApi.paths[path][method].operationId).replace(/-/g, " "))
  },
  getDescription: (openApi, path, method) => {
    return sentenceCase(openApi.paths[path][method].description)
  },
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
  }) => `  
  ${imports || axiosParams.length > 0 ? `const axios = require("axios");\nconst qs = require("qs");` : `const axios = require("axios");`}

  const run = async (input) => {
    const { ${input} } = input;
  
    verifyInput(input);
  
    try {
      const { ${input.includes("data") ? "data: _data" : "data"} } = await axios({
        method: ${getTemplateString(method)},
        url: ${getTemplateString(url.replace(/\{AccountSid}/g, "${BUILDABLE_TWILIO_ACCOUNT_SID}"))},
        ${[
          axiosHeaders, 
          axiosAuth, 
          axiosParams, 
          axiosParams.length > 0 ? `paramsSerializer: (params) => { return qs.stringify(params, { arrayFormat: "comma" }); }` : "", 
          axiosData].filter(i => !!i.trim()).join(",\n")}
      });
  
      return ${input.includes("data") ? "_data" : "data"};
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
  };
  `,
}

const notion = {
  baseURL: "https://api.notion.com", // can be hardcoded string (i.e https://my-api.com) and/or contain envVar replacement values (i.e https://{SOME_API_URL}/api)
  config: {
    platform: "notion",
    type: "js-request-function",
    envVars: {
      BUILDABLE_NOTION_API_TOKEN: {
        development: "",
        production: "",
        in: "header",
        // name: "password",
        headerName: "authorization"
      }
    },
    fee: 0,
    category: "cms",
    accessType: "open",
    language: "javascript",
    price: "free",
    tags: ["notes", "database", "website"],
    stateType: "stateless",
    __version: "1.0.0",
    connections: [
      {
        id: "62d8577d0bd36f737a23f62c",
        type: "integration"
      }
    ]
  },
  pathOrURL: "./openapi-specs/notion.json",
  isURL: false,
  getDocs: (openApi, path, method) => {
    const title = openApi["paths"][path][method].summary;

    const docLinks = {
      "Query a database": "https://developers.notion.com/reference/post-database-query",
      "Create a database": "https://developers.notion.com/reference/create-a-database",
      "Update database": "https://developers.notion.com/reference/update-a-database",
      "Retrieve a database": "https://developers.notion.com/reference/retrieve-a-database",
      
      "Retrieve a page": "https://developers.notion.com/reference/retrieve-a-page",
      "Create a Page with Content": "https://developers.notion.com/reference/post-page",
      "Update Page Properties": "https://developers.notion.com/reference/patch-page",
      "Retrieve a Page Property Item": "https://developers.notion.com/reference/retrieve-a-page-property",
      
      "Retrieve a block": "https://developers.notion.com/reference/retrieve-a-block",
      "Update a block": "https://developers.notion.com/reference/update-a-block",
      "Retrieve block children": "https://developers.notion.com/reference/get-block-children",
      "Append block children": "https://developers.notion.com/reference/patch-block-children",
      "Delete a block": "https://developers.notion.com/reference/delete-a-block",

      "Retrieve a user": "https://developers.notion.com/reference/get-user",
      "List all users": "https://developers.notion.com/reference/get-users",
      "Retrieve your token's bot user": "https://developers.notion.com/reference/get-self",

      "Search": "https://developers.notion.com/reference/post-search"
    };

    return docLinks[title] || "https://developers.notion.com/reference/intro";
  },
}

const spotify = {
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
}

const stripe = {
  baseURL: `https://api.stripe.com`,
  config: {
    platform: "stripe",
    type: "js-request-function",
    envVars: {
      BUILDABLE_STRIPE_API_KEY: {
        development: "",
        production: "",
        in: "header",
        // name: "password",
        headerName: "authorization"
      }
    },
    fee: 0,
    category: "payments",
    accessType: "open",
    language: "javascript",
    price: "free",
    tags: ["payments", "accounts"],
    stateType: "stateless",
    __version: "1.0.0",
    connections: [
      {
        id: "627aceaf971c67182d1d76ca",
        type: "integration"
      }
    ]
  },
  pathOrURL: "./openapi-specs/stripe.json",
  isURL: false,
  getTitle: (openApi, path, method) => {
    return titleCase(kebabCase(openApi.paths[path][method].operationId).replace(/-/g, " "))
  },
  getDescription: (openApi, path, method) => {
    return sentenceCase(openApi.paths[path][method].description.replace( /(<([^>]+)>)/ig, ''))
      .replace(/[\n\r]/g, '')
      .split(".")[0] + ' using the Stripe API.' // Shorten description
  },
}

const slack = {
  baseURL: `https://slack.com/api`,
  config: {
    platform: "slack",
    type: "js-request-function",
    envVars: {
      BUILDABLE_SLACK_ACCESS_TOKEN: {
        development: "",
        production: "",
        in: "header",
        // name: "password",
        headerName: "authorization"
      }
    },
    fee: 0,
    category: "communication",
    accessType: "open",
    language: "javascript",
    price: "free",
    tags: ["business", "messaging", "chat"],
    stateType: "stateless",
    __version: "1.0.0",
    connections: [
      {
        id: "62d863cd0bd36f737a23f631",
        type: "integration"
      }
    ]
  },
  pathOrURL: "./openapi-specs/slack.json",
  isURL: false,
}

const circleci = {
  baseURL: `https://circleci.com/api/v2`,
  config: {
    platform: "circleci",
    type: "js-request-function",
    envVars: {
      BUILDABLE_CIRCLECI_PERSONAL_API_KEY: {
        development: "",
        production: "",
        in: "auth",
        name: "username"
      }
    },
    fee: 0,
    category: "devops",
    accessType: "open",
    language: "javascript",
    price: "free",
    tags: ["ci", "cicd"],
    stateType: "stateless",
    __version: "1.0.0",
    connections: [
      {
        id: "62f403ceaf5b59234588c878",
        type: "integration"
      }
    ]
  },
  pathOrURL: "./openapi-specs/circleci.json",
  isURL: false,
};

const pagerduty = {
  baseURL: `https://api.pagerduty.com`,
  config: {
    platform: "pagerduty",
    type: "js-request-function",
    envVars: {
      BUILDABLE_PAGERDUTY_API_KEY: {
        development: "",
        production: "",
        in: "header",
        // name: "password",
        headerName: "authorization",
        value: "Token token= ${BUILDABLE_PAGERDUTY_API_KEY}"
      }
    },
    fee: 0,
    category: "alerts",
    accessType: "open",
    language: "javascript",
    price: "free",
    tags: ["alerts"],
    stateType: "stateless",
    __version: "1.0.0",
    connections: [
      {
        id: "627aceaf971c67182d1d76ca",
        type: "integration"
      }
    ]
  },
  pathOrURL: "./openapi-specs/pagerduty-openapi.json",
  isURL: false,
}
