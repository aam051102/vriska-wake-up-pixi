/*
 * Original code from https://github.com/mackstann/binpack/blob/master/livedemo.html
 */

const fs = require("fs");
const path = require("path");
const canvas = require("canvas");
const gifFrames = require("gif-frames");
const toArray = require("stream-to-array");

// Rect
/**
 * Initializes a new `Rect`
 *
 * @param {Number} x x position
 * @param {Number} y y position
 * @param {Number} w width
 * @param {Number} h height
 */
class Rect {
    constructor(x, y, w, h, padding = 0) {
        this.x = x;
        this.y = y;
        this.w = w + padding * 2;
        this.h = h + padding * 2;
    }

    /**
     * Ensures that the `Rect` can fit within the expected container
     *
     * @param {Rect} outer
     */
    fitsIn = (outer) => {
        return outer.w >= this.w && outer.h >= this.h;
    };

    /**
     * Ensures that two `Rect` instances are the exact same size
     *
     * @param {Rect} other
     */
    sameSizeAs = (other) => {
        return this.w == other.w && this.h == other.h;
    };
}

// BinNode
/**
 * Initializes a new `BinNode`
 */
class BinNode {
    constructor() {
        this.left = null;
        this.right = null;
        this.rect = null;
        this.filled = false;
    }

    /**
     * Calculates best position for `Rect` instance and inserts it
     *
     * @param {Rect} rect `Rect` instance to be inserted
     */
    insertRect = (rect) => {
        if (this.left != null)
            return this.left.insertRect(rect) || this.right.insertRect(rect);

        if (this.filled) return null;

        if (!rect.fitsIn(this.rect)) return null;

        if (rect.sameSizeAs(this.rect)) {
            this.filled = true;
            return this;
        }

        this.left = new BinNode();
        this.right = new BinNode();

        let widthDiff = this.rect.w - rect.w;
        let heightDiff = this.rect.h - rect.h;

        let me = this.rect;

        if (widthDiff > heightDiff) {
            // split literally into left and right, putting the rect on the left.
            this.left.rect = new Rect(me.x, me.y, rect.w, me.h);
            this.right.rect = new Rect(
                me.x + rect.w,
                me.y,
                me.w - rect.w,
                me.h
            );
        } else {
            // split into top and bottom, putting rect on top.
            this.left.rect = new Rect(me.x, me.y, me.w, rect.h);
            this.right.rect = new Rect(
                me.x,
                me.y + rect.h,
                me.w,
                me.h - rect.h
            );
        }

        return this.left.insertRect(rect);
    };
}

/**
 * Recursively reads directories
 *
 * Original code from https://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
 *
 * @param {String} dir root directory
 * @returns {String[]}
 */
const walkDir = (dir) => {
    let results = [];

    const list = fs.readdirSync(dir);

    let pending = list.length;

    if (!pending) return results;

    list.forEach((file) => {
        file = path.resolve(dir, file);

        const stat = fs.statSync(file);

        if (stat && stat.isDirectory()) {
            const res = walkDir(file);

            results = results.concat(res);
            if (!--pending) return results;
        } else {
            results.push(file);
            if (!--pending) return results;
        }
    });

    return results;
};

/**
 * Recursively packs images from a root dir into multiple atlases, and exports a JSON file compatible with pixi.js
 *
 * @param {String} rootDir input directory
 * @param {String} outputDir output directory
 * @param {Number} canvasWidth maximum atlas width
 * @param {Number} canvasHeight maximum atlas height
 * @param {Number} padding padding around images
 * @returns {Promise}
 */
const packImages = (
    rootDir,
    outputDir,
    canvasWidth = 2048,
    canvasHeight = 2048,
    padding = 1
) => {
    return new Promise(async (resolve, reject) => {
        const canvases = [];
        const atlasAssets = [];

        // Prepares another canvas
        const addCanvas = (rect) => {
            let startNode = new BinNode();
            startNode.rect = rect
                ? rect
                : new Rect(0, 0, canvasWidth, canvasHeight);
            canvases.push(startNode);
            atlasAssets.push([]);
            return startNode;
        };

        // Finds asset paths
        let assetPaths;
        try {
            assetPaths = walkDir(rootDir);
        } catch (err) {
            reject(err);
            return;
        }

        // Runs through all assets
        for (let i = 0; i < assetPaths.length; i++) {
            let assetList = [];

            if (assetPaths[i].endsWith(".gif")) {
                await gifFrames({
                    url: assetPaths[i],
                    frames: "all",
                    outputType: "png",
                    cumulative: true,
                }).then((frameData) => {
                    return new Promise(async (resolve) => {
                        for (let j = 0; j < frameData.length; j++) {
                            const img = frameData[j].getImage();

                            await toArray(img).then((parts) => {
                                return new Promise(async (resolveB) => {
                                    let buffers = [];

                                    for (let x = 0; x < parts.length; x++) {
                                        var part = parts[x];
                                        buffers.push(
                                            part instanceof Buffer
                                                ? part
                                                : Buffer.from(part)
                                        );
                                    }

                                    assetList.push(
                                        await canvas.loadImage(
                                            Buffer.concat(buffers)
                                        )
                                    );

                                    resolveB();
                                });
                            });
                        }

                        resolve();
                    });
                });
            } else if (!assetPaths[i].endsWith(".png")) {
                continue;
            } else {
                assetList.push(await canvas.loadImage(assetPaths[i]));
            }

            for (let j = 0; j < assetList.length; j++) {
                const asset = assetList[j];

                let rect = new Rect(
                    0,
                    0,
                    asset.naturalWidth,
                    asset.naturalHeight,
                    padding
                );

                // Decide canvas position
                let currentCanvas = 0;
                let node;
                while (
                    currentCanvas < canvases.length &&
                    !(node = canvases[currentCanvas].insertRect(rect))
                ) {
                    currentCanvas++;
                }

                // Create new canvas if position not possible in current canvases
                if (!node) {
                    node = addCanvas().insertRect(rect);

                    if (!node) {
                        canvases.pop();
                        node = addCanvas(rect).insertRect(rect);
                    }
                }

                // Save to canvas or log error
                if (node) {
                    let r = node.rect;
                    const rectObject = {
                        frame: {
                            x: r.x + padding,
                            y: r.y + padding,
                            w: r.w - padding,
                            h: r.h - padding,
                        },
                        rotated: false,
                        trimmed: false,
                        spriteSourceSize: {
                            x: 0,
                            y: 0,
                            w: asset.naturalWidth,
                            h: asset.naturalHeight,
                        },
                        sourceSize: {
                            w: asset.naturalWidth,
                            h: asset.naturalHeight,
                        },
                    };

                    atlasAssets[currentCanvas].push({
                        image: asset,
                        data: rectObject,
                        path:
                            assetList.length == 1
                                ? path.basename(assetPaths[i], path.extname(assetPaths[i]))
                                : path.basename(
                                      assetPaths[i],
                                      path.extname(assetPaths[i])
                                  ) +
                                  "-" +
                                  j,
                    });
                } else {
                    console.error(
                        `An error occured with image "${assetPaths[i]}".`
                    );
                    break;
                }
            }
        }

        fs.mkdirSync(outputDir, { recursive: true });

        for (let i = 0; i < canvases.length; i++) {
            const atlasData = {};

            const canvasRect = canvases[i].rect;

            // Meta
            atlasData.meta = {
                version: "1.0",
                image: `atlas-${i}.png`,
                size: { w: canvasRect.w, h: canvasRect.h },
                scale: "1",
            };

            atlasData.frames = {};

            // Processing
            const atlasCanvas = canvas.createCanvas(canvasRect.w, canvasRect.h);
            const context = atlasCanvas.getContext("2d");

            for (let j = 0; j < atlasAssets[i].length; j++) {
                // Image
                context.drawImage(
                    atlasAssets[i][j].image,
                    atlasAssets[i][j].data.frame.x,
                    atlasAssets[i][j].data.frame.y
                );

                // JSON
                atlasData.frames[path.basename(atlasAssets[i][j].path)] =
                    atlasAssets[i][j].data;
            }

            // Image
            const buffer = atlasCanvas.toBuffer("image/png");
            fs.writeFileSync(path.join(outputDir, `/atlas-${i}.png`), buffer);

            // JSON
            fs.writeFileSync(
                path.join(outputDir, `/atlas-${i}.json`),
                JSON.stringify(atlasData)
            );
        }

        resolve();
    });
};

module.exports = { packImages };