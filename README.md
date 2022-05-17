# Plex Helper

Eventually this will hopefully do a lot more and have a GUI but for now it can only trigger a full or partial refresh/scan of media files.

To configure it, add a new file called `config.json` next to the existing `base-config.json` and add at least the following:

```json
{
  "plexToken": "[Your token here]",
  "plexHost": "[Plex host IP here]"
}
```

Look at `base-config.json` for other options you can override.

To enable partial refreshing of just a single media item instead of the whole library section, you must provide the section filesystem paths keyed by their respective library section names:

```json
{
  "libraryDataPaths": {
    "TV Shows": "/path/to/TV Shows",
    "Movies": "/path/to/Movies",
    "Music": "/path/to/Music"
  }
}
```

Once configured, install the dependencies and start the service:

```
npm install
npm start
```

To request a full refresh, open your browser and visit the `/refresh` endpoint, providing the section name you want to refresh (e.g. `/plex/refresh/TV Shows`).

To request a partial refresh of some media, provide the media name as a request parameter (e.g. `/plex/refresh/TV Shows?media=Some Show Title`).

> Note: The section names (e.g. "Movies" or "TV Shows") are not case sensitive but the media titles **are** case sensitive and must match the filesystem path name for the media you want to refresh.

## MIT License

See [here](LICENSE.md)
