const gulp = require("gulp");
const minify = require("gulp-minify");
const connect = require("gulp-connect");
const babel = require("gulp-babel");
const imagemin = require("gulp-imagemin");
const htmlmin = require("gulp-htmlmin");
const { packImages } = require("./binpack");

function html(next) {
    gulp.src("./src/*.html")
        .pipe(
            htmlmin({
                collapseWhitespace: true,
                collapseInlineTagWhitespace: true,
                removeTagWhitespace: true,
                removeComments: true,
                minifyCSS: true,
                minifyJS: true,
                minifyURLs: true,
                collapseBooleanAttributes: true,
            })
        )
        .pipe(gulp.dest("./dist/"))
        .pipe(connect.reload());

    next();
}

function images(next) {
    gulp.src("./src/images/singles/**/*.*")
        .pipe(gulp.dest("./dist/images/"))
        .pipe(connect.reload());

    packImages(
        "./src/images/atlases/",
        "./dist/images/",
        2100,
        2100,
        1
    ).then(() => {
        console.log("Finished compressing all sprites into atlases.");
    });

    next();
}

function imagesBuild(next) {
    // Process files
    gulp.src("./src/images/singles/**/*.*")
        .pipe(imagemin([imagemin.optipng({ optimizationLevel: 3 })]))
        .pipe(gulp.dest("./dist/images/"))

    next();
}

function js(next) {
    gulp.src("./src/**/*.js")
        .pipe(
            babel({
                presets: ["@babel/preset-env"],
                plugins: [
                    [
                        "minify-mangle-names", {
                            topLevel: true,
                            eval: true,
                            exclude: {
                                lib: true,
                                PIXI: true,
                            }
                        }
                    ],
                ],
            }).on("error", (err) => console.log(err))
        )
        .pipe(
            minify({
                ext: {
                    min: ".js",
                },
                noSource: true,
            }).on("error", (err) => console.error(err))
        )
        .pipe(gulp.dest("./dist/"))
        .pipe(connect.reload());

    next();
}

function audio(next) {
    gulp.src("./src/sounds/**/*.*")
        .pipe(gulp.dest("./dist/sounds"))
        .pipe(connect.reload());

    next();
}

// Watchers
function watchHtml() {
    gulp.watch("./src/*.html", { ignoreInitial: false }, html);
}

function watchImages() {
    gulp.watch("./src/images/**/*.*", { ignoreInitial: false }, images);
}

function watchJs() {
    gulp.watch("./src/**/*.js", { ignoreInitial: false }, js);
}

function watchAudio() {
    gulp.watch("./src/sounds/**/*.*", { ignoreInitial: false }, audio);
}

gulp.task("dev", function (next) {
    watchHtml();
    //watchImages();
    watchJs();
    watchAudio();
    connect.server({
        livereload: true,
        root: "dist",
    });

    next();
});

gulp.task("build", function (next) {
    js(next);
    imagesBuild(next);
    audio(next);
    html(next);

    next();
});

gulp.task("images", function (next) {
    images(next);

    next();
});
