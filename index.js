/* eslint-disable no-console */
const EventEmitter = require('events')
const URL = require('url')
const cbor = require('cbor-sync')

class ITMPWsServerLink extends EventEmitter {
  constructor(name, ws) {
    super()
    this.ws = ws
    this.name = name
    this.ready = true
    //const that = this
    this.ws.on('error', (err) => {
      console.log('Error: ', err.message)
      //that.emit('error', error)
    })

    this.ws.on('open', () => {
      this.ready = true // port opened flag
      this.emit('connect', this)
    })

    this.ws.on('message', (message) => {
      let msg
      if (typeof message === 'string') { msg = JSON.parse(message) } else { msg = cbor.decode(message) }
      this.emit('message', msg)
    })

    this.ws.on('pong', () => {
      this.isAlive = true
    })

    this.ws.on('close', (code, reason) => {
      clearInterval(this.pingInterval)
      this.pingInterval = undefined
      console.log('closed ', name, code, reason)
      this.ready = false
      this.emit('disconnect', this)
      this.ws.removeAllListeners('error')
      this.ws.removeAllListeners('open')
      this.ws.removeAllListeners('close')
      this.ws.removeAllListeners('message')
      this.ws.removeAllListeners('pong')

    })

    this.pingInterval = setInterval(() => {
      if (this.isAlive === false) {
        return this.ws.terminate()
      }
      this.isAlive = false
      try {
        this.ws.ping(() => { })
      } catch (er) {
        console.error(er)
      }
    }, 30000)

    setImmediate(() => {
      this.emit('connect', this)
    })
  }

  send(binmsg) {
    return new Promise((resolve, reject) => {
      if (this.ready) {
        try {
          //this.ws.send(JSON.stringify(binmsg))
          //  console.log(binmsg)
          let cmsg = cbor.encode(binmsg)
          this.ws.send(cmsg, () => {
            resolve()
          })
          //this.sendlevel = this.ws._sender.queue.length
          //this.sendamount = this.ws._sender.bufferedBytes
          //console.log(123456)
        }
        catch (err) {
          reject(err)
        }
      }
      else {
        reject(new Error('500 not ready'))
      }
    })
  }

  stop() {
    this.ws.close()
  }
  close() {
    this.ws.close()
  }
}

class ITMPWsServer extends EventEmitter {
  constructor(url, opts, callback) {
    super()
    let path
    const wsurl = URL.parse(url)
    const port = wsurl.port || 80
    path = wsurl.pathname
    if (opts && opts.expressapp) {
      this.app = opts.expressapp
    } else {
      //const that = this
      const express = require('express')
      const expressws = require('express-ws')
      this.app = express()
      expressws(this.app)
      // start server!
      this.server = this.app.listen(port, () => {
        //that.emit('connect', that)
        console.log(`App listening on address '${this.server.address().address}' and port ${this.server.address().port}`)
      })
    }

    this.app.ws(path, (ws, req) => {
      let link
      if (req.connection.remoteFamily === 'IPv6') {
        link = new ITMPWsServerLink(`ws:[${req.connection.remoteAddress}]:${req.connection.remotePort}`, ws)
      } else {
        link = new ITMPWsServerLink(`ws:${req.connection.remoteAddress}:${req.connection.remotePort}`, ws)
      }
      callback(link)
      //console.log(`connected ws:[${req.connection.remoteAddress}]:${req.connection.remotePort}`)
    })
  }
}

module.exports = ITMPWsServer
