const uuid = require("uuid")
const { setupTests } = require("../../utils/helpers")
const platform = __dirname.split("/").pop()
jest.setTimeout(30000)

describe(`Testing ${platform}`, () => {
  let provider

  const seed = {}

  beforeAll(async () => {
    const { provider: _provider } = await setupTests(platform)

    provider = _provider


    const repo = await provider.call({
      path: "/user/repos",
      method: "post",
      input: {
        owner: process.env.TEST_GITHUB_OWNER,
        name: `test-${uuid.v4()}`
      }
    })

    seed.repo = repo

    const file = await provider.call({
      path: "/repos/{owner}/{repo}/contents/{path}",
      method: "put",
      input: {
        owner: process.env.TEST_GITHUB_OWNER,
        repo: seed.repo.name,
        message: "File creation from tests",
        content: Buffer.from("new file contents", 'utf-8').toString("base64"),
        path: "hello.txt"
      }
    })

    seed.file = file

    const head = await provider.call({
      path: "/repos/{owner}/{repo}/git/refs",
      method: "post",
      input: {
        owner: process.env.TEST_GITHUB_OWNER,
        repo: seed.repo.name,
        ref: "refs/heads/development",
        sha: seed.file.commit.sha
      }
    })

    seed.head = head

    const fileOnHead = await provider.call({
      path: "/repos/{owner}/{repo}/contents/{path}",
      method: "put",
      input: {
        owner: process.env.TEST_GITHUB_OWNER,
        repo: seed.repo.name,
        message: "Update file from tests",
        content: Buffer.from("updated file contents", 'utf-8').toString("base64"),
        branch: seed.head.ref.replace("/refs/heads/", ""),
        path: "hello.txt",
        sha: seed.file.content.sha
      }
    })

    seed.fileOnHead = fileOnHead

  })

  it("successfully creates nd closes a pr", async () => {
    const createResult = await provider.call({
      path: "/repos/{owner}/{repo}/pulls",
      method: "post",
      input: {
        owner: process.env.TEST_GITHUB_OWNER,
        repo: seed.repo.name,
        head: seed.head.ref.replace("/refs/heads/", ""),
        base: seed.repo.default_branch,
        title: uuid.v4()
      }
    })

    expect(createResult.failed).not.toEqual(true)

    const patchResult = await provider.call({
      path: "/repos/{owner}/{repo}/pulls/{pull_number}",
      method: "patch",
      input: {
        owner: process.env.TEST_GITHUB_OWNER,
        repo: seed.repo.name,
        pull_number: createResult.number,
        state: "closed"
      }
    })

    expect(patchResult.failed).not.toEqual(true)
  })

  afterAll(async () => {
    const deleteRepoResponse = await provider.call({
      path: "/repos/{owner}/{repo}",
      method: "delete",
      input: {
        owner: process.env.TEST_GITHUB_OWNER,
        repo: seed.repo.name,
      }
    })
  })
})

