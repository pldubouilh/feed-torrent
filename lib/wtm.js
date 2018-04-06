const WebTorrent = require('webtorrent')
const sc = require('supercop.js')
const keys = require('./keysHandler')
const sha1 = require('simple-sha1')

function WTM (opts, cb) {
  if (!cb) return new Promise((resolve, reject) => new WTM(opts, resolve))
  const self = this

  if (!opts.path) throw new Error('No path provided')
  self.path = opts.path

  self.verb = opts.verb
  if (self.verb) console.log(opts)

  self.wtOpts = {
    path: self.path,
    dht: {
      verify: sc.verify
    }
  }

  self.seeding = null
  self.downloading = null
  self.wt = new WebTorrent(self.wtOpts)
  self.wt.dht.on('ready', () => cb(self))
}

WTM.prototype.remove = function (iHash, cb) {
  if (!cb) return new Promise((resolve, reject) => this.remove(iHash, resolve))
  const self = this

  self.wt.remove(iHash, err => {
    if (err) console.log(err)
    cb()
  })
}

WTM.prototype.seed = async function (kp, cb) {
  if (!cb) return new Promise((resolve, reject) => this.seed(kp, resolve))
  const self = this

  if (self.seeding) {
    await self.remove(self.seeding)
    self.seeding = null
  }

  kp = keys.readKey(kp)

  self.wt.seed(self.path, t => {
    self.seeding = t.magnetURI
    kp.seq += 1
    kp.saveKey()

    const o = {
      v: Buffer.from(JSON.stringify({ ih: t.magnetURI }), 'utf8'),
      seq: kp.seq,
      k: kp.publicKey,
      sign: b => sc.sign(b, kp.publicKey, kp.secretKey)
    }

    self.wt.dht.put(o, (err, hash) => {
      if (err) console.log(err)
      if (self.verb) console.log(`\nNew content pushed, seq: ${kp.seq}`)
      // self.resolveDht(kp.dhtSpot)
      return cb(kp.magnet)
    })
  })
}

WTM.prototype.resolveDht = function (dhtSpot, cb) {
  if (!cb) return new Promise((resolve, reject) => this.resolveDht(dhtSpot, resolve))
  const self = this

  self.wt.dht.get(dhtSpot, (err, r) => {
    if (err) console.log(err)
    try {
      const dec = JSON.parse(r.v.toString('utf8'))
      if (self.verb) console.log(`\nResolved ${dhtSpot}\nSeq: ${r.seq}, infoHash: ${dec.ih}`)
      cb(dec.ih)
    } catch (e) { console.log(e) }
  })
}

WTM.prototype.dl = async function (btpkMagnet, cb) {
  if (!cb) return new Promise((resolve, reject) => this.dl(btpkMagnet, resolve))
  const self = this

  // TODO: Enhance me please
  const pk = btpkMagnet.split('btpk:')[1]
  const pkBuffer = Buffer.from(pk, 'hex')
  const sha = sha1.sync(pkBuffer)

  const ih = await self.resolveDht(sha)

  // Nothing new here
  if (self.downloading === ih) return cb(false) // eslint-disable-line standard/no-callback-literal

  // Shut previous torrent
  if (self.downloading) {
    if (self.verb) console.log('removing', self.downloading)
    await self.remove(self.downloading)
    self.downloading = null
  }

  self.wt.add(ih, { path: self.path }, t => {
    self.downloading = t.magnetURI
    if (self.verb) t.on('download', () => console.log(t.name, t.progress))
    t.on('done', () => cb(true)) // eslint-disable-line standard/no-callback-literal
  })
}

module.exports = WTM
