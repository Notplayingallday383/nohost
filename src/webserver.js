"use strict";

const { fs, Path, Buffer } = require("filer");
const { route, disableIndexes, directoryIndex } = require("./config");
const sh = new fs.Shell();

// https://tools.ietf.org/html/rfc2183
function formatContentDisposition(path, stats) {
  const filename = Path.basename(path);
  const modified = stats.mtime.toUTCString();
  return `attachment; filename="${filename}"; modification-date="${modified}"; size=${stats.size};`;
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const reader = stream.getReader();
    const chunks = [];

    function pump() {
      reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            const totalLength = chunks.reduce(
              (acc, chunk) => acc + chunk.length,
              0,
            );
            const uint8Array = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
              uint8Array.set(chunk, offset);
              offset += chunk.length;
            }
            resolve(Buffer.from(uint8Array));
            return;
          }

          chunks.push(value);
          pump();
        })
        .catch(reject);
    }

    pump();
  });
}

const update = function (path, contents, touch, folder) {
  return new Promise((resolve) => {
    if (folder) {
      sh.mkdirp(path, function (err) {
        if (err) {
          resolve(
            new Response('{"error": "Failed to create directory"}', {
              status: 500,
            }),
          );
        }

        return resolve(new Response('{"status": "ok"}', { status: 200 }));
      });
    } else if (touch) {
      sh.touch(path, function (err) {
        if (err) {
          resolve(
            new Response('{"error": "Failed to touch file"}', { status: 500 }),
          );
        }

        return new Response('{"status": "ok"}', { status: 200 });
      });
    } else {
      // contents is either a ReadableStream or null
      if (contents === null) {
        return resolve(
          new Response('{"error": "No file contents provided"}', {
            status: 400,
          }),
        );
      }
      streamToBuffer(contents)
        .then((buffer) => {
          fs.writeFile(path, buffer, function (err) {
            if (err) {
              resolve(
                new Response('{"error": "Failed to write file"}', {
                  status: 500,
                }),
              );
            }

            return resolve(new Response('{"status": "ok"}', { status: 200 }));
          });
        })
        .catch(() => {
          resolve(
            new Response('{"error": "Failed to read file contents"}', {
              status: 500,
            }),
          );
        });
    }
  });
};

const del = function (path) {
  return new Promise((resolve) => {
    // Delete the file or directory
    sh.rm(path, { recursive: true }, function (err) {
      if (err) {
        resolve(
          new Response('{"error": "Failed to delete file"}', { status: 500 }),
        );
      }

      return resolve(new Response('{"status": "ok"}', { status: 200 }));
    });
  });
};

const serve = function (path, formatter, download) {
  return new Promise((resolve) => {
    function buildResponse(responseData) {
      return new Response(responseData.body, responseData.config);
    }

    function serveError(path, err) {
      if (err.code === "ENOENT") {
        return resolve(buildResponse(formatter.format404(path)));
      }
      resolve(buildResponse(formatter.format500(path, err)));
    }

    function serveFile(path, stats) {
      fs.readFile(path, function (err, contents) {
        if (err) {
          return serveError(path, err);
        }

        const responseData = formatter.formatFile(path, contents, stats);

        // If we are supposed to serve this file or download, add headers
        if (responseData.config.status === 200 && download) {
          responseData.config.headers["Content-Disposition"] =
            formatContentDisposition(path, stats);
        }

        responseData.config.headers["Cross-Origin-Embedder-Policy"] =
          "require-corp";
        responseData.config.headers["Access-Control-Allow-Origin"] = "*";
        responseData.config.headers["Cross-Origin-Opener-Policy"] =
          "same-origin";
        responseData.config.headers["Cross-Origin-Resource-Policy"] =
          "same-site";

        resolve(new Response(responseData.body, responseData.config));
      });
    }

    // Either serve /index.html (default index) or / (directory listing)
    function serveDir(path) {
      function maybeServeIndexFile() {
        const indexPath = Path.join(path, directoryIndex);

        fs.stat(indexPath, function (err, stats) {
          if (err) {
            if (err.code === "ENOENT" && !disableIndexes) {
              // Fallback to a directory listing instead
              serveDirListing();
            } else {
              // Let the error (likely 404) pass through instead
              serveError(path, err);
            }
          } else {
            // Index file found, serve that instead
            serveFile(indexPath, stats);
          }
        });
      }

      function serveDirListing() {
        sh.ls(path, function (err, entries) {
          if (err) {
            return serveError(path, err);
          }

          const responseData = formatter.formatDir(route, path, entries);
          resolve(new Response(responseData.body, responseData.config));
        });
      }

      maybeServeIndexFile();
    }

    fs.stat(path, function (err, stats) {
      if (err) {
        return serveError(path, err);
      }

      if (stats.isDirectory()) {
        serveDir(path);
      } else {
        serveFile(path, stats);
      }
    });
  });
};

module.exports = { serve, update, del };
