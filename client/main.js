// Initialize App parameters
var doc_width = $(window).width();
var doc_height = $(window).height();
var doc_diagonal = Math.ceil(Math.sqrt( Math.pow(doc_width,2) + Math.pow(doc_height*2,2) ));
var iso_width = Math.sqrt( Math.pow(doc_width, 2) + Math.pow(doc_width/2, 2) );

var url_resolution = location.search.split('resolution=')[1];
var resolution = (url_resolution) ? parseInt(url_resolution,10) : 50;

var url_map_size = location.search.split('map_size=')[1];
var map_size = (url_map_size) ? parseInt(url_map_size,10) : 2500000;

var cube_size = Math.ceil(doc_diagonal / resolution);
cube_size %2 == 0 ? cube_size : cube_size++;
cube_size = cube_size > 52 ? 52 : cube_size; // Something weird happens if the canvas is wider than 8048, so this is a temporary band-aid
// cube_size = 25;

var origin = [552648, 429251];
var origin_point = coords_to_index(origin);

// Initialize core game classes
var terrain = new Terrain('main', resolution);
var building = new Building('buildings');
var ui = new UI('ui');
var network = new Network();

// Initialize main animation loop
window.requestAnimFrame = (function(){
	return window.requestAnimationFrame		||
		window.webkitRequestAnimationFrame	||
		window.mozRequestAnimationFrame		||
		function( callback ){
			window.setTimeout(callback, 1000 / 60);
		};
})();

(function animloop(){
	requestAnimFrame(animloop);

	ui.pan_map_loop();
	terrain.tilemap_update_loop();

})();


// Temporary Helper Functions
function coords_to_index(coords){
	return (coords[0] * map_size) + coords[1];
}

function origin_points(){
	var origin_points = Array();
	origin_points[0] = ((origin[0] - cube_size) * map_size) + (origin[1] - cube_size);
	origin_points[1] = ((origin[0] - cube_size) * map_size) + origin[1];
	origin_points[2] = ((origin[0] - cube_size) * map_size) + (origin[1] + cube_size);
	origin_points[3] = ((origin[0] * map_size)) + (origin[1] - cube_size);
	origin_points[4] = ((origin[0] * map_size)) + origin[1];
	origin_points[5] = ((origin[0] * map_size)) + (origin[1] + cube_size);
	origin_points[6] = ((origin[0] + cube_size) * map_size) + (origin[1] - cube_size);
	origin_points[7] = ((origin[0] + cube_size) * map_size) + origin[1];
	origin_points[8] = ((origin[0] + cube_size) * map_size) + (origin[1] + cube_size);

	return origin_points;
}

$(document).ready(function(){

	$('.canvas').each(function(){
		$(this).attr('width', doc_width);
		$(this).attr('height', doc_height);

		// Iso canvases
		var tmp_ctx = $(this)[0].getContext('2d');

		var rot_radians = 45*Math.PI/180;
		tmp_ctx.translate(doc_width/2, doc_height/2);
		tmp_ctx.scale(1,0.5);
		tmp_ctx.rotate(rot_radians);
	});

	ui.click_listener();
	ui.pan_listener();
	ui.highlight_tile();
	ui.keyboard_listener();

});

function Network(){

	var self = this;

	if (!"WebSocket" in window){
		alert("Browser doesn't support WebSockets. Go kick rocks.");
	}

	var init_socket_connect = false;
	var current_env = window.location.host;

	if(current_env == 'simple-rts.zimmerloe.com'){
		var server_url = 'ws://simple-rts.zimmerloe.com:9005';
	} else {
		var server_url = 'ws://localhost:9005';
	}
	var ws = new WebSocket(server_url);

	ws.onclose = function(){
		if(!init_socket_connect){
			ui.visual_error( 'Unable to establish WebSocket connection.');
		} else {
			ui.visual_error( 'WebSocket Connection closed');
		}
	};

	ws.onerror = function(e){
		ui.visual_error('There was an error with the WebSocket connection.');
	}

	ws.onopen = function(){
		init_socket_connect = true;
		self.get_map_data( origin_points() );
		self.get_building_data();
	};

	this.get_map_data = function(origin_points){
		var map_params = {cube_size: cube_size, map_size: map_size, resolution: resolution, origin_points: origin_points};
		ws.send( get_json({type:'get_map_data', map_params:map_params}) );
	};

	this.get_building_data = function(){
		var building_params = {origin: origin, cube_size: cube_size};
		ws.send( get_json( {type:'get_building_data', params: building_params } ) );
	};

	this.make_building = function(x, y){
		var tmp_coords = [ origin[0] + x, origin[1] + y ]
		ws.send( get_json({type:'save_thing_at_location', coords:[tmp_coords[0], tmp_coords[1]]}) )
	}

	this.clear_building_data = function(){
		ws.send( get_json({type:'clear_building_data'}) );
	}

	ws.onmessage = function (ret){
		var received_msg = JSON.parse(ret.data);
		var message_type = received_msg.type;

		switch (message_type){

			case 'map_data':
				terrain.update_tilemaps(received_msg.tilemaps);
				break;

			case 'building_data':
				building.building_map = received_msg.building_map;
				building.draw_buildings();
				break;

			default:
				console.log('Unkown server response');
				break;

		}
	};

	function get_json(input){
		try {
			var json_string = JSON.stringify(input);
		} catch(err) {
			console.log('Invalid Json');
			console.log(err);
			return false;
		}

		return json_string;
	};
}

function Terrain(terrain_canvas_id, resolution){

	this.terrain_canvas = document.getElementById(terrain_canvas_id);
	this.terrain_ctx = this.terrain_canvas.getContext('2d');

	this.tile_width = resolution;
	this.tile_spacer = 0.5;
	this.cube_length = cube_size * this.tile_width;

	this.tmp_map_canvases = new Object();

	this.map_keys = Array();

	this.terrain_ctx.fillStyle = 'red';

	this.needs_update = false;
	this.map_ready = false;

	this.update_tilemaps = function(tilemaps){
		for(var i in tilemaps){

			if( typeof(this.tmp_map_canvases[i]) != 'undefined' ){
				console.log('Already have this cached');
				continue;
			}

			this.draw_tilemap( tilemaps[i], i );
		}

		var tmp_origin_points = origin_points();

		for(var i in tmp_origin_points){
			var tmp_canvas_index = tmp_origin_points[i];
			this.map_keys[i] = tmp_canvas_index;
		}

		this.map_ready = true;
		this.draw_cached();
	}

	this.draw_tilemap = function(tilemap, origin_point){
		var tmp_canvas = document.createElement('canvas');
		var tmp_ctx = tmp_canvas.getContext('2d');
		tmp_canvas.width = this.cube_length;
		tmp_canvas.height = this.cube_length;
		tmp_ctx.translate(this.cube_length/2,this.cube_length/2);

		this.tmp_map_canvases[origin_point] = tmp_canvas;

		var start_x = -(cube_size/2);
		var start_y = -(cube_size/2);
		var end_x = (cube_size * 0.5);
		var end_y = (cube_size * 0.5);

		this.begin_path(tmp_ctx);

		var height_levels = [
			{level:1},
			{level:0.8, color:'#7A8781'},
			{level:0.7, color:'#59842A'},
			{level:0.6, color:'#4C7124'},
			{level:0.57, color:'#326800'},
			{level:0, color:'#254e78'}
		];
		var current_height = 1;

		while( current_height < height_levels.length ){
			var ih = height_levels[current_height].level;
			var lh = height_levels[current_height - 1].level;

			for(var ix = start_x; ix < end_x; ix++ ){
				for(var iy = start_y; iy < end_y; iy++ ){

					var tmp_x = ix - start_x;
					var tmp_y = iy - start_y;

					var tmp_i = (tmp_x * cube_size) + tmp_y;

					var height = tilemap[tmp_i].height;

					if(height >= ih && height < lh){
						this.draw_tile(ix * this.tile_width, iy * this.tile_width, tmp_ctx);
					}

				}
			}

			this.update_fill(height_levels[current_height].color, tmp_ctx);
			this.fill(tmp_ctx);
			this.begin_path(tmp_ctx);

			current_height++;
		}
	}

	this.draw_cached = function(){
		this.clear_map();

		if(ui.translation[0] > 0){
			this.terrain_ctx.drawImage( this.tmp_map_canvases[this.map_keys[0]], (-this.cube_length*1.5) + ui.translation[0], (-this.cube_length*1.5) + ui.translation[1] );
			this.terrain_ctx.drawImage( this.tmp_map_canvases[this.map_keys[1]], (-this.cube_length*1.5) + ui.translation[0], (-this.cube_length/2) + ui.translation[1] );
			this.terrain_ctx.drawImage( this.tmp_map_canvases[this.map_keys[2]], (-this.cube_length*1.5) + ui.translation[0], (this.cube_length/2) + ui.translation[1] );
		}

		if(ui.translation[1] > 0){
			this.terrain_ctx.drawImage( this.tmp_map_canvases[this.map_keys[3]], (-this.cube_length/2) + ui.translation[0], (-this.cube_length*1.5) + ui.translation[1] );
		}

		this.terrain_ctx.drawImage( this.tmp_map_canvases[this.map_keys[4]], (-this.cube_length/2) + ui.translation[0], (-this.cube_length/2) + ui.translation[1] );

		if(ui.translation[1] < 0){
			this.terrain_ctx.drawImage( this.tmp_map_canvases[this.map_keys[5]], (-this.cube_length/2) + ui.translation[0], (this.cube_length/2) + ui.translation[1] );
		}

		if(ui.translation[0] < 0){
			this.terrain_ctx.drawImage( this.tmp_map_canvases[this.map_keys[6]], (this.cube_length/2) + ui.translation[0], (-this.cube_length*1.5) + ui.translation[1] );
			this.terrain_ctx.drawImage( this.tmp_map_canvases[this.map_keys[7]], (this.cube_length/2) + ui.translation[0], (-this.cube_length/2) + ui.translation[1] );
			this.terrain_ctx.drawImage( this.tmp_map_canvases[this.map_keys[8]], (this.cube_length/2) + ui.translation[0], (this.cube_length/2) + ui.translation[1] );
		}

		building.draw_buildings();

	}

	this.draw_tile = function(x, y, ctx){
		ctx.rect(x, y, this.tile_width - this.tile_spacer, this.tile_width - this.tile_spacer);
	}

	this.update_fill = function(new_fill_style, ctx){
		if(ctx.fillStyle != new_fill_style){
			ctx.fillStyle = new_fill_style;
		}
	}

	this.tilemap_update_loop = function(){

		if(this.map_ready && this.needs_update){

			this.draw_cached();

			this.needs_update = false;
		}
	}

	this.begin_path = function(ctx){
		ctx.beginPath();
	}

	this.fill = function(ctx){
		ctx.fill();
	}

	this.stroke = function(ctx){
		ctx.stroke();
	}

	this.clear_map = function(){
		this.terrain_ctx.save();
		this.terrain_ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.terrain_ctx.clearRect(0, 0, doc_width, doc_height);
		// this.terrain_ctx.fillRect(0,0,doc_width,doc_height);
		this.terrain_ctx.restore();
	}

}

function UI(ui_canvas_id){
	this.ui_id = ui_canvas_id;
	this.ui_canvas = document.getElementById(ui_canvas_id);
	this.ui_ctx = this.ui_canvas.getContext('2d');

	this.mouse_is_down = false;
	this.buffer = (cube_size * terrain.tile_width / 4);
	this.pan_amount = 10;
	this.half_map = (cube_size * terrain.tile_width / 2);
	this.pan_amount_vertical = this.pan_amount * 1.5;
	this.last_x;
	this.last_y;

	this.translation = [0,0];

	var self = this;

	this.translate_map = function(difference_x, difference_y){
		this.translation[0] += difference_x;
		this.translation[1] += difference_y;

		terrain.needs_update = true;
		this.clear_ui();

		if(this.translation[0] >= this.half_map + this.buffer){
			this.load_chunk(0,-1); // NW
		} else if(this.translation[1] >= this.half_map + this.buffer) {
			this.load_chunk(1,-1); // NE
		} else if(this.translation[0] <= -this.half_map - this.buffer) {
			this.load_chunk(0,1); // SW
		} else if(this.translation[1] <= -this.half_map - this.buffer) {
			this.load_chunk(1,1); // SE
		}
	}

	this.load_chunk = function(direction, value){
		// Load some more map data based on direction
		this.translation[direction] = -this.translation[direction] - (this.buffer * value * 2);
		terrain.map_ready = false;

		origin[direction] += cube_size * value;
		origin_point = coords_to_index(origin);
		var new_origin_points = origin_points();
		var points_to_get = Array();

		// Determine which chunks we don't currently have cached
		for(var i in new_origin_points ){
			if( typeof(terrain.tmp_map_canvases[new_origin_points[i]]) == 'undefined' ){
				points_to_get.push( new_origin_points[i] );
			}
		}

		network.get_map_data( points_to_get );

	}

	this.pan_listener = function(){
		$('#'+this.ui_id).mousemove(function(e){
			if(self.mouse_is_down && terrain.map_ready){

				if(e.which === 0){
					self.mouse_is_down = false;
					return false;
				}

				var mouse_coords = self.iso_to_cartesian([e.pageX, e.pageY]);
				var tmp_difference_x = mouse_coords[0] - self.last_x;
				var tmp_difference_y = mouse_coords[1] - self.last_y;

				self.translate_map(tmp_difference_x, tmp_difference_y);

				self.last_x = mouse_coords[0];
				self.last_y = mouse_coords[1];
			}
		});
	}

	this.click_listener = function(){
		$('#'+this.ui_id).mousedown(function(e){
			if(e.which === 1){
				var mouse_coords = self.iso_to_cartesian([e.pageX, e.pageY]);

				self.last_x = mouse_coords[0];
				self.last_y = mouse_coords[1];
				self.mouse_is_down = true;
			}
		});

		$('#'+this.ui_id).mouseup(function(e){
			self.mouse_is_down = false;
		});
	}

	this.highlight_tile = function(){
		self.ui_ctx.fillStyle = 'rgba(200,0,0,0.5)';

		$('#'+this.ui_id).mousemove(function(e){
			if(!self.mouse_is_down){

				self.clear_ui();
				self.ui_ctx.beginPath();

				var iso_coords = self.iso_to_cartesian( [e.pageX, e.pageY] );

				iso_coords[0] = Math.floor( (iso_coords[0] - self.translation[0]) / terrain.tile_width) * terrain.tile_width;
				iso_coords[1] = Math.floor( (iso_coords[1] - self.translation[1]) / terrain.tile_width) * terrain.tile_width;

				self.ui_ctx.rect( iso_coords[0] + self.translation[0], iso_coords[1] + self.translation[1], terrain.tile_width - terrain.tile_spacer, terrain.tile_width - terrain.tile_spacer);
				self.ui_ctx.fill();

				var true_coords = Array();
				true_coords[0] = (iso_coords[0]/terrain.tile_width) + (cube_size/2) + origin[0];
				true_coords[1] = (iso_coords[1]/terrain.tile_width) + (cube_size/2) + origin[1];

				// console.log( true_coords );
			}
		});

	}

	this.keyboard_listener = function(){
		this.move_up = false;
		this.move_up = false;
		this.move_up = false;
		this.move_up = false;

		$(document).keydown(function(e){
			if(e.keyCode == 87){ // Up
				self.move_up = true;
			} else if(e.keyCode == 83){ // Down
				self.move_down = true;
			} else if(e.keyCode == 65){ // Left
				self.move_left = true;
			} else if(e.keyCode == 68){ // Right
				self.move_right = true;
			}

		});

		$(document).keyup(function(e){

			if(e.keyCode == 87){ // Up
				self.move_up = false;
			} else if(e.keyCode == 83){ // Down
				self.move_down = false;
			} else if(e.keyCode == 65){ // Left
				self.move_left = false;
			} else if(e.keyCode == 68){ // Right
				self.move_right = false;
			}

		});

	}

	this.pan_map_loop = function(){

		if( this.move_up ){
			this.translate_map( this.pan_amount_vertical, this.pan_amount_vertical );
		} else if( this.move_down ){
			this.translate_map( -this.pan_amount_vertical, -this.pan_amount_vertical );
		}

		if( this.move_left ){
			this.translate_map( this.pan_amount, -this.pan_amount );
		} else if( this.move_right ){
			this.translate_map( -this.pan_amount, this.pan_amount );
		}

	}

	this.clear_ui = function(){
		this.ui_ctx.save();
		this.ui_ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ui_ctx.clearRect(0, 0, doc_width, doc_height);
		this.ui_ctx.restore();
	}

	this.visual_error = function(error_message){
		$('.error_message_box .error_message').html(error_message);
		$('.error_message_box').fadeIn(600);

		setTimeout(function(){
			$('.error_message_box').fadeOut(500);
		}, 3000);
	}

	this.iso_to_cartesian = function(coords){
		var angle = -45 * Math.PI / 180;
		var x = coords[0] - (doc_width/2);
		var y = (coords[1] - (doc_height/2)) * 2;

		var cos = Math.cos(angle);
		var sin = Math.sin(angle);

		var new_x = x*cos - y*sin;
		var new_y = x*sin + y*cos;

		return [Math.round(new_x), Math.round(new_y)];
	}

}

function Building(building_canvas_id){

	this.building_canvas = document.getElementById(building_canvas_id);
	this.building_ctx = this.building_canvas.getContext('2d');
	this.building_map;


	this.draw_buildings = function(){
		this.clear_buildings();
		this.building_ctx.fillStyle = 'red';

		for(var i in this.building_map){
			if( this.building_map[i] === null ){
				continue;
			}

			var tmp_x = Math.floor( i / cube_size);
			var tmp_y = i - (tmp_x * cube_size);

			tmp_x = tmp_x - (cube_size/2);
			tmp_y = tmp_y - (cube_size/2);
			tmp_x = (tmp_x * terrain.tile_width) + ui.translation[0];
			tmp_y = (tmp_y * terrain.tile_width) + ui.translation[1];

			this.building_ctx.fillRect(tmp_x + 10, tmp_y + 10, 30, 30);
		}

	}

	this.clear_buildings = function(){
		this.building_ctx.save();
		this.building_ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.building_ctx.clearRect(0, 0, doc_width, doc_height);
		this.building_ctx.restore();
	}

}
