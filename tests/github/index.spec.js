const { initActionProvider } = require("../../utils/action-provider")
const platform = __dirname.split("/").pop()
jest.setTimeout(30000)

describe(`Testing ${platform}`, () => {
  let provider
  let openapi
  beforeAll(async () => {

    const { provider: _provider, openapi: _openapi } = await initActionProvider({ platform })

    provider = _provider
    openapi = _openapi
  })

  it("successfully creates a pr", async () => {
    const result = await provider.call({
      path: "/repos/{owner}/{repo}/pulls",
      method: "post",
      input: {
        owner: process.env.TEST_GITHUB_OWNER,
        repo: process.env.TEST_GITHUB_REPO,
        head: process.env.TEST_GITHUB_HEAD,
        base: process.env.TEST_GITHUB_BASE,
      }
    })

    console.log(result)

    // for(const key in Object.keys(result)) {
    //   openapi[path][method]
    // }
  })
})

