import {
  UVMapping,
  CubeReflectionMapping,
  CubeRefractionMapping,
  EquirectangularReflectionMapping,
  EquirectangularRefractionMapping,
  // SphericalReflectionMapping,
  CubeUVReflectionMapping,
  // CubeUVRefractionMapping,
  RepeatWrapping,
  ClampToEdgeWrapping,
  MirroredRepeatWrapping,
  NearestFilter,
  NearestMipmapNearestFilter,
  NearestMipmapLinearFilter,
  LinearFilter,
  LinearMipmapNearestFilter,
  LinearMipmapLinearFilter,
} from 'three';

/* eslint-disable no-undef */
export const DefaultFont = 'assets/fonts/Roboto-Regular.ttf';

export const GlOrientation = {
  LookingUp: 0,
  LookingDown: 1,
  LookingWest: 2,
  LookingEast: 3,
  LookingNorth: 4,
  LookingSouth: 5,
  TransformSection: 6,
  Arbitrary: 7
};

export const GlClickMode = {
  None: 0,
  Select: 1,
  SelectArea: 2,
  Edit: 3,
  Transform: 4
};

export const GlAxis = {
  X: 0,
  Y: 1,
  Z: 2,
};

export const GlSnapMode = {
  None: 0,
  Points: 1,
  Lines: 2,
  All: 3,
  Perpendicular: 4,
  Bisector: 5,
};

export const GlPolyProjActions = {
  None: 0,
  MirrorProj: 1,
  VerticalProj: 2,
  HorizontalProj: 3,
}

export const GlPointAction = {
  None: 0,
  Set: 1,
  Add: 2,
  Insert: 3,
  InsertRanges: 4,
  Delete: 5,
  DeleteRanges: 6,
  ClosePoly: 7,
  OpenPoly: 8,
  Reverse: 9,
  CreateHatch: 10,
  RemoveHatch: 11,
  UpdateHatchImage: 12,
  SetAzimuth: 13,
  SetDip: 14,
  SetLength: 15,
  SetCollarSurvey: 16,
  transformRanges: 17,
};

export const GlImageAction = {
  None: 0,
  BindCoords: 1,
  Transform: 2,
}

export const GlMeshAction = {
  None: 0,
  AddFace : 1,
  DeleteFace: 2,
  AddPoint: 3,
  DeletePoint: 4,
  SetPoint: 5,
}

export const GlMeshTrendAction = {
  MoveNode: 0,
  AddBorder: 1,
  AddTriangle: 3,
  DeleteBorder: 4,
  DeleteTriangle: 5,
}

export const TrimAction = {
  CutPolylineByPolylines: 0,
  StretchPolyline: 1
}

export const LabelField = {
  X: 'X',
  Y: 'Y',
  Z: 'Z',
  MARK: 'Label'
};

export const MeshAttributeType = {
  POSITION: 1,
  COLOR: 2,
  NORMAL: 3,
  UV: 4
};

export const GlAttributeType = {
  Vertex: 1,
  Edge: 2,
  Mesh: 3
};

export const GlAttributeValueType = {
  Number: 1,
  String: 2,
  Boolean: 3,
  NumberArray: 4,
  StringArray: 5,
  BooleanArray: 6,
  Array: 7,
  Object: 8,
  BufferArray: 9,
};

export const LabelAlignment = {
  ALIGN_LEFT: 0,
  ALIGN_CENTER: 1,
  ALIGN_RIGHT: 2
};

export const GlEditorActions = {
  Select: 0,
  Move: 1,
  Delete: 2,
  Insert: 4,
  Add: 8,
  Create: 16,
  Copy: 32,
  SplitOnPoint: 64,
  SplitOnSegment: 128,
  SceneCenter: 256,
  Edit: 512,
  SelectPoint: 1024,
  FlipNormal: 2048
};

export const GlDynamicInput = {
  None: 0,
  CartesianAbs: 1,
  PolarAbs: 2,
  CartesianRel: 4,
  PolarRel: 8,
  SectionTool: 16,
  Transform: 32,
  Custom: 64
};

export const GlTransformControlMode = {
  Translate: 1,
  Rotate: 2,
  Scale: 3,
}

export const GlTextInput = {
  None: 0,
  Create: 1,
  Edit: 2,
};

export const GlObjectFactoryType = {
  Circle : 1,
  Rectangle : 2,
  Arrow : 3,
  LinearDimension: 4,
  AlignedDimension : 5,
  AngularDimension : 6,
  Ellipse : 7,
}

export const GlEdge = {
  Top: 0,
  Right: 1,
  Bottom: 2,
  Left: 3
};

export const GlIntersectionState = {
  Ordinary: 0,
  S1StartOnS2Start: 1,
  S1StartOnS2End: 2,
  S1EndOnS2Start: 3,
  S1EndOnS2End: 4,
  S1StartOnS2: 5,
  S1EndOnS2: 6,
  S2StartOnS1: 7,
  S2EndOnS1: 8,
  Inside: 9
};

export const GlWallType = {
  Left: 0,
  Right: 1,
  Floor: 2,
  FloorStart: 3,
  FloorEnd: 4,
};

export const GlSectionType = {
  Single: 0,
  Multi: 1,
  Poly: 2
};


export const GlSceneControlState = {
  ZoomAndPan: 0,
  FitToScene: 1,
  Rotate: 2,
  PanMove: 3,
  PanEnd: 4,
  Focus: 5,
  Zoom: 6
}

// Axis scale type
export const AxisScale = {
  Linear: 0,
  Logarithmic: 1,
  Probability: 2,
  Category: 3
};

export const ThemeType = {
  ColorField: 0,
  Attribute: 1,
  Color: 2,
  Gradient: 3,
  Confidence: 4,
};

export const MarkerShape = {
  Square: 0,
  Circle: 1,
  Diamond: 2
}

export const Distribution = {
  Uniform: 0,
  Normal: 1,
  LogNormal: 2,
  Exponential: 3,
  Custom: 4
};

export const ChartType = {
  Quantile: 0,
  Probability: 1,
  Histogram: 2,
  CumFrequency: 3
};

export const RegressionType = {
Linear: 0,
Exponential: 1,
Logarithmic: 2,
Polynomial: 3,
Power: 4
};

export const Orientation = {
  North: 0,
  East: 1,
  South: 2,
  West: 3
}

export const HatchPolygonOffset = {
  Default: -1,
  Lithology: -2,
  Mineralization: -3,
  Alteration: -4,
  AutoCAD: -5,
}

export const Transformation = {
  None: 0,
  Uniform: 1,
  NaturalLog: 2,
  Indicator: 3
}

export const Direction = {
  Downhole: 0,
  Omnidirect: 1,
  Directional: 2
}

export const VariogramType = {
  Variogram: 0,
  PWR_Variogram: 1,
}

export const VariogramModelType = {
  Linear: 0,
  Spherical: 1,
  Exponential: 2,
  Gaussian: 3,
}

export const TEXTURE_MAPPING = {
  UVMapping: UVMapping,
  CubeReflectionMapping: CubeReflectionMapping,
  CubeRefractionMapping: CubeRefractionMapping,
  EquirectangularReflectionMapping: EquirectangularReflectionMapping,
  EquirectangularRefractionMapping: EquirectangularRefractionMapping,
  // SphericalReflectionMapping: SphericalReflectionMapping,
  CubeUVReflectionMapping: CubeUVReflectionMapping,
  // CubeUVRefractionMapping: CubeUVRefractionMapping
};

export const TEXTURE_WRAPPING = {
  RepeatWrapping: RepeatWrapping,
  ClampToEdgeWrapping: ClampToEdgeWrapping,
  MirroredRepeatWrapping: MirroredRepeatWrapping
};

export const TEXTURE_FILTER = {
  NearestFilter: NearestFilter,
  NearestMipmapNearestFilter: NearestMipmapNearestFilter,
  NearestMipmapLinearFilter: NearestMipmapLinearFilter,
  LinearFilter: LinearFilter,
  LinearMipmapNearestFilter: LinearMipmapNearestFilter,
  LinearMipmapLinearFilter: LinearMipmapLinearFilter
};

export const Primitive_Type = {
  Object: 1,
  ObjectString: 2,
  Int8: 3,
  Uint8: 4,
  Uint8Array: 5,
  Int32: 6,
  Uint32: 7,
  Int32Array: 8, 
  Uint32Array: 9,
  Number: 10, // TODO
  Float32: 11,
  Float64: 12,
  Array: 13, // TODO
  ArrayOfObject: 14, // read as Int32
  Float32Array: 15,
  Float64Array: 16,
  String: 17,
  Blob: 18, // TODO
  StringArray: 19, // TODO
  Int16: 20,
  Uint16: 21,
  Int16Array: 22,
  Uint16Array: 23,
  Int8Array: 24,
}

export const Tool_Types = {
  GlPolylineEditor: "GlPolylineEditor",
  GlSelectionBox: "GlSelectionBox",
  GlMeasureTool: "GlMeasureTool",
  GlTransformControlsHandler: "GlTransformControlsHandler",
  GlObjectFactoryEditor: "GlObjectFactoryEditor",
  GlDimensionEditor: "GlDimensionEditor",
  GlPointsEditor: "GlPointsEditor",
  GlSectionTool: "GlSectionTool",
  GlPolyProjectionTool: "GlPolyProjectionTool",
  GlTextEditor: "GlTextEditor",
  GlImageEditor: "GlImageEditor",
  GlTraceEditor: "GlTraceEditor",
  GlMeshEditor: "GlMeshEditor",
  GlWallEditor: "GlWallEditor",
  GlWorkingPlane: "GlWorkingPlane",
  GlMeshTrendEditor: "GlMeshTrendEditor",
  TrimEditor: "TrimEditor",
  VariogramEditor: "VariogramEditor"
}

// priority list for tools
export const Tool_Priority = {
  GlSelectionBox: 0,

  GlMeasureTool: 1,
  GlPolylineEditor: 1,
  GlSectionTool: 1,
  GlTraceEditor: 1,
  GlWallEditor: 1,
  GlTextEditor: 1,
  GlObjectFactoryEditor: 1,
  GlDimensionEditor: 1,
  GlMeshEditor: 1,
  GlMeshTrendEditor: 1,
  GlPolyProjectionTool: 1,
  GlImageEditor: 1,
  GlPointsEditor: 1,
  GlWorkingPlane: 1,
  TrimEditor: 1,
  VariogramEditor: 1,

  GlTransformControlsHandler: 1
}