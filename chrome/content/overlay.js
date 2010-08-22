var ffpake = {
  onLoad: function() {
    // initialization code
    this.initialized = true;
    this.strings = document.getElementById("ffpake-strings");
  },

  onToolbarButtonCommand: function(e) {
    // just reuse the function above.  you can change this, obviously!
    ffpake.onMenuItemCommand(e);
  }
};

window.addEventListener("load", ffpake.onLoad, false);
