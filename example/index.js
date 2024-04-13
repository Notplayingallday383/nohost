/* eslint no-console:0 */

import { Workbox } from "/assets/libs/workbox/workbox-window.prod.mjs";

function serverReady() {
  console.log("Server ready! use `window.Filer.fs if you need an fs");
}

function serverInstall() {
  console.log("Server installed for first time");

  const fs = window.Filer.fs;
  fs.writeFile(
    "/test.txt",
    "This file exists to test the filesystem",
    function (err) {
      if (err) console.error(err);
    },
  );
}

/**
 * Register the nohost service worker, passing `route` or other options.
 */
if ("serviceWorker" in navigator) {
  const wb = new Workbox("/nohost-sw.js?debug&readwrite");

  // Wait on the server to be fully ready to handle routing requests
  wb.controlling.then(serverReady);

  // Deal with first-run install, if necessary
  wb.addEventListener("installed", (event) => {
    if (!event.isUpdate) {
      serverInstall();
    }
  });

  wb.register();
}

document.addEventListener("DOMContentLoaded", function () {
  const getButton = document.getElementById("get");
  const jsonButton = document.getElementById("getjson");
  const putButton = document.getElementById("put");
  const touchButton = document.getElementById("puttouch");
  const deleteButton = document.getElementById("delete");
  const getFolderButton = document.getElementById("getfolder");
  const putFolderButton = document.getElementById("putfolder");
  const deleteFolderButton = document.getElementById("deletefolder");
  // TextArea
  const console = document.getElementById("console");

  getButton.addEventListener("click", async function () {
    fetch("/fs/test.txt")
      .then((response) => response.text())
      .then((text) => (console.innerHTML = text));
  });

  jsonButton.addEventListener("click", async function () {
    fetch("/fs/test.txt?json")
      .then((response) => response.json())
      .then((json) => (console.innerHTML = JSON.stringify(json, null, 4)));
  });

  putButton.addEventListener("click", async function () {
    fetch("/fs/test.txt", {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body:
        "This file exists to test the filesystem, but now it has been updated (" +
        new Date().toISOString() +
        ")",
    })
      .then((response) => response.json())
      .then((json) => (console.innerHTML = JSON.stringify(json, null, 4)));
  });

  touchButton.addEventListener("click", async function () {
    fetch("/fs/test.txt?touch", {
      method: "PUT",
    })
      .then((response) => response.json())
      .then((json) => (console.innerHTML = JSON.stringify(json, null, 4)));
  });

  deleteButton.addEventListener("click", async function () {
    fetch("/fs/test.txt", {
      method: "DELETE",
    })
      .then((response) => response.json())
      .then((json) => (console.innerHTML = JSON.stringify(json, null, 4)));
  });

  getFolderButton.addEventListener("click", async function () {
    fetch("/fs/test?json")
      .then((response) => response.json())
      .then((json) => (console.innerHTML = JSON.stringify(json, null, 4)));
  });

  putFolderButton.addEventListener("click", async function () {
    await fetch("/fs/test?folder", {
      method: "PUT",
    })
      .then((response) => response.json())
      .then((json) => (console.innerHTML = JSON.stringify(json, null, 4)));

    fetch("/fs/test/test.txt", {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: "This file exists to test the filesystem, and it is in a folder",
    })
      .then((response) => response.json())
      .then((json) => (console.innerHTML = JSON.stringify(json, null, 4)));
  });

  deleteFolderButton.addEventListener("click", async function () {
    fetch("/fs/test", {
      method: "DELETE",
    })
      .then((response) => response.json())
      .then((json) => (console.innerHTML = JSON.stringify(json, null, 4)));
  });
});
