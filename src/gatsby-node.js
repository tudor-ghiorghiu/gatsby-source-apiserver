require('babel-polyfill')

const axios = require('axios')
const fetch = require(`./fetch`)
const normalize = require(`./normalize`)
const objectRef = require(`./helpers`).objectRef
const forEachAsync = require('./helpers').forEachAsync

// const typePrefix = `thirdParty__`

exports.sourceNodes = async ({
  boundActionCreators,
  createNodeId,
  reporter
}, {
  typePrefix = '',
  url,
  method = 'get',
  headers = {},
  data,
  localSave = false,
  skipCreateNode = false,
  path,
  auth = false,
  auth0Config = false,
  payloadKey,
  name,
  entityLevel,
  schemaType,
  entitiesArray = [{}],
  prefetch,
  params = {},
  verboseOutput = false
}) => {
  //store the attributes in an object to avoid naming conflicts
  const attributes = { typePrefix, url, method, headers, data, localSave, skipCreateNode, path, auth, params, payloadKey, name, entityLevel, schemaType }
  const { createNode } = boundActionCreators;

  // If true, output some info as the plugin runs
  let verbose = verboseOutput

  let authorization
  if (auth0Config) {
    console.time('\nAuthenticate user');
    // Make API request.
    try {
      const loginResponse = await axios(auth0Config);

      if (loginResponse.hasOwnProperty('data')) {
        authorization = 'Bearer ' + loginResponse.data.id_token;
      }
    } catch (error) {
      console.error('\nEncountered authentication error: ' + error);
    }
    console.timeEnd('\nAuthenticate user');
  }

  let prefetchData;
  if (prefetch)
    prefetchData = await fetch({ url: prefetch.url, method: prefetch.method });

  await forEachAsync(entitiesArray, async (entity) => {

    // default to the general properties for any props not provided

    const typePrefix = entity.typePrefix ? entity.typePrefix : attributes.typePrefix
    const url = entity.url ? entity.url : attributes.url
    const method = entity.method ? entity.method : attributes.method
    const headers = entity.headers ? entity.headers : attributes.headers
    const data = entity.data ? entity.data : attributes.data
    const localSave = entity.localSave ? entity.localSave : attributes.localSave
    const skipCreateNode = entity.skipCreateNode ? entity.skipCreateNode : attributes.skipCreateNode
    const path = entity.path ? entity.path : attributes.path
    const auth = entity.auth ? entity.auth : attributes.auth
    const params = entity.params ? entity.params : attributes.params
    const payloadKey = entity.payloadKey ? entity.payloadKey : attributes.payloadKey
    const name = entity.name ? entity.name : attributes.name
    const entityLevel = entity.entityLevel ? entity.entityLevel : attributes.entityLevel
    const schemaType = entity.schemaType ? entity.schemaType : attributes.schemaType

    if (authorization) headers.Authorization = authorization
    // Create an entity type from prefix and name supplied by user
    let entityType = `${typePrefix}${name}`
    // console.log(`entityType: ${entityType}`);

    let callUrl = url;
    if (prefetchData && typeof url === 'function') {
      callUrl = url(prefetchData);
    }

    // Fetch the data
    let entities = await fetch({ url: callUrl, method, headers, data, name, localSave, path, payloadKey, auth, params, verbose, reporter })

    // Interpolate entities from nested resposne
    if (entityLevel) {
      entities = objectRef(entities, entityLevel)
    }

    // If entities is a single object, add to array to prevent issues with creating nodes
    if (entities && !Array.isArray(entities)) {
      entities = [entities]
    }

    // console.log(`save: `, localSave);
    // console.log(`entities: `, entities.data);

    // Skip node creation if the goal is to only download the data to json files
    if (skipCreateNode) {
      return
    }

    // Generate the nodes
    normalize.createNodesFromEntities({
      entities,
      entityType,
      schemaType,
      createNode,
      createNodeId,
      reporter
    })

  })

  // We're done, return.
  return
};
