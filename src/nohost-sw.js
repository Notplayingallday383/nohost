const jsonFormatter = require("./json-formatter");
const htmlFormatter = require("./html-formatter");
const { serve, update, del } = require("./webserver");
const { debug, route, readwrite } = require("./config");

const { fs, Shell, Buffer } = require("filer");

/* global workbox */
// TODO: include this via package.json
importScripts("/assets/libs/workbox/workbox-sw.js");

workbox.setConfig({ debug, modulePathPrefix: "/assets/libs/workbox" });

// Route with trailing slash (i.e., /path/into/filesystem)
const wwwRegex = new RegExp(`${route}(/.*)`);
// Route minus the trailing slash
const wwwPartialRegex = new RegExp(`${route}$`);

workbox.routing.registerRoute(
  wwwRegex,
  ({ url }) => {
    // Pull the filesystem path off the url
    let path = url.pathname.match(wwwRegex)[1];
    // Deal with encoding in the filename (e.g., spaces as %20)
    path = decodeURI(path);

    // Allow passing `?json` on URL to get back JSON vs. raw response
    const formatter =
      url.searchParams.get("json") !== null ? jsonFormatter : htmlFormatter;

    // Allow passing `?download` or `dl` to have the file downloaded vs. displayed
    const download =
      url.searchParams.get("download") !== null ||
      url.searchParams.get("dl") !== null;

    return serve(path, formatter, download);
  },
  "GET",
);

if (readwrite) {
  workbox.routing.registerRoute(
    wwwRegex,
    ({ url, request: { body } }) => {
      // Pull the filesystem path off the url
      let path = url.pathname.match(wwwRegex)[1];
      // Deal with encoding in the filename (e.g., spaces as %20)
      path = decodeURI(path);

      // Allow passing `?touch` on URL to update the file's timestamps or create if missing
      const touch = url.searchParams.get("touch") !== null;
      // Allow passing `?folder` on URL to create a directory
      const folder = url.searchParams.get("folder") !== null;

      return update(path, body, touch, folder);
    },
    "PUT",
  );

  workbox.routing.registerRoute(
    wwwRegex,
    ({ url }) => {
      // Pull the filesystem path off the url
      let path = url.pathname.match(wwwRegex)[1];
      // Deal with encoding in the filename (e.g., spaces as %20)
      path = decodeURI(path);

      return del(path);
    },
    "DELETE",
  );

  // Redirect if missing the / on our expected route
  workbox.routing.registerRoute(
    wwwPartialRegex,
    ({ url }) => {
      url.pathname = `${route}/`;
      return Promise.resolve(Response.redirect(url, 302));
    },
    "PUT",
  );

  workbox.routing.registerRoute(
    wwwPartialRegex,
    ({ url }) => {
      url.pathname = `${route}/`;
      return Promise.resolve(Response.redirect(url, 302));
    },
    "DELETE",
  );
}

// Redirect if missing the / on our expected route
workbox.routing.registerRoute(
  wwwPartialRegex,
  ({ url }) => {
    url.pathname = `${route}/`;
    return Promise.resolve(Response.redirect(url, 302));
  },
  "GET",
);
self.serve = serve;
self.htmlFormatter = htmlFormatter;

self.fs = fs;
self.Shell = Shell;
self.Buffer = Buffer;
workbox.core.skipWaiting();
workbox.core.clientsClaim();
