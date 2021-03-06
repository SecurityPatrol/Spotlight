const Twitter = require( 'twitter' )

const configJson        = './config.json'
const authorizationJson = './authorization.json'
const addonJson         = './addon.json'

const consumerKey = {
  consumer_key   : 'nDnk9b8WsPVE5hLoY44qNSevM',
  consumer_secret: 'hEesWDwCN6HTbkQ0YdIvgdHsgIhzEqcGwgKKtrerLbIz87BhS9'
}

let config
let authorization
let addonConfig

let client

let isAuthorized = false
let isAvailable  = false

// Launched -> Authorized -> Available

module.exports.launch = app => {

  // --- Addon --- //

  const loadAddonConfig = () => {
    let f = app.loadAppData( addonJson )
    return addonConfig = ( f !== null ) ? JSON.parse( f ) : {}
  }

  const saveAddonConfig = config => {
    return app.saveAppData( addonJson, JSON.stringify( config ) )
  }

  app.addListener( 'addon', () => {
    return { apps: app.getAllApps(), auto: loadAddonConfig() }
  } )

  app.addListener( 'addon/add', path => {
    app.callListener( 'controller/refresh' )
    return app.addApp( path )
  } )

  app.addListener( 'addon/remove', name => {
    let config = loadAddonConfig()
    delete config[name]
    saveAddonConfig( config )
    app.callListener( 'controller/refresh' )
    return app.removeApp( name )
  } )

  app.addListener( 'addon/auto/set', name => {
    let config = loadAddonConfig()
    config[name] = true
    return saveAddonConfig( config )
  } )

  app.addListener( 'addon/auto/release', name => {
    let config = loadAddonConfig()
    delete config[name]
    return saveAddonConfig( config )
  } )

  // --- Event --- //

  let isAvailableCallbacks = []

  app.addListener( 'isAvailable', callback => {
    if( isAvailable === true ) callback()
    else isAvailableCallbacks.push( callback )
  } )

  // --- Config --- //

  const loadConfig = () => {
    let f = app.loadAppData( configJson )
    return config = ( f !== null ) ? JSON.parse( f ) : {}
  }

  const saveConfig = config => {
    return app.saveAppData( configJson, JSON.stringify( config ) )
  }

  app.addListener( 'config/load', () => loadConfig() )

  app.addListener( 'config/save', ( key, value, enable ) => {
    let config = loadConfig()
    config[key] = {
      value : value,
      enable: enable
    }
    return saveConfig( config )
  } )

  app.addListener( 'config/delete', key => {
    let config = loadConfig()
    delete config[key]

    return saveConfig( config )
  } )

  app.addListener( 'config/enable', key => {
    let config = loadConfig()
    if( config[key] === undefined )
      return false

    config[key].enable = true
    return saveConfig( config )
  } )

  app.addListener( 'config/disable', key => {
    let config = loadConfig()
    if( config[key] === undefined )
      return false

    config[key].enable = false
    return saveConfig( config )
  } )

  // Init

  loadConfig()

  // --- App Support --- //

  app.addListener( 'app/running', () => {
    return app.getApp().getYacona().getApps()
  } )

  app.addListener( 'app/launch', name => {
    const alreadyRunning = app.getApp().getYacona().getApps()
    if( alreadyRunning[name] !== undefined ){
      if( alreadyRunning[name].getInstance().launch )
        alreadyRunning[name].getInstance().launch( alreadyRunning[name].getController() )
      return alreadyRunning[name]
    }

    const path = app.getAppPath( name )
    const instance = app.attachApp( path !== null ? path : ( '../' + name ) )

    instance.launch()

    return instance
  } )

  app.addListener( 'app/close', name => {
    const alreadyRunning = app.getApp().getYacona().getApps()
    if( alreadyRunning[name] !== undefined ){
      alreadyRunning[name].close()
      return true
    }

    return false
  } )

  // --- Twitter --- //

  const getAuthorization = () => {
    let f = app.loadAppData( authorizationJson )
    if( f !== null ){
      isAuthorized = true
      authorization = JSON.parse( f )
    } else {
      authorization = {}
    }
    return authorization
  }

  const getClient = ( access_token, access_token_secret ) => {
    let option = {
      consumer_key       : consumerKey.consumer_key,
      consumer_secret    : consumerKey.consumer_secret,
      access_token_key   : access_token,
      access_token_secret: access_token_secret
    }
    let config = loadConfig()
    if( config.proxy !== undefined && config.proxy.enable === true )
      option.request_options = {
        proxy: conf.proxy.value
      }

    client = new Twitter( option )
    return client
  }

  app.addListener( 'twitter/isAuthorized', () => isAuthorized )

  app.addListener( 'twitter/key/consumer', () => consumerKey )

  app.addListener( 'twitter/key/register', data => {
    let response = app.saveAppData( authorizationJson, JSON.stringify( data ) )
    getAuthorization()
    getClient( authorization.access_token, authorization.access_token_secret )
    isAvailable = true
    for( ;isAvailableCallbacks.length; ) isAvailableCallbacks.shift()()
    return response
  } )

  // API

  let me

  app.addListener( 'twitter/me', () => {
    return new Promise( ( resolve, reject ) => {
      if( me === undefined )
        client.get( 'users/show', { user_id: authorization.id }, ( error, profile ) => {
          if( error ) reject( error )
          else resolve( me = profile )
        } )
      else
        resolve( me )
    } )
  } )

  app.addListener( 'twitter/search', query => {
    return new Promise( function( resolve, reject ){
      client.get( 'search/tweets', {
        q: query.query,
        count: query.count
      }, function( error, tweet, response ){
        if( error === null ) resolve( tweet )
        else reject( error )
      } )
    } )
  } )

  // Init

  getAuthorization()

  if( isAuthorized === true )
    getClient( authorization.access_token, authorization.access_token_secret )

  if( client ){
    isAvailable = true
    for( ;isAvailableCallbacks.length; ) isAvailableCallbacks.shift()()
  }

  let apps = loadAddonConfig()
  for( let i in apps ){
    const path = app.getAppPath( i )
    const instance = app.attachApp( path !== null ? path : ( '../' + name ) )

    instance.launch()
  }

}
