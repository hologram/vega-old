var dl = require('datalib'),
    Tuple = require('vega-dataflow').Tuple,
    log = require('vega-logging'),
    Transform = require('./Transform'),
    BatchTransform = require('./BatchTransform');

function Label(graph) {
  BatchTransform.prototype.init.call(this, graph);
  Transform.addParameters(this, {
    buffer:  {type: 'value', default: 10},
    anchor:  {type: 'value', default: 'auto'},
    offset:  {type: 'value', default: 10},
    color:   {type: 'value', default: 'black'},
    opacity: {type: 'value', default: 1},
    align:   {type: 'value', default: 'center'}
  });

  return this.mutates(true);
}

var prototype = (Label.prototype = Object.create(BatchTransform.prototype));
prototype.constructor = Label;

function boxInBox(small, big) {
  console.log(small, big);
  return small.x1 >= big.x1 &&
         small.x2 <= big.x2 &&
         small.y1 >= big.y1 &&
         small.y2 <= big.y2;
}

prototype.batchTransform = function(input, data) {
  var buffer  = this.param('buffer'),
      anchor  = this.param('anchor'),
      offset  = this.param('offset'),
      align   = this.param('align'),
      color   = this.param('color'),
      opacity = this.param('opacity');

  var labels = data;
  var allLabels = labels[0].mark.items;
  
  labels.forEach(function(label, idx, arr) {      
    var mark = label.datum;
    var allMarks = mark.mark.items;
    
    var pos = position(mark, anchor, offset);
    var xc = pos.x;
    var yc = pos.y;
    
    switch (mark.mark.marktype) {
      case 'rect':
        var inside = boxInBox(center(label.bounds, [xc, yc]), mark.bounds);
        console.log(inside, mark);
        yc = inside ? yc : (yc + (offset * 2));
        break;
      case 'symbol':
      case 'path':
      case 'arc':
      case 'area':
      case 'line':
      case 'rule':
      case 'image':
      default:
        break;
    }
    
    console.log('[' + xc + ', ' + yc + ']')
 
    Tuple.set(label, 'label_xc', xc);
    Tuple.set(label, 'label_yc', yc);
    Tuple.set(label, 'label_color', color);
    Tuple.set(label, 'label_opacity', opacity);
    Tuple.set(label, 'label_align', align);
  });

  
  input.fields['label_xc'] = 1;
  input.fields['label_yc'] = 1;
  input.fields['label_align'] = 1;
  input.fields['label_color'] = 1;
  input.fields['label_opacity'] = 1;
  return input;
};

function center(m, c) {
  var width = m.x2 - m.x1;
  var height = m.y2 - m.y1;
  return {
    x1: c[0] - width/2,
    x2: c[0] + width/2,
    y1: c[0] - height/2,
    y2: c[0] + height/2
  }
}

function position(m, anchor, offset) {
  var pos = {x: 0, y: 0};
  
  // handle y
  switch (anchor) {
    case 'top-left':
    case 'top':
    case 'top-right':
      pos.y = m.bounds.y1;
      break;
    case 'left':
    case 'center':
    case 'right':
      pos.y = (m.bounds.y2 - m.bounds.y1) / 2 + m.bounds.y1;
      break;
    case 'bottom-left':
    case 'bottom':
    case 'bottom-right':
      pos.y = m.bounds.y2;
      break;
  }
  
  // handle x
  switch (anchor) {
    case 'top-left':
    case 'left':
    case 'bottom-left':
      pos.x = m.bounds.x1;
      break;
    case 'top':
    case 'center':
    case 'bottom':
      pos.x = (m.bounds.x2 - m.bounds.x1) / 2 + m.bounds.x1;
      break;
    case 'top-right':
    case 'right':
    case 'bottom-right':
      pos.x = m.bounds.x2;
      break;
  }
  
  // handle offset
  switch (anchor) {
    case 'top':
      pos.y -= offset;
      break;
    case 'bottom':
      pos.y += offset;
      break;
    case 'right':
      pos.x -= offset;
      break;
    case 'left':
      pos.x += offset;
      break;
    case 'center':
      break;
    default:
      var partial = Math.floor(Math.sqrt(hyp/2));
      pos.x += partial;
      pos.y += partial;
      break;
  }
  
  return pos;
}

module.exports = Label;

Label.schema = {
  "$schema": "http://json-schema.org/draft-04/schema#",
  "title": "Label transform",
  "description": "Computes a label layout.",
  "type": "object",
  "properties": {
    "type": {"enum": ["label"]},
    "buffer": {
      "oneOf": [
        {
          "type": "number",
          "minimum": 0
        },
        {"$ref": "#/refs/signal"}
      ],
      "default": 10
    },
    "anchor": {
      "oneOf": [
        {
          "type": "string",
          "minimum": 0
        },
        {"$ref": "#/refs/signal"}
      ],
      "default": 'auto',
    },
    "offset": {
      "oneOf": [
        {
          "type": "number",
          "minimum": 0
        },
        {"$ref": "#/refs/signal"}
      ],
      "default": 10,
    },
    "opacity": {
      "oneOf": [
        {
          "type": "number",
          "minimum": 0
        },
        {"$ref": "#/refs/signal"}
      ],
      "default": 1,
    },
    "color": {
      "oneOf": [
        {
          "type": "string",
          "minimum": 0
        },
        {"$ref": "#/refs/signal"}
      ],
      "default": 'black',
    },
    "align": {
      "oneOf": [
        {
          "type": "string",
          "minimum": 0
        },
        {"$ref": "#/refs/signal"}
      ],
      "default": 'center',
    },
    "output": {
      "type": "object",
      "description": "Rename the output data fields",
      "properties": {
        "xc": {"type": "string", "default": 0},
        "yc": {"type": "string", "default": 0},
        "color": {"type": "string", "default": "black"},
        "align": {"type": "string", "default": "black"},
        "opacity": {"type": "string", "default": 1}
      }
    }
  },
  "required": ["type"]
};
