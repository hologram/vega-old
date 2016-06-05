var dl = require('datalib'),
    Tuple = require('vega-dataflow').Tuple,
    log = require('vega-logging'),
    Transform = require('./Transform'),
    BatchTransform = require('./BatchTransform')

var ANCHORS = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
] // excluded `center` for priority checking

function Label(graph) {  
  BatchTransform.prototype.init.call(this, graph);
  Transform.addParameters(this, {
    anchor:      {type: 'value', default: 'auto'},
    offset:      {type: 'value', default: 'auto'},
    color:       {type: 'value', default: 'black'},
    opacity:     {type: 'value', default: 1},
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
      return 10;
    case 'area':
    case 'line':
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
      return 'right';
    case 'area':
    case 'line':
    default:
      return 0;
  }
}

function autoColor(mark, label) {
  switch (mark.mark.marktype) {
    case 'rect':
    case 'symbol':
    case 'line':
    case 'area':
    default:
      return '#000';
  }
}

prototype.batchTransform = function(input, data) {
  var _orientation = this.param('orientation');  
      _anchor      = this.param('anchor'),
      _offset      = this.param('offset'),
      _color       = this.param('color'),
      _opacity     = this.param('opacity');
      
  var allLabels = data[0].mark.items;
  var allMarks = data[0].datum.mark.items;

  var finalLabels = [];
  data.forEach(function(label, idx, arr) {
    var mark = label.datum;
    mark.bounds.width = mark.bounds.x ? 0 : mark.bounds.x2 - mark.bounds.x1;
    mark.bounds.height = mark.bounds.y ? 0 : mark.bounds.y2 - mark.bounds.x2; 
    
    var color = _color == 'auto' ? autoColor(mark, label) : _color;
    var anchor = _anchor == 'auto' ? autoAnchor(mark, _orientation) : _anchor;
    
    var offset = _offset == 'auto' ? autoOffset(mark, _orientation) : _offset;
    offset *= ((_orientation == 'horizontal') ? -1 : 1);
    
    var opacity = _opacity;
    
    label.bounds = center(label.bounds, position(mark, anchor, offset));
    
    var pos = position(mark, anchor, offset);
             
    switch (mark.mark.marktype) {
      case 'rect':
        var horizontalCondition = _orientation == 'horizontal' 
            && (mark.bounds.width < label.bounds.width);
        var verticalCondition = _orientation == 'vertical' 
            && (mark.bounds.height < label.bounds.height);
        
        if (horizontalCondition || verticalCondition) {
          console.log('inside');
          offset *= -1;
          color = '#000000';
        } else if (!boxInBox(label.bounds, mark.bounds)) {
          color = '#000000';
        }
        
        pos = position(mark, anchor, offset);
        break;
        
      case 'symbol':
        var fewest = allLabels.length;
        var bestAnchor = anchor;
        
        var i = ANCHORS.indexOf(anchor);
        while (i < (ANCHORS.indexOf(anchor) + ANCHORS.length) && fewest != 0) {
          var nextIndex = i;
          if (nextIndex > ANCHORS.length-1) {
            nextIndex = i - ANCHORS.length;
          }
          var testAnchor = ANCHORS[nextIndex];
          label.bounds = center(label.bounds, position(mark, testAnchor, offset));      
          var check = checkOcclusion(label, allMarks.concat(allLabels).concat(finalLabels));
          
          if (check < fewest) {
            bestAnchor = testAnchor;
            fewest = check;
          }
          
          i++;
        }
        
        if (fewest != 0) {
          opacity = 0;
        } 
        
        label.bounds = center(label.bounds, position(mark, bestAnchor, offset));
        pos = position(mark, bestAnchor, offset);
        break;
 
      case 'line':
      
         break;
      case 'area':
      default:
        break;
    }
    
    
    Tuple.set(label, 'label_xc', pos.x);
    Tuple.set(label, 'label_yc', pos.y);
    Tuple.set(label, 'label_color', color);
    Tuple.set(label, 'label_opacity', opacity);
    Tuple.set(label, 'label_baseline', pos.baseline);
    Tuple.set(label, 'label_align', pos.align);
    finalLabels.push(label);
  });

  
  input.fields['label_xc'] = 1;
  input.fields['label_yc'] = 1;
  input.fields['label_align'] = 1;
  input.fields['label_color'] = 1;
  input.fields['label_opacity'] = 1;
  return input;
};

function checkOcclusion(label, scene) {
  var occlusions = 0;
  scene.forEach(function(item) {
    if (label._id != item._id && occludes(label.bounds, item.bounds)) {
      occlusions += 1;
    }
  });
  return occlusions;
}

function occludes(a, b) {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

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
    y2: pos.y + height/2,
    width: width,
    height: height
  }
}

function position(m, anchor, offset) {
  var pos = {x: 0, y: 0};
  if (m.x && m.y) {
    pos.x = m.x;
    pos.y = m.y;
  }
  
  var partial = Math.floor(Math.sqrt(offset/2));

  switch (anchor) {
    case 'top-left':
      pos.x = pos.x || m.bounds.x1;
      pos.y = pos.y || m.bounds.y1;
      pos.x -= partial;
      pos.y -= partial;
      pos.baseline = 'top';
      pos.align = 'right';
      break;
    case 'top':
      pos.x = pos.x || (m.bounds.x2 - m.bounds.x1) / 2 + m.bounds.x1;
      pos.y = pos.y || m.bounds.y1;
      pos.y -= offset;
      pos.baseline = 'top';
      pos.align = 'center';
      break;
    case 'top-right':
      pos.x = pos.x || (m.bounds.x2 - m.bounds.x1) / 2 + m.bounds.x1;
      pos.y = pos.y || m.bounds.y1;
      pos.x += partial;
      pos.y -= partial;
      pos.baseline = 'top';
      pos.align = 'left';
      break;
    case 'left':
      pos.x = pos.x || m.bounds.x1;
      pos.x -= offset;
      pos.y = pos.y || (m.bounds.y2 - m.bounds.y1) / 2 + m.bounds.y1;
      pos.baseline = 'middle';
      pos.align = 'right';
      break;
   case 'center':
      pos.x = pos.x || (m.bounds.x2 - m.bounds.x1) / 2 + m.bounds.x1;
      pos.y = pos.y || (m.bounds.y2 - m.bounds.y1) / 2 + m.bounds.y1;
      pos.baseline = 'middle';
      pos.align = 'center';
      break;
    case 'right':
      pos.x = pos.x || (m.bounds.x2 - m.bounds.x1) / 2 + m.bounds.x1;
      pos.y = pos.y || (m.bounds.y2 - m.bounds.y1) / 2 + m.bounds.y1;
      pos.x += offset;
      pos.baseline = 'middle';
      pos.align = 'left';
      break;
    case 'bottom-left':
      pos.x = pos.x || m.bounds.x1;
      pos.y = pos.y || m.bounds.y2;
      pos.x -= partial;
      pos.y += partial;     
      pos.baseline = 'bottom';
      pos.align = 'right';
      break;
    case 'bottom':
      pos.x = pos.x || (m.bounds.x2 - m.bounds.x1) / 2 + m.bounds.x1;
      pos.y = pos.y || m.bounds.y2;
      pos.y += offset;
      pos.baseline = 'bottom';
      pos.align = 'center';
      break;
    case 'bottom-right':
      pos.x = pos.x || (m.bounds.x2 - m.bounds.x1) / 2 + m.bounds.x1;
      pos.y = pos.y || m.bounds.y2;
      pos.x += partial;
      pos.y += partial;
      pos.baseline = 'bottom';
      pos.align = 'left';
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
        "baseline": {"type": "string", "default": "middle"},
        "opacity": {"type": "string", "default": 1}
      }
    }
  },
  "required": ["type"]
};
