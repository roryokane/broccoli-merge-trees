var fs = require('fs')
var path = require('path')
var walkSync = require('walk-sync')
var Writer = require('broccoli-writer')
var mapSeries = require('promise-map-series')


module.exports = TreeMerger
TreeMerger.prototype = Object.create(Writer.prototype)
TreeMerger.prototype.constructor = TreeMerger
function TreeMerger (inputTrees, options) {
  if (!(this instanceof TreeMerger)) return new TreeMerger(inputTrees, options)
  if (!Array.isArray(inputTrees)) {
    throw new Error('Expected array, got ' + inputTrees)
  }
  this.inputTrees = inputTrees
  this.options = options || {}
}

TreeMerger.prototype.write = function (readTree, destDir) {
  var self = this
  var files = {}
  var directories = {}
  return mapSeries(this.inputTrees, readTree).then(function (treePaths) {
    for (var i = treePaths.length - 1; i >= 0; i--) {
      var treeContents = walkSync(treePaths[i])
      for (var j = 0; j < treeContents.length; j++) {
        var relativePath = treeContents[j]
        var destPath = destDir + '/' + relativePath
        if (relativePath.slice(-1) === '/') { // is directory
          relativePath = relativePath.slice(0, -1) // chomp "/"
          var fileIndex = files[relativePath]
          if (fileIndex != null) {
            throwFileAndDirectoryCollision(relativePath, fileIndex, i)
          }
          if (directories[relativePath] == null) {
            fs.mkdirSync(destPath)
            directories[relativePath] = i
          }
        } else { // is file
          var directoryIndex = directories[relativePath]
          if (directoryIndex != null) {
            throwFileAndDirectoryCollision(relativePath, i, directoryIndex)
          }
          var fileIndex = files[relativePath]
          if (fileIndex != null) {
            if (!self.options.overwrite) {
              throw new Error('Merge error: ' +
                'File "' + relativePath + '" exists in ' +
                treePaths[i] + ' and ' + treePaths[fileIndex] + ' - ' +
                'pass option { overwrite: true } to mergeTree in order ' +
                'to have the latter file win')
            } else {
              // Ignore this file. It is "overwritten" by a file we
              // copied earlier, thanks to reverse iteration over trees
            }
          } else {
            // Link file into place. We should have a fallback in case
            // we cannot hardlink.
            fs.linkSync(treePaths[i] + '/' + relativePath, destPath)
            files[relativePath] = i
          }
        }
      }

      function throwFileAndDirectoryCollision (relativePath, fileIndex, directoryIndex) {
        throw new Error('Merge error: "' + relativePath +
          '" exists as a file in ' + treePaths[fileIndex] +
          ' but as a directory in ' + treePaths[directoryIndex])
      }
    }
  })
}
