var dl = require('datalib'),
    Tuple = require('vega-dataflow').Tuple,
    log = require('vega-logging'),
    Transform = require('./Transform'),
    BatchTransform = require('./BatchTransform');

function Label(graph) {
  BatchTransform.prototype.init.call(this, graph);
  Transform.addParameters(this, {
    buffer: {type: 'value', default: 10},
    anchor: {type: 'value', default: 'auto'},
    offset: {type: 'value', default: 10}
  });

  return this.mutates(true);
}

var prototype = (Label.prototype = Object.create(BatchTransform.prototype));
prototype.constructor = Label;

prototype.batchTransform = function(input, data) {
  var LABEL = { // constants to change/adjust based on font
    height: 20,
    width: 100
  }
  
  var buffer = this.param('buffer'),
      anchor = this.param('anchor'),
      offset = this.param('offset'),
      xc, yc, color;
      
  data.forEach(function(datum, idx, arr) {
    switch (datum.mark.name) {
      case 'rect':
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
    
    xc = datum.xc;
    yc = (datum.y2 - datum.y) / 2;
    
    Tuple.set(datum, 'label_xc', xc);
    Tuple.set(datum, 'label_yc', yc);
    Tuple.set(datum, 'color', color);
  });
  

  input.fields['label_xc'] = 1;
  input.fields['label_yc'] = 1;
  input.fields['color'] = 1;
  return input;
};

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
          "type": "number",
          "minimum": 0
        },
        {"$ref": "#/refs/signal"}
      ],
      "default": 10,
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
    "output": {
      "type": "object",
      "description": "Rename the output data fields",
      "properties": {
        "xc": {"type": "string", "default": 0},
        "yc": {"type": "string", "default": 0},
        "color": {"type": "string", "default": "black"}
      }
    }
  },
  "required": ["type"]
};
