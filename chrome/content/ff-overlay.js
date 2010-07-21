ffpake.onFirefoxLoad = function(event) {
  document.getElementById("contentAreaContextMenu")
          .addEventListener("popupshowing", function (e){ ffpake.showFirefoxContextMenu(e); }, false);
};

ffpake.showFirefoxContextMenu = function(event) {
  // show or hide the menuitem based on what the context menu is on
  document.getElementById("context-ffpake").hidden = gContextMenu.onImage;
};

window.addEventListener("load", ffpake.onFirefoxLoad, false);
