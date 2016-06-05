var dl = require('datalib'),
    Tuple = require('vega-dataflow').Tuple,
    log = require('vega-logging'),
    Transform = require('./Transform'),
    BatchTransform = require('./BatchTransform')

function Label(graph) {
  console.log('LABEL');
  
  BatchTransform.prototype.init.call(this, graph);
  Transform.addParameters(this, {
    buffer:      {type: 'value', default: 10},
    anchor:      {type: 'value', default: 'auto'},
    offset:      {type: 'value', default: 'auto'},
    color:       {type: 'value', default: 'black'},
    opacity:     {type: 'value', default: 1},
    align:       {type: 'value', default: 'center'},
    orientation: {type: 'value', default: 'vertical'}
  });

  return this.mutates(true);
}

var prototype = (Label.prototype = Object.create(BatchTransform.prototype));
prototype.constructor = Label;

function autoOffset(mark, orientation) {
  switch (mark.mark.marktype) {
    case 'rect':
      return orientation == 'horizontal' ? 10 : -10;
    case 'symbol':
    case 'path':
    case 'arc':
    case 'area':
    case 'line':
    case 'rule':
    case 'image':
    default:
      return 0;
  }
}

function autoAnchor(mark, orientation) {
  switch (mark.mark.marktype) {
    case 'rect':
      if (orientation == 'horizontal') {
        return 'right';
      } else {
        return 'top';
      }
    case 'symbol':
    case 'path':
    case 'arc':
    case 'area':
    case 'line':
    case 'rule':
    case 'image':
    default:
      return 0;
  }
}

function autoColor(mark, label) {
  switch (mark.mark.marktype) {
    case 'rect':
    case 'symbol':
    case 'path':
    case 'arc':
    case 'area':
    case 'line':
    case 'rule':
    case 'image':
    default:
      return '#000';
  }
}

function dimensions(g) {
  return {
    width: (g.bounds.x2 - g.bounds.x1),
    height: (g.bounds.y2 - g.bounds.y1)
  }
}

prototype.batchTransform = function(input, data) {
  var _buffer     = this.param('buffer'),
      _anchor     = this.param('anchor'),
      _offset     = this.param('offset'),
      _align      = this.param('align'),
      _color      = this.param('color'),
      _opacity    = this.param('opacity');
      _orientation = this.param('orientation');  
      
  var allLabels = data[0].mark.items;
  
  data.forEach(function(label, idx, arr) {      
    var mark = label.datum;
    var allMarks = mark.mark.items;
    
    var color = _color == 'auto' ? autoColor(mark, label) : _color;
    var offset = _offset == 'auto' ? autoOffset(mark, _orientation) : _offset;
    var anchor = _anchor == 'auto' ? autoAnchor(mark, _orientation) : _anchor;
             
    switch (mark.mark.marktype) {
      case 'rect':
        var horizontalCondition = _orientation == 'horizontal' 
            && (dimensions(mark).width < dimensions(label).width);
        var verticalCondition = _orientation == 'vertical' 
            && (dimensions(mark).height < dimensions(label).height);
        if (horizontalCondition || verticalCondition) {
          console.log('inside');
          offset *= -1;
          color = '#000000';
        }       
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
    
    console.log(offset);
    var pos = position(mark, anchor, offset);
    
    Tuple.set(label, 'label_xc', pos.x);
    Tuple.set(label, 'label_yc', pos.y);
    Tuple.set(label, 'label_color', color);
    Tuple.set(label, 'label_opacity', _opacity);
    Tuple.set(label, 'label_align', _align);
  });

  
  input.fields['label_xc'] = 1;
  input.fields['label_yc'] = 1;
  input.fields['label_align'] = 1;
  input.fields['label_color'] = 1;
  input.fields['label_opacity'] = 1;
  return input;
};

function boxInBox(small, big) {
  return small.x1 >= big.x1 &&
         small.x2 <= big.x2 &&
         small.y1 >= big.y1 &&
         small.y2 <= big.y2;
}

function center(m, pos) {
  var width = m.x2 - m.x1;
  var height = m.y2 - m.y1;
  return {
    x1: pos.x - width/2,
    x2: pos.x + width/2,
    y1: pos.y - height/2,
    y2: pos.y + height/2
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
      var partial = Math.floor(Math.sqrt(offset/2));
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
          "type": "string"
        },
        {"$ref": "#/refs/signal"}
      ],
      "default": "auto",
    },
    "offset": {
      "oneOf": [
        {
          "type": "number",
          "minimum": 0
        },
        {"$ref": "#/refs/signal"}
      ],
      "default": "auto",
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
          "type": "string"
        },
        {"$ref": "#/refs/signal"}
      ],
      "default": 'black',
    },
    "align": {
      "oneOf": [
        {
          "type": "string"
        },
        {"$ref": "#/refs/signal"}
      ],
      "default": 'center',
    },
    "orientation": {
      "oneOf": [
        {
          "type": "string"
        },
        {"$ref": "#/refs/signal"}
      ],
      "default": 'vertical',
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
