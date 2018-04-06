#!/usr/bin/env node
const argv = require('yargs').argv
const fs = require('fs')
const WTM = require('./lib/wtm')
const keys = require('./lib/keysHandler')
const interval = require('interval-promise')

const help = `Mutable torrent helper

wtm generate   kp.json
wtm seed       kp.json fixture/
wtm seed watch kp.json fixture/
wtm dl        magnet ~/Downloads/
wtm dl watch  magnet ~/Downloads/`

function die (m, s) {
  console.log(m)
  process.exit(s)
}

let generate, seed, dl, watch, path, contentLoc, proceedingTorrent, timeoutToken, wtm

try {
  generate = argv._[0] === 'generate'
  seed = argv._[0] === 'seed'
  dl = argv._[0] === 'dl'
  watch = argv._[1] === 'watch'
  contentLoc = argv._[argv._.length - 2]
  path = argv._[argv._.length - 1]
} catch (error) {
  die(help, 0)
}

if (!generate && !seed && !dl) die(help, 0)

async function filechanged (timeoutDone) {
  // Don't carry on if we're proceeding a torrent already
  if (proceedingTorrent) return

  // Commit changes when folder unchanged for some time
  if (timeoutDone !== true) {
    clearTimeout(timeoutToken)
    timeoutToken = setTimeout(filechanged, 3000, true)
    return
  }

  proceedingTorrent = true
  console.log('\nDetected changes on', path, '...')
  await wtm.seed(contentLoc)
  console.log('\nNow seeding payload')
  proceedingTorrent = false
}

async function start () {
  if (generate) {
    const kp = keys.keygen(path)
    die(`Key generated at ${kp.loc}\n${kp.magnet}`, 0)
  }

  wtm = await new WTM({ path })

  // Seeding torrent from folder
  if (seed) {
    console.log('\nSeeding', path, watch ? '\nand watching for updates every 30secs' : '')
    await wtm.seed(contentLoc)
    if (watch) fs.watch(path, filechanged)
  }

  // Downloading torrent from btpk magnet
  if (dl) {
    console.log('\nDownloading', contentLoc, '\nPath:', path, watch ? '\nWill be watching for updates every 30secs' : '')
    await wtm.dl(contentLoc)
    console.log('\nDone downloading', path)

    // Recheck after 30 secs if something's new
    if (watch) {
      interval(async () => {
        console.log('\nChecking for update on', path)
        const fresh = await wtm.dl(contentLoc)
        if (fresh) console.log('\nDone downloading new content', path)
      }, 30 * 1000)
    }
  }
}

start()
