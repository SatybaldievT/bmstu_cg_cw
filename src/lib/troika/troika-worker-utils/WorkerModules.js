import { workerBootstrap } from './workerBootstrap.js'
import { defineMainThreadModule } from './mainThreadFallback.js'
import { supportsWorkers } from './supportsWorkers.js'

let _workerModuleId = 0;
let _messageId = 0;
let _allowInitAsString = false;
const workers = Object.create(null);
const registeredModules = Object.create(null); //workerId -> Set<unregisterFn>
const openRequests = Object.create(null);
// if several modules has same dependencies no need to create all of them
// create one and reuse it
const moduleMap = new Map();

export function defineWorkerModule(options) {
  if ((!options || typeof options.init !== 'function') && !_allowInitAsString) {
    throw new Error('requires `options.init` function')
  }
  let {dependencies, init, getTransferables, workerId, properties, scripts = []} = options

  if (!supportsWorkers()) {
    return defineMainThreadModule(options)
  }

  if (workerId == null) {
    workerId = '#default'
  }

  // in order to not create each module
  // we can reuse it if it was created by name
  // for ex: in many file we use Utils
  // TODO we can skip stringifyFunc for others if it was already created
  const id = (options.name && options.name.length) ? (moduleMap.get(options.name) ? moduleMap.get(options.name) : moduleMap.set(options.name, `workerModule${++_workerModuleId}`).get(options.name)) : `workerModule${++_workerModuleId}`;
  const name = options.name || id
  let registrationPromise = null

  dependencies = dependencies && dependencies.map(dep => {
    // Wrap raw functions as worker modules with no dependencies
    if (typeof dep === 'function' && !dep.workerModuleData) {
      _allowInitAsString = true

      // if function has Properties stringify them
      // it's usefull when we pass function to an another worker within properties
      let keys = Object.keys(dep);
      const properties = [];
      for (let i = 0; i < keys.length; i++) {
        if (typeof dep[keys[i]] === "function") {
          // to get this function in workerBootstrap
          // create object new Function and call it
          properties.push({name: keys[i], prop: "return " + stringifyFunction(dep[keys[i]])});
        } else {
          properties.push({name: keys[i], prop: dep[keys[i]]});
        }
      }
      dep = defineWorkerModule({
        workerId,
        name: dep.name,
        properties,
        // name: `<${name}> function dependency: ${dep.name}`,
        init: `function(){return (\n${stringifyFunction(dep)}\n)}`
      })
      _allowInitAsString = false
    }
    // Grab postable data for worker modules
    if (dep && dep.workerModuleData) {
      dep = dep.workerModuleData
    }
    return dep
  })

  function moduleFunc(...args) {
    // Register this module if needed
    if (!registrationPromise) {
      registrationPromise = callWorker(workerId, 'registerModule', moduleFunc.workerModuleData)
      const unregister = () => {
        registrationPromise = null
        registeredModules[workerId].delete(unregister)
      }
      ;(registeredModules[workerId] || (registeredModules[workerId] = new Set())).add(unregister)
    }

    // Invoke the module, returning a promise
    return registrationPromise.then(({isCallable}) => {
      if (isCallable) {
        return callWorker(workerId, 'callModule', {id, args: [args[0]]}).then(res => {
          const result = { data: {result: res}, target: getWorker(workerId), workerId: workerId};
          if (args[1]) {
            // passed new onMessage function
            args[1](result);
            result.target.onmessage = args[1];
          }

          if (args[2]) {
            result.target.onerror = args[2];
          }

          return result;
        }).catch((err) => {
          if (args[2]) {
            args[2]({data: {result: err}, target: getWorker(workerId), workerId: workerId});
          } else {
            throw new Error(err);
          }
        });
      } else {
        throw new Error('Worker module function was called but `init` did not return a callable function')
      }
    })
  }

  if (scripts.length) {
    for (let i = 0, l = scripts.length; i < l; i++) {
      scripts[i] = self.location.origin + '/' + scripts[i];
    }
  }

  moduleFunc.workerModuleData = {
    isWorkerModule: true,
    id,
    name,
    dependencies,
    properties,
    init: stringifyFunction(init),
    getTransferables: getTransferables && stringifyFunction(getTransferables),
    scripts
  }
  return moduleFunc
}

/**
 * Terminate an active Worker by a workerId that was passed to defineWorkerModule.
 * This only terminates the Worker itself; the worker module will remain available
 * and if you call it again its Worker will be respawned.
 * @param {string} workerId
 */
export function terminateWorker(workerId) {
  // Unregister all modules that were registered in that worker
  if (registeredModules[workerId]) {
    registeredModules[workerId].forEach(unregister => {
      unregister()
    })
  }
  // Terminate the Worker object
  if (workers[workerId]) {
    workers[workerId].terminate()
    delete workers[workerId]
  }
}

/**
 * Stringifies a function into a form that can be deserialized in the worker
 * @param fn
 */
export function stringifyFunction(fn) {
  let str = fn.toString()
  // If it was defined in object method/property format, it needs to be modified
  if (!/^function/.test(str) && /^\w+\s*\(/.test(str)) {
    str = 'function ' + str
  }
  return str
}

export function getWorker(workerId) {
  let worker = workers[workerId];
  if (!worker) {
    // Bootstrap the worker's content
    const bootstrap = stringifyFunction(workerBootstrap);

    // Create the worker from the bootstrap function content
    worker = workers[workerId] = new Worker(
      URL.createObjectURL(
        new Blob(
          [`/** Worker Module Bootstrap: ${workerId.replace(/\*/g, '')} **/\n\n;(${bootstrap})()`],
          {type: 'application/javascript'}
        )
      ),{ name : workerId });
  }

  return worker;
}

// Issue a call to the worker with a callback to handle the response
function callWorker(workerId, action, data) {
  return new Promise((resolve, reject) => {
    const messageId = ++_messageId
    openRequests[messageId] = response => {
      if (response.success) {
        resolve(response.result)
      } else {
        reject(new Error(`Error in worker ${action} call: ${response.error}`))
      }
    }
    const worker = getWorker(workerId);

    // Single handler for response messages from the worker
    worker.onmessage = e => {
      const response = e.data;
      const msgId = response.messageId;
      const callback = openRequests[msgId];
      if (!callback) {
        throw new Error('WorkerModule response with empty or unknown messageId');
      }
      delete openRequests[msgId];
      callback(response);
    }
    if (data.args && data.args[0] && data.args[0].$transfer) {
      worker.postMessage({
        workerId,
        messageId,
        action,
        data
      }, data.args[0].$transfer)
    } else {
      worker.postMessage({
        workerId,
        messageId,
        action,
        data
      })
    }
  })
}

self.defineWorkerModule = defineWorkerModule;
self.terminateWorker = terminateWorker;
self.getWorker = getWorker;