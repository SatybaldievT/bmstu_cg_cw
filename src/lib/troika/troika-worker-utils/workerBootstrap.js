/**
 * Main content for the worker that handles the loading and execution of
 * modules within it.
 */
 export function workerBootstrap() {
  const modules = Object.create(null);

  // Handle messages for registering a module
  function registerModule({id, name, dependencies=[], properties=[], init=function(){}, getTransferables=null, scripts=[]}, callback) {
    // Only register once
    if (modules[id]) return callback(new Error('module is already registered and ready to use'));
    importSrc(scripts);

    try {
      // If any dependencies are modules, ensure they're registered and grab their value
      dependencies = dependencies.map(dep => {
        if (dep && dep.isWorkerModule) {
          if (!modules[dep.id]) {
            registerModule(dep, depResult => {
              if (depResult instanceof Error) throw depResult
            })
          }
          dep = modules[dep.id].value
        }
        return dep
      })

      // Rehydrate functions
      init = rehydrate(`<${name}>.init`, init);
      if (getTransferables) {
        getTransferables = rehydrate(`<${name}>.getTransferables`, getTransferables)
      }

      // Initialize the module and store its value
      let value = null
      if (typeof init === 'function') {
        value = init(...dependencies)
      } else {
        console.error('worker module init function failed to rehydrate')
      }
      modules[id] = {
        id,
        value,
        name,
        getTransferables
      }
      
      for (let i = 0; i < properties.length; i++) {
        // if properties[i] is string expact it as function
        if (typeof properties[i].prop === "string") {
          properties[i].prop = new Function(properties[i].prop)();
        }
        value[properties[i].name] = properties[i].prop;
      }

      callback(value)
    } catch(err) {
      if (!(err && err.noLog)) {
        console.error(err)
      }
      callback(err)
    }
  }

  // Handle messages for calling a registered module's result function
  function callModule({id, args}, callback) {
    if (!modules[id] || typeof modules[id].value !== 'function') {
      callback(new Error(`Worker module ${id}: not found or its 'init' did not return a function`))
    }
    try {
      const result = modules[id].value(...args, callback);
      if (result && typeof result.then === 'function') {
        result.then(handleResult, rej => callback(rej instanceof Error ? rej : new Error('' + rej)))
      } else {
        handleResult(result)
      }
    } catch(err) {
      callback(err)
    }
    function handleResult(result) {
      try {
        let tx;
        if (modules[id].getTransferables) {
          tx = modules[id].getTransferables(result);
        } else if (result && result.$transfer) {
          tx = result.$transfer;
        }
        // let tx = modules[id].getTransferables && modules[id].getTransferables(result)
        if (!tx || !Array.isArray(tx) || !tx.length) {
          tx = undefined //postMessage is very picky about not passing null or empty transferables
        }
        callback(result, tx)
        // console.log('after worker post message', result.$transfer && result.$transfer[0].byteLength)
      } catch(err) {
        console.error(err)
        callback(err)
      }
    }
  }

  function rehydrate(name, str) {
    let result = void 0
    self.troikaDefine = r => result = r
    let url = URL.createObjectURL(
      new Blob(
        [`/** ${name.replace(/\*/g, '')} **/\n\ntroikaDefine(\n${str}\n)`],
        {type: 'application/javascript'}
      )
    )
    try {
      importScripts(url);
    } catch(err) {
      console.error(err)
    }
    URL.revokeObjectURL(url)
    delete self.troikaDefine
    return result
  }

  function importSrc(moduleSet) {
    if (moduleSet && moduleSet.length) {
      for (element of moduleSet) {
        try {
          importScripts(element);
        } catch (err) {
          console.error(err);
        }
      }
    }
  }

  // Handler for all messages within the worker
  self.addEventListener('message', e => {
    const {messageId, workerId, action, data} = e.data
    try {
      // Module registration
      if (action === 'registerModule') {
        registerModule(data, result => {
          if (result instanceof Error) {
            postMessage({
              messageId,
              success: false,
              error: result.message
            })
          } else {
            postMessage({
              messageId,
              success: true,
              result: {isCallable: typeof result === 'function'}
            })
          }
        })
        // just for convinity
        const pW = parseInt(workerId);
        // if (!pW && pW !== 0) console.log(workerId, modules);
        self.workerId = workerId;
        self.modules = modules;
      }
      // Invocation
      if (action === 'callModule') {
        callModule(data, (result, transferables) => {
          if (result instanceof Error) {
            postMessage({
              messageId,
              success: false,
              error: result.message
            })
          } else {
            postMessage({
              messageId,
              success: true,
              result
            }, transferables || undefined)
          }
        })
      }
    } catch(err) {
      postMessage({
        messageId,
        success: false,
        error: err.stack
      })
    }
  })
}
