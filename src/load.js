// Preloader
const preloader_dom = document.querySelector("#preloader");
const logo_dom = preloader_dom.querySelector("#logo");
const loaderText_dom = preloader_dom.querySelector("p");

PIXI.Loader.shared.onProgress.add((e) => {
    loaderText_dom.textContent = Math.floor(e.progress) + "%";
});

PIXI.Loader.shared.onComplete.add((e) => {
    loaderText_dom.textContent = "Click to play.";

    preloader_dom.addEventListener("click", () => {
        preloader_dom.classList.add("transition");
        logo_dom.classList.add("transition");

        setTimeout(() => {
            preloader_dom.remove();
            scene.instance.play();
        }, 1200);
    })
});

// Load scene
var scene = new PIXI.animate.Scene(950, 650, {
    view: document.getElementById("stage"),
    backgroundColor: 0xffffff,
    antialias: true
});

scene.load(lib.S_VriskaWake3_PixiAnimate);