const fs = require('fs')
const sc = require('supercop.js')
const sha1 = require('simple-sha1')

function KeyPair () {
  return this
}

KeyPair.prototype.saveKey = function () {
  fs.writeFileSync(this.loc, JSON.stringify({
    publicKey: this.publicKey.toString('hex'),
    secretKey: this.secretKey.toString('hex'),
    seq: this.seq
  }))
}

function keygen (loc) {
  const kp = new KeyPair()
  kp.loc = loc

  const _kp = sc.createKeyPair(sc.createSeed())
  kp.publicKey = _kp.publicKey
  kp.publicKeyHex = kp.publicKey.toString('hex')
  kp.secretKey = _kp.secretKey
  kp.dhtSpot = sha1.sync(_kp.publicKey)
  kp.magnet = `magnet:?xs=urn:btpk:${kp.publicKeyHex}`
  kp.seq = 0
  kp.saveKey()
  return kp
}

function readKey (loc) {
  const kp = new KeyPair()
  kp.loc = loc

  let _kp = fs.readFileSync(loc)
  _kp = JSON.parse(_kp)
  kp.publicKeyHex = _kp.publicKey
  kp.publicKey = Buffer.from(_kp.publicKey, 'hex')
  kp.secretKey = Buffer.from(_kp.secretKey, 'hex')
  kp.dhtSpot = sha1.sync(kp.publicKey)
  kp.magnet = `magnet:?xs=urn:btpk:${kp.publicKeyHex}`
  kp.seq = _kp.seq
  return kp
}

module.exports = { keygen, readKey }
