var path = require('path')
var events = require('events')
var fs = require('fs')

var app = require('app')
var Tray = require('tray')
var BrowserWindow = require('browser-window')

var extend = require('extend')
var Positioner = require('electron-positioner')

module.exports = function create (opts) {
  if (typeof opts === 'undefined') opts = {dir: app.getAppPath()}
  if (typeof opts === 'string') opts = {dir: opts}
  if (!opts.dir) opts.dir = app.getAppPath()
  if (!(path.isAbsolute(opts.dir))) opts.dir = path.resolve(opts.dir)
  if (!opts.index) opts.index = 'file://' + path.join(opts.dir, 'index.html')
  if (!opts['window-position']) opts['window-position'] = (process.platform === 'win32') ? 'trayBottomCenter' : 'trayCenter'
  if (typeof opts.showDockIcon === 'undefined') opts.showDockIcon = false

  // set width/height on opts to be usable before the window is created
   /* CustomTray changes - start*/
/* Preload option added to this module to enable ipc communication with preload Scripts to tray container*/
  opts.preload = opts.preload || WindowManager.getPreloadUrl()
     /* CustomTray changes - end*/

  opts.width = opts.width || 410
  opts.height = opts.height || 510


  var menubar = new events.EventEmitter()
  menubar.app = app
     /* CustomTray changes - start*/

  menubar.on('start', appReady);
    // app.on('ready', appReady);
   /* CustomTray changes - end*/



  // Set / get options
  menubar.setOption = function (opt, val) {
    opts[opt] = val
  }

  menubar.getOption = function (opt) {
    return opts[opt]
  }

  return menubar

  function appReady () {
    if (app.dock && !opts.showDockIcon) app.dock.hide()

    var iconPath = opts.icon || path.join(opts.dir, 'IconTemplate.png')
    if (!fs.existsSync(iconPath)) iconPath = path.join(__dirname, 'example', 'IconTemplate.png') // default cat icon

    var cachedBounds // cachedBounds are needed for double-clicked event

    menubar.tray = opts.tray || new Tray(iconPath)

    menubar.tray
      .on('click', click)
      .on('double-click', click)

    if (opts.preloadWindow) {
      createWindow()
    }

    menubar.showWindow = showWindow
    menubar.hideWindow = hideWindow

    menubar.positioner

    menubar.emit('ready')

    function click (e, bounds) {
      if (e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) return hideWindow()

      if (menubar.window && menubar.window.isVisible()) return hideWindow()

      // double click sometimes returns `undefined`
      bounds = bounds || cachedBounds

      cachedBounds = bounds
      showWindow(cachedBounds)
    }

    function createWindow () {
      menubar.emit('create-window')
      var defaults = {
        show: false,
        frame: false,
        resizable :false,
        movable :false
      }

      var winOpts = extend(defaults, opts)
      menubar.window = new BrowserWindow(winOpts)
      /* Cunstom Tray changes ..
       * WebContents for the window Created has to be returned 
       * with the menubar Instance
       */
      menubar.contents = menubar.window.webContents;

      menubar.positioner = new Positioner(menubar.window)

      if (!opts['always-on-top']) {
        menubar.window.on('blur', hideWindow)
      }

      if (opts['show-on-all-workspaces'] !== false) {
        menubar.window.setVisibleOnAllWorkspaces(true)
      }

      menubar.window.loadURL(opts.index)
      menubar.emit('after-create-window')
    }

    function showWindow (trayPos) {
      if (!menubar.window) {
        createWindow()
      }

      menubar.emit('show')

      // Default the window to the right if `trayPos` bounds are undefined or null.
      var noBoundsPosition = null
      if ((trayPos === undefined || trayPos.x === 0) && opts['window-position'].substr(0, 4) === 'tray') {
        noBoundsPosition = (process.platform === 'win32') ? 'bottomRight' : 'topRight'
      }

      var position = menubar.positioner.calculate(noBoundsPosition || opts['window-position'], trayPos)

      var x = (opts.x !== undefined) ? opts.x : position.x
      var y = (opts.y !== undefined) ? opts.y : position.y

      menubar.window.setPosition(x, y)
      menubar.window.show()
      menubar.emit('after-show')
      return
    }

    function hideWindow () {
     //CustomTray changes
      // if (!menubar.window) return 
      /* Edited to make "setAlwaysOnTop" window action works*/
      if (!menubar.window || menubar.window.isAlwaysOnTop()) return
      menubar.emit('hide')
      menubar.window.hide()
      menubar.emit('after-hide')
    }
  }
}
