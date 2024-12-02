export const GlEvents = {
  sceneGraphRenderingEnabled: true,
  historyChangesEnabled: true,
  historyExecuteStatusEnabled: true,
  historyUndoStatusEnabled: true,
  sceneGraphChanged: "gl-scene-graph-changed",
  sceneBackgroundChanged: "gl-scene-background-changed",
  sceneRotateEnabled: true,

  cameraChanged: "gl-camera-changed",

  objectAdded: "gl-object-added",
  objectSelected: "gl-object-selected",
  objectDeselected: "gl-object-deselected",
  objectFocused: "gl-object-focused",
  objectChanged: "gl-object-changed",
  objectRemoved: "gl-object-removed",

  layerAdded: "gl-layer-added",
  layerRemoved: "gl-layer-removed",
  layerSelected: "gl-layer-selected",
  layerDeselected: "gl-layer-deselected",
  layerChanged: "gl-layer-changed",

  helperAdded: "gl-helper-added",
  helperRemoved: "gl-helper-removed",

  sceneInitialized: "scene-initialized",
  sceneReset: "scene-reset",
  dynamicInputSet: "dynamic-input-set",
  dynamicInputReset: "dynamic-input-reset",
  windowResized: "gl-window-resized",
  historyChanged: "gl-history-changed",
  executeStatus: "gl-execute-status",
  undoStatus: "gl-undo-status",
  viewModeChanged: "gl-view-mode-changed",
  clearGlScene: "gl-clear-scene",
  refreshGlScene: "gl-refresh-scene",
  clickModeChanged: "gl-click-mode-changed",
  snapModeChanged: "gl-snap-mode-changed",

  controlChange: "change",
  loadJSON: "gl-load-JSON",

  measure: "gl-measure",
  measureStart: "gl-measurestart",
  measureEnd: "gl-measureend",
  measureOver: "gl-measureover",

  selectionStart: "gl-selection-start",
  selection: "gl-selection",
  selectionEnd: "gl-selection-end",

  actionHandling: "gl-action-handling",
  actionStart: "gl-action-start",
  actionEnd: "gl-action-end",
  actionSet: "gl-action-set",
  actionReset: "gl-action-reset",

  toolActivated: "gl-tool-activated",
  toolDeactivated: "gl-tool-deactivated",

  mouseMove: "gl-mouse-move",
  mouseDown: "gl-mouse-down",
  mouseUp: "gl-mouse-up",

  tabPanelChanged: "gl-tab-panel-changed",

  sectionLoaded: "gl-section-loaded",
  sectionSet: "gl-section-set",

  gridHelperUpdated: "update-grid",

  pinWorkingPlane: "pin-work-plane",
  showWorkingPlane: "show-work-plane"
};