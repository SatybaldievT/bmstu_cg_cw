import * as GlCommands from '../commands/gl-commands';
import { GlAddObject } from '../commands/gl-add-object';
import { GlRemoveObject } from '../commands/gl-remove-object';
import { GlSetPosition } from '../commands/gl-set-position';
import { GlSetRotation } from '../commands/gl-set-rotation';
import { GlSetValue } from '../commands/gl-set-value';
import { GlSetUuid } from '../commands/gl-set-uuid';
import { GlSetScale } from '../commands/gl-set-scale';
import { GlSetScene } from '../commands/gl-set-scene';
import { GlPolylineCmds } from '../commands/gl-polyline-cmds';
import { GlPointsCmds } from '../commands/gl-points-cmds';
import { GlMultiCmds } from '../commands/gl-multi-cmds';
import { GlMeshCmds } from '../commands/gl-mesh-cmds';
import { GlSegmentsCmds } from '../commands/gl-segments-cmds';
import { GlUtils } from '../utils/gl-utils';
import { GlImageCmds } from '../commands/gl-image-cmds';
import { GlSetQuatOffPos } from '../commands/gl-set-quatoffpos';
import { GlPointSamplesCmds } from '@tangens/mining/commands/gl-point-samples-cmds';
import { GlChannelCmds } from '@tangens/mining/commands/gl-channel-cmds';
import { GlNotchCmds } from '@tangens/mining/commands/gl-notch-cmds';
import { GlMeshTrendCmds } from '@tangens/mining/commands/gl-mesh-trend-cmds';

export class GlHistory {

  constructor(glContext) {
    this.glContext = glContext;
    this.undos = [];
    this.redos = [];
    this.lastCmdTime = new Date();
    this.idCounter = 0;

    this.historyDisabled = false;
    this.config = glContext.config;
    this.cmdMgrs = new Map();
    this._historyStackSize = 100;

    this._memoryObj = new Set(); // type of objects that won't be stored in IndexDb
    this._memoryObj.add('GlBlocks');
    this._memoryObj.add('GlBlocksSet');
    this._memoryObj.add('GlMeshSet');
    this._memoryObj.add('GlMesh');
    this._memoryObj.add('GlPointsSet');
    this._memoryObj.add('GlPoints');
  }

  // --------------------------
  // execute
  // --------------------------
  execute(cmd, optionalName, linkedTo) {
    this.glContext.notifyExectuteStatus("start");
    const lastCmd = this.undos[this.undos.length - 1];
    const timeDifference = new Date().getTime() - this.lastCmdTime.getTime();
    const isUpdatableCmd = lastCmd && lastCmd.updatable && cmd.updatable &&
                         lastCmd.object === cmd.object &&
                         lastCmd.type === cmd.type;

    let cmdMgr = this.cmdMgrs.get(cmd.type);
    if (cmdMgr === undefined || cmdMgr.cmd) {
      cmdMgr = this.createCmdMgr(cmd.type);
    }
    if (isUpdatableCmd && timeDifference < 500) {
      cmdMgr.update(lastCmd, cmd);
      cmd = lastCmd;
    } else {
      // the command is not updatable and is added as a new part of the history
      this.undos.push(cmd);

      if (this.undos.length > this._historyStackSize) {
        for (let i = 0; i < this.undos.length - 1; i++) {
          const cmd = this.undos[i];
          if (!cmd.inMemory) {
            let tempCmdMgr = this.cmdMgrs.get(cmd.type);
            if (tempCmdMgr === undefined || tempCmdMgr.cmd) tempCmdMgr = this.createCmdMgr(cmd.type);
            tempCmdMgr.cmd = cmd;
            tempCmdMgr.localStore();
            tempCmdMgr.reset();
          }
        }
        this.undos.splice(0, this._historyStackSize);
        // this.idCounter = this.idCounter - 100;
      }

      cmd.id = ++this.idCounter;
    }

    if (lastCmd && cmd.id !== lastCmd.id || !lastCmd) {
      if (linkedTo && (linkedTo === 'prev' || linkedTo === 'next')) {
        cmd.linkedTo = linkedTo;
      }
    }

    cmdMgr.cmd = cmd;
    cmd.name = (!GlUtils.isEmpty(optionalName)) ? optionalName : cmd.name;

    if (cmd.cmdArray && cmd.cmdArray.length) {
      for (let i = 0; i < cmd.cmdArray.length; i++) {
        // handle Multi
        const cmdArrObj = cmd.cmdArray[i].object;
        if (cmd.cmdArray[i].inMemory) cmd.inMemory = true;
        if (cmd.inMemory) break;

        if (cmdArrObj.isGlGroup) {
          cmdArrObj.traverse((ch) => {
            if (this._memoryObj.has(ch.type)) cmd.inMemory = true;
          });
        } else {
          if (this._memoryObj.has(cmdArrObj.type)) cmd.inMemory = true;
        }
      }
    } else {
      const cmdObject = cmd.object;
      if (cmdObject.isGlGroup) {
        cmdObject.traverse((ch) => {
          if (this._memoryObj.has(ch.type)) cmd.inMemory = true;
        });
      } else {
        if (this._memoryObj.has(cmdObject.type)) cmd.inMemory = true;
      }
    }

    const scope = this;
    const callBack = (currentCmdMgr) => {
      const indexOfCmd = scope.undos.length - 1;

      const update = function(updCmdMgr) {
        scope.lastCmdTime = new Date();
        scope.glContext.notifyHistoryChanged(updCmdMgr.cmd);
        updCmdMgr.reset();
        // clearing all the redo-commands
        scope.redos = [];
      };

      return function(result) {
        return new Promise(function(resolve, reject) {
          const currentCmd = currentCmdMgr.cmd;
          if (result && currentCmd && scope.undos[indexOfCmd] &&
              scope.undos[indexOfCmd].id === currentCmd.id) {
            if (currentCmd.id !== result.cmdId) {
              // const glCmdMngr = new GlCommandMgr();
              // glCmdMngr._cmd = {
              //   object: result
              // };

              currentCmdMgr.localStore();
              reject(new Error("Could not save object"));
            }

            if (currentCmd.cmdArray) {
              for (let i = 0; i < currentCmd.cmdArray.length; i++) {
                currentCmd.cmdArray[i] = currentCmd.cmdArray[i].object.uuid;
              }
            }

            // loop and remove references of objects
            for (let i = 0; i < scope.undos.length; i++) {
              const object = scope.undos[i].object;
              if (object && object.uuid) {
                if (currentCmd.object && currentCmd.object.uuid === object.uuid) {
                  scope.undos[i].object = object.uuid;
                } else if (currentCmd.cmdArray && currentCmd.cmdArray.includes(object.uuid)) {
                  scope.undos[i].object = object.uuid;
                }
              }
            }

            currentCmd.object = result;
            currentCmd.inMemory = false;
            update(currentCmdMgr);
            resolve(true);
          }
        });
      };
    };

    if (!cmd.inMemory && window.Worker) {
      GlHistory.lockEnabled = true;
      try {
        cmdMgr.execute();
        cmdMgr.localStore(callBack(cmdMgr))
        .then(res => {
          GlHistory.lockEnabled = false;
          scope.glContext.notifyExectuteStatus("end");
        });
      } catch (err) {
        GlHistory.lockEnabled = false;
        scope.glContext.notifyExectuteStatus("end");
        return err;
      }
      return;
    }

    cmdMgr.execute();
    cmdMgr.reset();
    this.lastCmdTime = new Date();

    // clearing all the redo-commands
    // this.redos = [];
    this.glContext.notifyHistoryChanged(cmd);
    this.glContext.notifySceneGraphChanged();
    this.glContext.notifyExectuteStatus("end");
  }

  // --------------------------
  // undo
  // --------------------------
  undo() {
    if (this.historyDisabled || GlHistory.lockEnabled) {
      return;
    }

    let notifyUndoEnd = false;

    const scope = this;
    const callBack = (currentCmdMgr, needNotify = true) => {

      const update = (cmdMgr, needNotify) => {
        cmdMgr.undo();
        scope.redos.push(cmdMgr.cmd);
        cmdMgr.reset();
        if (needNotify) {
          scope.glContext.notifyHistoryChanged(cmdMgr.cmd);
          scope.glContext.notifySceneGraphChanged();
        }
        return cmdMgr.cmd;
      };

      return function(result) {
        return new Promise(() => {
          if (result) {
            const currentCmd = currentCmdMgr.cmd;
            if (!currentCmd || currentCmd.object && (currentCmd.object.id !== result.id)) {
              console.log("something went wrong");
              return;
            }

            currentCmdMgr.fromJSON(result.docs);
            const arr = (currentCmd.cmdArray) ? currentCmd.cmdArray : [{object: currentCmd.object}];
            for (let i = 0; i < scope.undos.length;i++) {
              const currentUndo = scope.undos[i];
              if (currentUndo.object) {
                const index = arr.findIndex((curarr)=>{return currentUndo.object === curarr.object.uuid});
                if (index != -1) {
                  currentUndo.object = arr[index].object;
                }
              }
            }
            return update(currentCmdMgr, needNotify);
          }
        });
      };
    };

    let cmd = undefined;
    let cmdMgr = undefined;

    let bContinue = false;
    // this.glContext.notifyUndoStatus("start");
    // notifyUndoEnd = true;
    do {
      if (this.undos.length > 0) {
        cmd = this.undos.pop();
        const lastCmd = this.undos[this.undos.length - 1];

        bContinue = cmd.linkedTo === 'prev' || (lastCmd && lastCmd.linkedTo === "next") && this.undos.length > 0;

        // prepare an appropriate command manager
        cmdMgr = this.cmdMgrs.get(cmd.type);
        if (cmdMgr === undefined || cmdMgr.cmd) cmdMgr = this.createCmdMgr(cmd.type);
        cmdMgr.cmd = cmd;

        if (!cmd.inMemory && window.Worker) {
          // notifyUndoEnd = false;
          this.glContext.notifyUndoStatus("start");
          cmdMgr.localStore(callBack(cmdMgr, !bContinue))
          .then((res) => {
            console.log("undo was clicked");
            scope.glContext.notifyUndoStatus("end");
          })
          .catch(err => {
            console.log(err);
            scope.glContext.notifyUndoStatus("end");
          });

        } else {
          cmdMgr.undo();
          this.redos.push(cmd);
          cmdMgr.reset();
          if (!bContinue) {
            this.glContext.notifyHistoryChanged(cmd);
            this.glContext.notifySceneGraphChanged();
          }
        }
      } else {
        bContinue = false;
      }
    } while (bContinue);

    // if (notifyUndoEnd) {
    //   this.glContext.notifyUndoStatus("end");
    // }
  }

  // --------------------------
  // redo
  // --------------------------
  redo() {
    if (this.historyDisabled || GlHistory.lockEnabled) {
      return;
    }

    let cmd = undefined;
    let bContinue = false;
    do {
      if (this.redos.length > 0) {
        cmd = this.redos.pop();
        const lastCmd = this.redos[this.redos.length - 1];

        bContinue = cmd.linkedTo === 'next' || (lastCmd && lastCmd.linkedTo === "prev") && this.redos.length > 0;

        this.execute(cmd);
      } else {
        bContinue = false;
      }
    } while(bContinue);
    // if (this.redos.length > 0) {
      // cmd = this.redos.pop();
      // prepare an appropriate command manager
      // cmdMgr = this.cmdMgrs.get(cmd.type);
      // if (cmdMgr === undefined || cmdMgr.cmd) cmdMgr = this.createCmdMgr(cmd.type);
      // cmdMgr.cmd = cmd;

      // if (cmd.inMemory === false) {
      //   cmdMgr.fromJSON(cmd.json);
      // }
    // }

    // if (cmd !== undefined && cmdMgr !== undefined) {
    //   cmdMgr.execute();
    //   this.undos.push(cmd);
    //   this.glContext.notifyHistoryChanged(cmd);
    //   this.glContext.notifySceneGraphChanged();

    //   cmdMgr.reset();
    // }

    // return cmd;
  }

  // --------------------------
  // toJSON
  // --------------------------
  toJSON() {
    const history = {
      undos: [],
      redos: []
    };

    if (!this.config.getKey('settings/history')) {
      return history;
    }

    // Append Undos to History
    for (let i = 0; i < this.undos.length; i++) {
      if (this.undos[i].hasOwnProperty("json")) {
        history.undos.push(this.undos[i].json);
      }
    }

    // Append Redos to History
    for (let i = 0; i < this.redos.length; i++) {
      if (this.redos[i].hasOwnProperty("json")) {
        history.redos.push(this.redos[i].json);
      }
    }

    return history;
  }

  // --------------------------
  // fromJSON
  // --------------------------
  fromJSON(json) {
    if (json === undefined) return;

    //
    for (let i = 0; i < json.undos.length; i++) {
      const cmdJSON = json.undos[i];

      const cmd = new GlCommands[cmdJSON.type](); // creates a new object of type "json.type"

      cmd.json = cmdJSON;
      cmd.id = cmdJSON.id;
      cmd.name = cmdJSON.name;

      this.undos.push(cmd);
      this.idCounter = (cmdJSON.id > this.idCounter) ? cmdJSON.id : this.idCounter; // set last used idCounter
    }

    //
    for (let i = 0; i < json.redos.length; i++) {
      const cmdJSON = json.redos[i];

      const cmd = new GlCommands[cmdJSON.type](); // creates a new object of type "json.type"
      cmd.json = cmdJSON;
      cmd.id = cmdJSON.id;
      cmd.name = cmdJSON.name;

      this.redos.push(cmd);
      this.idCounter = (cmdJSON.id > this.idCounter) ? cmdJSON.id : this.idCounter; // set last used idCounter
    }

    // Select the last executed undo-command
    this.glContext.notifyHistoryChanged(this.undos[this.undos.length - 1]);
  }

  // --------------------------
  // clear
  // --------------------------
  clear() {

    for (let i = 0; i < this.undos.length; i++) {
      if (!this.undos[i].inMemory) {
        const cmd = this.undos[i];
        let cmdMgr = this.cmdMgrs.get(cmd.type);
        if (cmdMgr === undefined || cmdMgr.cmd) cmdMgr = this.createCmdMgr(cmd.type);
        cmdMgr.cmd = cmd;
        cmdMgr.localStore();
      }
    }

    this.undos = [];
    this.redos = [];
    this.idCounter = 0;
    this.glContext.notifyHistoryChanged();
  }

  // --------------------------
  // goToState
  // --------------------------
  goToState(id) {
    if (this.historyDisabled) {
      return;
    }

    this.glContext.disableRendering();
    this.glContext.disableHistoryChanges();

    let cmd = this.undos.length > 0 ? this.undos[this.undos.length - 1] : undefined;  // next cmd to pop

    if (cmd === undefined || id > cmd.id) {
      cmd = this.redo();
      while (cmd !== undefined && id > cmd.id) {
        cmd = this.redo();
      }

    } else {
      while (true) {
        cmd = this.undos[this.undos.length - 1];  // next cmd to pop
        if (cmd === undefined || id === cmd.id) break;
        this.undo();
      }
    }

    this.glContext.enableRendering();
    this.glContext.enableHistoryChanges();
    this.glContext.enableHistoryExecuteStatus();
    this.glContext.enableHistoryUndoStatus();

    this.glContext.notifyHistoryChanged(cmd);
    this.glContext.notifySceneGraphChanged();
  }

  // --------------------------
  // enableSerialization
  // --------------------------
  enableSerialization(id) {
    // because there might be commands in this.undos and this.redos
    // which have not been serialized with .toJSON() we go back
    // to the oldest command and redo one command after the other
    // while also calling .toJSON() on them.

    this.goToState(- 1);

    this.glContext.disableRendering();
    this.glContext.disableHistoryChanges();

    let cmd = this.redo();
    while (cmd !== undefined) {
      if (!cmd.hasOwnProperty("json")) {

        // prepare an appropriate command manager
        let cmdMgr = this.cmdMgrs.get(cmd.type);
        if (cmdMgr === undefined || cmdMgr.cmd) cmdMgr = this.createCmdMgr(cmd.type);
        cmdMgr.cmd = cmd;

        cmd.json = cmdMgr.toJSON();
        cmdMgr.reset();
      }

      cmd = this.redo();
    }

    this.glContext.enableRendering();
    this.glContext.enableHistoryChanges();

    this.goToState(id);
  }

  // --------------------------
  // createCmdMgr
  // --------------------------
  createCmdMgr(cmdType) {
    let cmdMgr;
    switch (cmdType) {
      case 'CmdAddObject':
        cmdMgr = new GlAddObject(this.glContext);
        break;

      case 'CmdRemoveObject':
        cmdMgr = new GlRemoveObject(this.glContext);
        break;

      case 'CmdSetPosition':
        cmdMgr = new GlSetPosition(this.glContext);
        break;

      case 'CmdPolyline':
        cmdMgr = new GlPolylineCmds(this.glContext);
        break;

      case 'CmdPoints':
        cmdMgr = new GlPointsCmds(this.glContext);
        break;

      case 'CmdPointSamples':
        cmdMgr = new GlPointSamplesCmds(this.glContext);
        break;

      case 'CmdChannel':
        cmdMgr = new GlChannelCmds(this.glContext);
        break;

      case 'CmdNotch':
        cmdMgr = new GlNotchCmds(this.glContext);
        break;

      case 'CmdMulti':
        cmdMgr = new GlMultiCmds(this.glContext, this);
        break;

      case 'CmdSetRotation':
        cmdMgr = new GlSetRotation(this.glContext);
        break;

      case 'CmdSetQuatOffPos':
        cmdMgr = new GlSetQuatOffPos(this.glContext);
        break;
        
      case 'CmdSetScale':
        cmdMgr = new GlSetScale(this.glContext);
        break;

      case 'CmdSetScene':
        cmdMgr = new GlSetScene(this.glContext);
        break;

      case 'CmdSetUuid':
        cmdMgr = new GlSetUuid(this.glContext);
        break;

      case 'CmdSetValue':
        cmdMgr = new GlSetValue(this.glContext);
        break;

      case 'CmdImage':
        cmdMgr = new GlImageCmds(this.glContext);
        break;

      case 'CmdMesh':
        cmdMgr = new GlMeshCmds(this.glContext);
        break;

      case 'CmdSegments':
        cmdMgr = new GlSegmentsCmds(this.glContext);
        break;

      case 'CmdMeshTrend':
        cmdMgr = new GlMeshTrendCmds(this.glContext);
        break;
    }

    if (cmdMgr !== undefined) {
      this.cmdMgrs.set(cmdType, cmdMgr);
    }

    return cmdMgr;
  }
}

GlHistory.lockEnabled = false;
