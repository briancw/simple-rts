var doc_width = $(window).width();
var doc_height = $(window).height();
var doc_diagonal = Math.ceil(Math.sqrt( Math.pow(doc_width,2) + Math.pow(doc_height*2,2) ));
var url_resolution = location.search.split('resolution=')[1];
var resolution = (url_resolution) ? parseInt(url_resolution,10) : 50;

var url_map_size = location.search.split('map_size=')[1];
var map_size = (url_map_size) ? parseInt(url_map_size,10) : 100;

var cube_size = Math.ceil(doc_diagonal / resolution);
cube_size %2 == 0 ? cube_size : cube_size++;
// cube_size = 150;

var origin = [0,0];
origin = [552648, 429251];
map_size = 2500000;

var terrain = new Terrain('main', resolution);
var building = new Building('buildings');
var ui = new UI('ui');

var tilemap;

var init_socket_connect = false;

// Setup Networking
if (!"WebSocket" in window){
	alert("Browser doesn't support WebSockets. Go kick rocks.");
}

var current_env = window.location.host;
if(current_env == 'simple-rts.zimmerloe.com'){
	var server_url = 'ws://simple-rts.zimmerloe.com:9005';
} else {
	var server_url = 'ws://localhost:9005';
}
var ws = new WebSocket(server_url);

ws.onclose = function(){
	if(!init_socket_connect){
		visual_error( 'Unable to establish WebSocket connection.');
	} else {
		visual_error( 'WebSocket Connection closed');
	}
};

ws.onerror = function(e){
	visual_error('There was an error with the WebSocket connection.');
}

ws.onopen = function(){
	init_socket_connect = true;
	get_map_data();
	get_building_data();
};

function get_map_data(){
	var map_params = {cube_size: cube_size, map_size: map_size, resolution: resolution, origin: origin};
	ws.send( get_json({type:'get_map_data', map_params:map_params}) );
}

function get_building_data(){
	var building_params = {origin: origin, cube_size: cube_size};
	ws.send( get_json( {type:'get_building_data', params: building_params } ) );
}

$(document).ready(function(){

	ws.onmessage = function (ret){
		var received_msg = JSON.parse(ret.data);
		var message_type = received_msg.type;

		switch (message_type){

			case 'tilemap':
				tilemap = received_msg.tilemap;
				terrain.draw_tilemap(tilemap);
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

	$('.canvas').each(function(){
		$(this).attr('width', doc_width);
		$(this).attr('height', doc_height);

		// Iso canvases
		var tmp_ctx = $(this)[0].getContext('2d');

		var rot_radians = 45*Math.PI/180;

		tmp_ctx.save();
		tmp_ctx.translate(doc_width/2, doc_height/2);
		tmp_ctx.scale(1,0.5);
		tmp_ctx.rotate(rot_radians);
	});


	ui.click_listener();
	ui.pan_listener();
	ui.highlight_tile();
	terrain.tilemap_update_loop();


	$(document).keydown(function(e){
		var do_update = false;

		// var pan_amount = 15;
		if(e.keyCode == 87){ // Up
			origin[1]--;
			do_update = true;
		} else if(e.keyCode == 83){ // Down
			origin[1]++;
			do_update = true;
		} else if(e.keyCode == 65){ // Left
			origin[0]--;
			do_update = true;
		} else if(e.keyCode == 68){ // Right
			origin[0]++;
			do_update = true;
		} else if(e.keyCode == 187){ // Plus
			map_size *= 1.1;
			origin = [Math.round((origin[0]*1.1) + (3)), Math.round((origin[1]*1.1) + (3)) ];
			do_update = true;
		} else if(e.keyCode == 189){ // Minus
			map_size *= 0.9;
			origin = [(origin[0]*0.9) - (3), (origin[1]*0.9) - (3) ];
			do_update = true;
		}

		if(do_update){
			get_map_data();
		}

	});

});

function get_json(input){
	try {
		var json_string = JSON.stringify(input);
	} catch(err) {
		console.log('Invalid Json');
		console.log(err);
		return false;
	}

	return json_string;
}

function visual_error(error_message){
	$('.error_message_box .error_message').html(error_message);
	$('.error_message_box').fadeIn(600);

	setTimeout(function(){
		$('.error_message_box').fadeOut(500);
	}, 3000);
}


function Terrain(terrain_canvas_id, resolution){

	this.terrain_canvas = document.getElementById(terrain_canvas_id);
	this.terrain_ctx = this.terrain_canvas.getContext('2d');

	this.tile_width = resolution;
	this.tile_spacer = 0.5;

	this.terrain_ctx.fillStyle = 'red';

	this.needs_update = false;

	this.draw_tilemap = function(tilemap){
		var cube_size = Math.sqrt(tilemap.length);

		// Off Screen canvas test
		// var tmp_canvas = document.createElement('canvas');
		// tmp_canvas.width = doc_width;
		// tmp_canvas.height = doc_height;
		// var tmp_ctx = tmp_canvas.getContext('2d');

		// tmp_ctx.fillRect(10, 10, 100, 100);
		// this.terrain_ctx.drawImage( tmp_canvas, 0, 0 );
		// return false;

		var start_x = -(cube_size/2);
		var start_y = -(cube_size/2);
		var end_x = (cube_size * 0.5);
		var end_y = (cube_size * 0.5);

		this.clear_map();
		this.begin_path();

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
						this.draw_tile(ix * this.tile_width, iy * this.tile_width);
					}

				}
			}

			this.update_fill(height_levels[current_height].color);
			this.fill();
			this.begin_path();

			current_height++;
		}

		building.draw_buildings();
	}

	this.draw_tile = function(x, y){
		x += ui.translation[0];
		y += ui.translation[1];
		this.terrain_ctx.rect(x, y, this.tile_width - this.tile_spacer, this.tile_width - this.tile_spacer);
	}

	this.update_fill = function(new_fill_style){
		if(this.terrain_ctx.fillStyle != new_fill_style){
			this.terrain_ctx.fillStyle = new_fill_style;
		}
	}

	this.tilemap_update_loop = function(){
		var self = this;

		setInterval(function(){
			if(self.needs_update){

				self.draw_tilemap(tilemap);

			}
			self.needs_update = false;
		}, 10);

	}

	this.begin_path = function(){
		this.terrain_ctx.beginPath();
	}

	this.fill = function(){
		this.terrain_ctx.fill();
	}

	this.stroke = function(){
		this.terrain_ctx.stroke();
	}

	this.clear_map = function(){
		this.terrain_ctx.save();
		this.terrain_ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.terrain_ctx.clearRect(0, 0, doc_width, doc_height);
		this.terrain_ctx.restore();
	}

}

function UI(ui_canvas_id){
	this.ui_id = ui_canvas_id;
	this.ui_canvas = document.getElementById(ui_canvas_id);
	this.ui_ctx = this.ui_canvas.getContext('2d');

	this.mouse_is_down = false;
	this.last_x;
	this.last_y;

	this.translation = [0,0];

	var self = this;

	this.translate_map = function(difference_x, difference_y){
		this.translation[0] += difference_x;
		this.translation[1] += difference_y;
	}

	this.pan_listener = function(){
		$('#'+this.ui_id).mousemove(function(e){
			if(self.mouse_is_down){
				var mouse_coords = self.iso_to_cartesian([e.pageX, e.pageY]);
				var tmp_difference_x = mouse_coords[0] - self.last_x;
				var tmp_difference_y = mouse_coords[1] - self.last_y;

				self.translate_map(tmp_difference_x, tmp_difference_y);

				self.last_x = mouse_coords[0];
				self.last_y = mouse_coords[1];
				terrain.needs_update = true;
			}
		});
	}

	this.click_listener = function(){
		$('#'+this.ui_id).mousedown(function(e){
			var mouse_coords = self.iso_to_cartesian([e.pageX, e.pageY]);

			self.last_x = mouse_coords[0];
			self.last_y = mouse_coords[1];
			self.mouse_is_down = true;
			self.clear_ui();
		});

		$('#'+this.ui_id).mouseup(function(e){
			self.mouse_is_down = false;
		});
	}

	this.clear_ui = function(){
		this.ui_ctx.save();
		this.ui_ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ui_ctx.clearRect(0, 0, doc_width, doc_height);
		this.ui_ctx.restore();
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

	this.make_building = function(x, y){
		var tmp_coords = [ origin[0] + x, origin[1] + y ]
		ws.send( get_json({type:'save_thing_at_location', coords:[tmp_coords[0], tmp_coords[1]]}) )
	}

	this.clear_building_data = function(){
		ws.send( get_json({type:'clear_building_data'}) );
	}
}

