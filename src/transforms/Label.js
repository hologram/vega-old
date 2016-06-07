var dl = require('datalib'),
		Tuple = require('vega-dataflow').Tuple,
		log = require('vega-logging'),
		Transform = require('./Transform'),
		BatchTransform = require('./BatchTransform')

var ANCHORS = [
	'center',
	'top-left',
	'top',
	'top-right',
	'right',
	'bottom-right',
	'bottom',
	'bottom-left',
	'left'
]

function Label(graph) {  
	BatchTransform.prototype.init.call(this, graph);
	Transform.addParameters(this, {
		anchor:      {type: 'value', default: 'auto'},
		offset:      {type: 'value', default: 'auto'},
		color:       {type: 'value', default: 'auto'},
		opacity:     {type: 'value', default: 1},
		orientation: {type: 'value', default: 'vertical'}
	});

	return this.mutates(true);
}

var prototype = (Label.prototype = Object.create(BatchTransform.prototype));
prototype.constructor = Label;

prototype.batchTransform = function(input, data) {
	var _orientation = this.param('orientation'),  
			_anchor      = this.param('anchor'),
			_offset      = this.param('offset'),
			_color       = this.param('color'),
			_opacity     = this.param('opacity'),
      _baseline    = null,
			_align 		 	 = null;
			
	var allLabels = data[0].mark.items;
	var allMarks = data[0].datum.mark.items;
  var newLabels = [];
  
	data.forEach(function(label, idx, arr) {
		var mark = label.datum;

		var color = _color === 'auto' ? autoColor(mark) : _color;
		console.log(1, color);
		var anchor = _anchor === 'auto' ? autoAnchor(mark, _orientation) : _anchor;
		var offset = _offset === 'auto' ? autoOffset(mark, _orientation) : _offset;
		
		var opacity = _opacity;
    var baseline = _baseline;
    var align = _align;
		label.bounds = center(label.bounds, position(mark, anchor, offset));
		
		var pos = position(mark, anchor, offset);
		
		switch (mark.mark.marktype) {
			case 'rect':			
				var horizontalCondition = _orientation === 'horizontal' 
						&& (dimensions(mark.bounds).width < (dimensions(label.bounds).width) + (Math.abs(offset) * 2) && offset < 0)
						&& anchor === 'right';
				var verticalCondition = _orientation === 'vertical' 
						&& (dimensions(mark.bounds).height < (dimensions(label.bounds).height) + (Math.abs(offset) * 2) && offset < 0)
						&& anchor === 'top';
				
				if (horizontalCondition || verticalCondition) {
					if (_offset === 'auto') {
						offset *= -1;
						label.bounds = center(label.bounds, position(mark, anchor, offset));
					} else {
						opacity = 0;
					}
				}
				
				if (boxInBox(label.bounds, mark.bounds)) {
					color = _color === 'auto' ? flipColor(color) : color;
					console.log(2, color);
				} else {
					console.log(3, color);					
				}
				
				if (!boxInBox(label.bounds, mark.bounds) && occludes(label, mark)) {
					opacity = 0;
				}
				
				break;
				
      case 'line':
        var available = ['top', 'bottom'];
        if (!available.includes(anchor)) {
          anchor = available[0];
        }
        bestAnchor(anchor, available)      
        break;
			
      case 'symbol':
        bestAnchor(anchor, ANCHORS);   
        break;
          
      case 'area':
      default:
        break;
		}
		
		function bestAnchor(currentAnchor, testAnchors) {
			var fewest = allLabels.length;
			var bestAnchor = anchor;
			
			var i = testAnchors.indexOf(anchor);
			while (i < (testAnchors.indexOf(anchor) + testAnchors.length) && fewest != 0) {
				var nextIndex = i;
				if (nextIndex > testAnchors.length-1) {
					nextIndex = i - testAnchors.length;
				}
				var testAnchor = testAnchors[nextIndex];
				label.bounds = center(label.bounds, position(mark, testAnchor, offset));      
				var check = checkOcclusion(label, allMarks.concat(allLabels.concat(newLabels)));
				
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
      anchor = bestAnchor;
		}
    
    newLabels.push(label);    
    
    pos = position(mark, anchor, offset);
		
		function offEdge() {
			var halfWidth = dimensions(label.bounds).width/2;
			var halfHeight = dimensions(label.bounds).height/2;
			
			return (pos.x - halfWidth < 0 || pos.y - halfHeight < 0);	
		}
		
		if (offEdge()) {
			opacity = 0;
		}
		
		Tuple.set(label, 'label_xc', pos.x);
		Tuple.set(label, 'label_yc', pos.y);
		Tuple.set(label, 'label_color', color);
		Tuple.set(label, 'label_opacity', opacity);
		Tuple.set(label, 'label_baseline', pos.baseline);
		Tuple.set(label, 'label_align', pos.align);
	});
 
	input.fields['label_xc'] = 1;
	input.fields['label_yc'] = 1;
	input.fields['label_align'] = 1;
	input.fields['label_color'] = 1;
	input.fields['label_opacity'] = 1;
	return input;
};

	function autoColor(mark) {
		var color = mark.fill || mark.stroke || '#fff';
		return (luma(color) >= 120) ? '#000000' : '#fff';
	}
	
	function flipColor(color) {
		return (color === '#000000') ? '#fff' : ((color === '#fff') ? '#000000' : color);
	}
	
	// color can be a hx string or an array of RGB values 0-255 
	function luma(color) { 
		var rgb = (typeof color === 'string') ? hexToRGBArray(color) : color;
		return (0.2126 * rgb[0]) + (0.7152 * rgb[1]) + (0.0722 * rgb[2]); // SMPTE C, Rec. 709 weightings
	}
	
	function hexToRGBArray(color) {
		color = color.substr(1);
		if (color.length === 3)
			color = color.charAt(0) + color.charAt(0) + color.charAt(1) + color.charAt(1) + color.charAt(2) + color.charAt(2);
		else if (color.length !== 6)
			throw('Invalid hex color: ' + color);
		var rgb = [];
		for (var i = 0; i <= 2; i++)
			rgb[i] = parseInt(color.substr(i * 2, 2), 16);
		return rgb;
	}

function autoOffset(mark, orientation) {
	switch (mark.mark.marktype) {
		case 'rect':
			return -10;
		case 'symbol':
			return 7;
		case 'area':
		case 'line':
			return 15;
		default:
			return 0;
	}
}

function autoAnchor(mark, orientation) {
	switch (mark.mark.marktype) {
		case 'rect':
			if (orientation === 'horizontal') {
				return 'right';
			} else {
				return 'top';
			}
		case 'symbol':
			return 'right';
		case 'area':
		case 'line':
			return 'top';
		default:
			return 'top';
	}
}

function checkOcclusion(label, scene) {
	var occlusions = 0;
	scene.forEach(function(item) {
		if (label._id != item._id && occludes(label, item)) {
			occlusions += 1;
		}
	});
	return occlusions;
}

function occludes(a, b) {
	if ((b.mark.marktype === 'line')) {
		return a.bounds.x1 < b.x && a.bounds.x2 > b.x && a.bounds.y1 < b.y && a.bounds.y2 > b.y;
	}
	return a.bounds.x1 < b.bounds.x2 && a.bounds.x2 > b.bounds.x1 && a.bounds.y1 < b.bounds.y2 && a.bounds.y2 > b.bounds.y1;
}

function boxInBox(small, big) {
	return small.x1 >= big.x1 &&
				 small.x2 <= big.x2 &&
				 small.y1 >= big.y1 &&
				 small.y2 <= big.y2;
}

function center(m, pos) {
	var dim = dimensions(m);
	return {
		x1: pos.x - dim.width/2,
		x2: pos.x + dim.width/2,
		y1: pos.y - dim.height/2,
		y2: pos.y + dim.height/2
	}
}

function dimensions(m) {
  return {
    width: m.x2 - m.x1,
    height: m.y2 - m.y1
  }
}

function position(m, anchor, offset) {  
  var point = (m.mark.marktype === 'line');
	var pos = point ? {'x': m.x, 'y': m.y} : {};
	
	var partial = Math.floor(Math.sqrt(Math.pow(offset, 2)/2));
	
	switch (anchor) {
		case 'top-left':
			pos.x = point ? pos.x : (m.bounds.x1);
			pos.y = point ? pos.y : (m.bounds.y1);
			pos.x -= partial;
			pos.y -= partial;
			pos.baseline = 'top';
			pos.align = 'right';
			break;
		case 'top':
			pos.x = point ? pos.x : ((m.bounds.x2 - m.bounds.x1) / 2 + m.bounds.x1);
			pos.y = point ? pos.y : (m.bounds.y1);
			pos.y -= offset;
			pos.baseline = offset < 0 ? 'top' : 'bottom';
			pos.align = 'center';
			break;
		case 'top-right':
			pos.x = point ? pos.x : (m.bounds.x2);
			pos.y = point ? pos.y : (m.bounds.y1);
			pos.x += partial;
			pos.y -= partial;
			pos.baseline = 'top';
			pos.align = 'left';
			break;
		case 'left':
			pos.x = point ? pos.x : (m.bounds.x1);
			pos.x -= offset;
			pos.y = point ? pos.y : ((m.bounds.y2 - m.bounds.y1) / 2 + m.bounds.y1);
			pos.baseline = 'middle';
			pos.align = offset < 0 ? 'left' : 'right';
			break;
	 case 'center':
			pos.x = point ? pos.x : ((m.bounds.x2 - m.bounds.x1) / 2 + m.bounds.x1);
			pos.y = point ? pos.y : ((m.bounds.y2 - m.bounds.y1) / 2 + m.bounds.y1);
			pos.baseline = 'middle';
			pos.align = 'center';
			break;
		case 'right':
			pos.x = point ? pos.x : (m.bounds.x2);
			pos.y = point ? pos.y : ((m.bounds.y2 - m.bounds.y1) / 2 + m.bounds.y1);
			pos.x += offset;
			pos.baseline = 'middle';
			pos.align = offset < 0 ? 'right' : 'left';
			break;
		case 'bottom-left':
			pos.x = point ? pos.x : (m.bounds.x1);
			pos.y = point ? pos.y : (m.bounds.y2);
			pos.x -= partial;
			pos.y += partial;     
			pos.baseline = 'bottom';
			pos.align = 'right';
			break;
		case 'bottom':
			pos.x = point ? pos.x : ((m.bounds.x2 - m.bounds.x1) / 2 + m.bounds.x1);
			pos.y = point ? pos.y : (m.bounds.y2);
			pos.y += offset;
			pos.baseline = offset < 0 ? 'bottom' : 'top';
			pos.align = 'center';
			break;
		case 'bottom-right':
			pos.x = point ? pos.x : (m.bounds.x2);
			pos.y = point ? pos.y : (m.bounds.y2);
			pos.x += partial;
			pos.y += partial;
			pos.baseline = 'bottom';
			pos.align = 'left';
			break;
		default:
			console.error("error, invalid anchor");
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
			"default": 'auto',
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
				"color": {"type": "string", "default": "#000000"},
				"align": {"type": "string", "default": "#000000"},
				"baseline": {"type": "string", "default": "middle"},
				"opacity": {"type": "string", "default": 1}
			}
		}
	},
	"required": ["type"]
};
