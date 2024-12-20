import { KdUtils } from './kd-utils';
import { GlPolyline } from '../../lib/core/gl-polyline'
import { Vector3 } from 'three';

// creates map from distinct (in neighbourhood of epsilon) points to segments
function createGraph(segments, kdTree) {
  const graph = new Map();
  const existingPoints = [];
  const epsilon = 1e-6;

  for (const segment of segments) {

    let start = segment.start;
    let end = segment.end;

    let existingStart = findExistingPoint(kdTree, segment.start, epsilon);
    let existingEnd = findExistingPoint(kdTree, segment.end, epsilon);
    // if start and end both don't exist already AND they are closer than epsilon,
    // then both will be inserted resulting sort of in a duplicate point, but it only happens for the first segment,

    // so I don't know if I should address that

    if (existingStart) {
      start = existingPoints[existingStart.pos];
      // set existing start to segment start, so that when I traverse I know
      // when two points are the same without calculating distance
    }
    if (existingEnd) {
      end = existingPoints[existingEnd.pos];
    }
    const new_vector = new Vector3(24805.08492076739, 15896.660833370393, 1595.4291140581322);

    if (start.equals(new_vector) || end.equals(new_vector)) {
      debugger;
    }
    if (start.equals(end)) {
      segment.break = true;
      continue;
    }
    if (!graph.has(start)) {
      graph.set(start, new Set());
      existingPoints.push(start);
      kdTree.insert.call(kdTree, start.toArray());
    }
    if (!graph.has(end)) {
      graph.set(end, new Set());
      existingPoints.push(end);
      kdTree.insert.call(kdTree, end.toArray());
    }


    graph.get(start).add(end);
    graph.get(end).add(start);
  }

  return graph;
}

function _printGraphInDot(graph) {
  let dot = "digraph G {\n";
  for (const [key, value] of graph.entries()) {
    dot += `  "${key.toArray().join(' ')}" [label="${key.toArray().join(' ')}"]\n`;
    for (const segment of value) {
      if (segment.point)
        dot += `  "${key.toArray().join(' ')}" -> "${segment.point.toArray().join(' ')}" [label = "${segment.length}" ] \n`;
      else dot += `  "${key.toArray().join(' ')}" -> "${(segment.point ? segment.point.toArray().join(' ') : segment.toArray().join(' '))}"\n`;
    }
  }
  dot += "}\n";
  return dot;
}

function findExistingPoint(kdTree, point, epsilon) {
  const result = kdTree.nearest(point.isVector3 ? point.toArray() : point, 1, epsilon);
  return result[0] ? result[0][0] ?? null : null;
}

function traverseAndBuildPolyline(currentPoint, graph, greyPoint, blackPoint, NotSimplePoint, customSort) {
  const polyline = [];
  let lastPoint = currentPoint;

  while (true) {
    const nextPoints = [...graph.get(currentPoint)].filter(s => !greyPoint.includes(s) && !NotSimplePoint.has(s) && !blackPoint.includes(s));
    nextPoints.sort((a, b) => (a.clone().sub(currentPoint).length() - b.clone().sub(currentPoint).length()))
    if (nextPoints.length === 0) {

      const finishPoints = [...graph.get(currentPoint)].filter(s => !blackPoint.includes(s) && NotSimplePoint.has(s));
      if (finishPoints.length !== 0) polyline.push(finishPoints[0]);
      break;
    }
    if (nextPoints.length === 1) blackPoint.push(currentPoint);

    const nextPoint = nextPoints[0];

    if (customSort) {
      customSort(nextPoint, lastPoint);
    }

    greyPoint.push(nextPoint);

    currentPoint = nextPoint;
    polyline.push(nextPoint);

  }

  return polyline;
}

function dfs(graph, visited, start) {
  const stack = [start];
  const points = new Map();

  while (stack.length > 0) {
    const current = stack.pop();

    if (!visited.includes(current)) {
      visited.push(current);

      points.set(current, graph.get(current)); // Выводим текущую вершину

      const neighbors = graph.get(current);
      if (neighbors.size > 0) {
        for (let neighbor of neighbors) {
          const neighbor_ = neighbor.point ? neighbor.point : neighbor;
          if (!visited.includes(neighbor_)) {
            stack.push(neighbor_);
          }
        }
      }
    }
  }
  return points;
}

function minimizeGraph(graph) {
  const NEW_graph = new Map();
  const greyPoint = [];
  const blackPoint = [];
  const polylines = [];
  const NotSimplePoint = new Map();
  graph.forEach((value, key) => {
    if (value.size != 2) NotSimplePoint.set(key, value);
  });
  graph.isperimeter = true;
  //console.log(print_graph_inDot(NotSimplePoint));
  for (const [segment, wtf] of NotSimplePoint) {
    //for (const segment of segments) {
    blackPoint.push(segment);
    const _wtf = [...wtf].sort((a, b) => (a.clone().sub(segment).length() - b.clone().sub(segment).length()));
    for (const a of _wtf) {
      if (greyPoint.includes(a)) continue;
      greyPoint.push(a);
      let polylineFromStart = [];
      if (!NotSimplePoint.has(a)) {
        polylineFromStart = traverseAndBuildPolyline(a, graph, greyPoint, blackPoint, NotSimplePoint, /* customSort */);
        //polylineFromStart.reverse();     
        const polyline = [segment, a, ...polylineFromStart];
        polylines.push(polyline);
      }
      else {
        if (blackPoint.includes(a)) continue;
        const polyline = [segment, a, ...polylineFromStart];
        polylines.push(polyline);
      }
    }

  }
  //new simplify graph
  for (let i = 0; i < polylines.length; i++) {
    const start = polylines[i][0];
    const end = polylines[i][polylines[i].length - 1];
    if (!NEW_graph.has(start)) {
      NEW_graph.set(start, new Set());
    }
    if (!NEW_graph.has(end)) {
      NEW_graph.set(end, new Set());
    }
    NEW_graph.get(start).add({ point: end, length: polylines[i].length, polyline: polylines[i] });
    NEW_graph.get(end).add({ point: start, length: polylines[i].length, polyline: polylines[i] });
  }

  const oter_point = new Map();

  for (const [key, value] of graph) {
    if (!greyPoint.includes(key) && !blackPoint.includes(key)) {
      oter_point.set(key, value);
    }
  }

  return { minimizeGraph: NEW_graph, perfectGraph: oter_point };
}

function groupGraph(graph) {
  const graphs = [];
  const visited = [];
  for (const [key, value] of graph) {
    if (visited.includes(key)) continue;
    const newGraph = dfs(graph, visited, key);
    graphs.push(newGraph);
  }
  return graphs;
}

function maxLengthWay(graph) {
  const polylines = [];
  const visited = new Set();
  const blackPoint = new Set(); // черные точки
  const end = new Set();

  graph.forEach((value, key) => {
    if (value.size === 1 && !visited.has(key)) {
      end.add(key);
    }
  });

  function findPath(startPoint) {
    let currentPoint = startPoint;
    const polyline = [];
    const polylineFromStart = [];

    while (true) {
      visited.add(currentPoint);
      const selected = [...graph.get(currentPoint)]
      const nextPoints = selected.filter(s => !visited.has(s.point));

      if (nextPoints.length === 0) {

        let finishPoints = selected.filter(s => !polyline.includes(s.point) && !blackPoint.has(s.point))
        finishPoints = finishPoints.sort((a, b) => {
          if (end.has(a.point) && !end.has(b.point)) {
            return 1;
          } else if (end.has(b.point) && !end.has(a.point)) {
            return -1;
          }
          return 0;
        })

        if (finishPoints.length !== 0) {
          if (finishPoints[0].point === finishPoints[0].polyline[0]) {
            polyline.push(...finishPoints[0].polyline.reverse());
          }
          else {
            polyline.push(...finishPoints[0].polyline);
          }
        }
        blackPoint.add(currentPoint); // помечаем точку как черную, если путь завершается
        break;
      }

      nextPoints.sort((a, b) => b.length - a.length);
      const nextPoint = nextPoints[0].point;

      if (nextPoints[0].point === nextPoints[0].polyline[0]) {
        polyline.push(...nextPoints[0].polyline.reverse());
        polylineFromStart.push(nextPoints[0].point);
      } else {
        polyline.push(...nextPoints[0].polyline);
        polylineFromStart.push(nextPoints[0].point);
      }

      if ([...graph.get(currentPoint)].filter(s => !visited.has(s.point)).length === 1) {
        blackPoint.add(currentPoint);
      }

      currentPoint = nextPoint;
    }

    polylines.push(polyline);
  }

  // Находим длиннейшие пути из тупиковых точек
  end.forEach((startPoint) => {
    if (!visited.has(startPoint)) {
      blackPoint.add(startPoint);
      findPath(startPoint);
    }
  });

  // Продолжаем поиск путей из оставшихся точек
  graph.forEach((_, startPoint) => {
    if (!visited.has(startPoint)) {

      findPath(startPoint);
    }
  });

  return polylines;
}

export function mergeSegmentsToPolyline(segments, is_longer = true) {
  //console.log(segments.length);
  const metric = (a, b) => {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return dx * dx + dy * dy + dz * dz;
  };

  const kdTree = new KdUtils.KdTree(new Float64Array(), metric, 3);
  const graph = createGraph(segments, kdTree);
  //console.log(print_graph_inDot(graph));
  // const connectedGraphGroup_ = groupGraph(graph);
  /* for (const gr of connectedGraphGroup_) {
     console.log(print_graph_inDot(gr));
   }*/
  const minimizedGraph = minimizeGraph(graph);

  //console.log(print_graph_inDot(minimizedGraph.minimizeGraph));
  const connectedGraphGroup = groupGraph(minimizedGraph.minimizeGraph);
  // for (const gr of connectedGraphGroup) {
  //  console.log(print_graph_inDot(gr));
  // }
  
  const customSort = (nextSegments, lastSegment) => { }
  let polylines = [];
  for (const gr of connectedGraphGroup) {
    polylines.push(...maxLengthWay(gr));
  }

  const perfectGraph = minimizedGraph.perfectGraph;
  const grey = [];
  const black = [];
  const NotSimple = new Map();
  for (const [key, value] of perfectGraph) {
    const polyline = [];
    if (black.includes(key)) continue;
    grey.push(key);
    let polylineFromStart = [];
    let polylineFromEnd = [];
    //polylineFromStart = traverseAndBuildPolyline(key,perfectGraph, grey,black,NotSimple, customSort);
    polylineFromEnd = traverseAndBuildPolyline(key, perfectGraph, grey, black, NotSimple, customSort);
    polylineFromEnd.sort((a, b) => a.length - b.length)
    //polylineFromStart.reverse();
    polyline.push(key, ...polylineFromEnd, key);
    polylines.push(polyline);
  }

  function len(polyline) {
    let len = 0;
    const v = new Vector3();
    for (let i = 0; i < polyline.length - 1; i++) {
      const point = polyline[i];
      const nextPoint = polyline[i + 1];


      len += v.subVectors(point, nextPoint).length();;
    }
    return len;
  }

  const glPolylines = [];
  for (const polyline of polylines) {
    if (polyline.length < 2 || len(polyline) < 1e-6) {
      continue;
    }
    const points = [...polyline];
    const glPolyline = new GlPolyline();
    glPolyline.addPoints(points);
    glPolylines.push(glPolyline);
  }

  return glPolylines;
}