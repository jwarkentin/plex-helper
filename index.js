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

let sectionsByTitle = {}
let updateTimeout
async function updateSections() {
  clearTimeout(updateTimeout)
  try {
    sectionsByTitle = _.fromPairs(
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
updateSections()

function getSectionInfo(sectionTitle) {
  const sectionInfo = sectionsByTitle[sectionTitle.toLowerCase()]
  if (!sectionInfo) {
    throw new Error(`Invalid section name "${sectionTitle}"`)
  }
  return sectionInfo
}

function getLibraryMediaPath(sectionInfo, query) {
  const { media, season } = query
  if (!media) {
    return undefined
  }

  if (!isValidFilename(media)) {
    throw new Error(`"${media}" is not a valid media title`)
  }

  const secPath = sectionInfo.Location[0]?.path
  if (!secPath) {
    throw new Error(`Could not determine the filesystem path for the "${sectionInfo.title}" section`)
  }

  let mediaPath = `${secPath}/${media}`
  if (season) {
    if (!/\d+/.test(season)) {
      throw new Error(`"${season}" is not a valid season number`)
    }

    if (sectionInfo.type !== "show") {
      throw new Error(`"season" is not a valid parameter for this library section`)
    }

    mediaPath += `/Season ${season.padStart(2, "0")}`
  }

  return mediaPath
}


const app = express()
const router = express.Router()

router.get("/refresh/:section", async (req, res, next) => {
  try {
    const sectionInfo = getSectionInfo(req.params.section)
    if (!sectionInfo) {
      throw new Error(`There is no section named "${req.params.section}"`)
    }

    const params = {
      path: getLibraryMediaPath(sectionInfo, req.query)
    }

    const resp = await request({
      url: `/library/sections/${sectionInfo.key}/refresh`,
      params
    })

    res.send("Refresh started. It may take some time to complete.")
  } catch (err) {
    res.status(500).send(`Error requesting refresh: ${err.message}`)
  }
})

app.use(config.baseRoute, router)

app.listen(config.listenPort, () => {
  console.log(`Listening on port ${config.listenPort}`)
})
