/**
 * The best API documentation is here: https://github.com/Arcanemagus/plex-api/wiki
 * second best is maybe this one: https://www.plexopedia.com/plex-media-server/api/
 * This is a really helpful resource with example requests and repsonses including triggering a refresh/scan:
 *    https://support.plex.tv/articles/201638786-plex-media-server-url-commands/
 * This is also a good resource: https://www.npmjs.com/package/plex-api
 */

import baseConfig from "./base-config.json" assert { type: "json" }
import overrideConfig from "./config.json" assert { type: "json" }
import express from "express"
import axios from "axios"
import _ from "lodash"
import isValidFilename from 'valid-filename'

const config = _.merge({}, baseConfig, overrideConfig)

// Lower case names assist in quick lookups
for (const section in config.libraryDataPaths) {
  config.libraryDataPaths[section.toLowerCase()] = config.libraryDataPaths[section]
}

const plexRequest = axios.create({
  baseURL: `http://${config.plexHost}:${config.plexPort}/`,
  headers: {
    "X-Plex-Token": config.plexToken
  },
  responseType: "text",
})

const request = _.flow(plexRequest, async (futureResponse) => {
  const result = await futureResponse
  return result?.data
})

let sections = {}
let updateTimeout
async function updateSections() {
  clearTimeout(updateTimeout)
  try {
    sections = _.fromPairs(
      (await request("/library/sections"))?.MediaContainer.Directory.map(section => {
        return [ section.title.toLowerCase(), section ]
      })
    )
    updateTimeout = setTimeout(updateSections, config.sectionsRefreshInterval * 1000).unref()
  } catch (err) {
    console.error(`Error while trying to fetch sections info from Plex: ${err.message}\nRetrying in ${config.sectionsRefreshErrorRetryInterval} seconds`)
    updateTimeout = setTimeout(updateSections, config.sectionsRefreshErrorRetryInterval * 1000).unref()
  }
}
await updateSections()

function getSectionId(section) {
  section = section.toLowerCase()
  return sections[section]?.key
}

function getLibraryMediaPath(section, media) {
  if (!media) {
    return undefined
  }

  if (!isValidFilename(media)) {
    throw new Error(`"${media}" is not a valid media title`)
  }

  const secPaths = config.libraryDataPaths
  if (secPaths[section]) {
    return `${secPaths[section]}/${media}`
  }

  throw new Error(`No data path has been configured for section "${section}"`)
}


const app = express()
const router = express.Router()

router.get("/refresh/:section", async (req, res, next) => {
  try {
    const params = {
      path: getLibraryMediaPath(req.params.section, req.query.media)
    }

    const resp = await request({
      url: `/library/sections/${getSectionId(req.params.section)}/refresh`,
      params
    })
    res.send("Refresh started. It may take some time.")
  } catch (err) {
    res.status(500).send(`Error requesting refresh: ${err.message}`)
  }
})

app.use(config.basePath, router)

app.listen(config.listenPort, () => {
  console.log(`Listening on port ${config.listenPort}`)
})
