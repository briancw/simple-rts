var doc_width = $(window).width();
var doc_height = $(window).height();
var compensated_height = doc_height > doc_width ? Math.ceil(doc_height * 1.15) : doc_height;
var doc_diagonal = Math.ceil(Math.sqrt( Math.pow(doc_width,2) + Math.pow(compensated_height,2) ));
var url_resolution = location.search.split('resolution=')[1];
var resolution = (url_resolution) ? parseInt(url_resolution,10) : 50;

var url_map_size = location.search.split('map_size=')[1];
var map_size = (url_map_size) ? parseInt(url_map_size,10) : 100;

var cube_size = Math.ceil(doc_diagonal / resolution);
cube_size %2 == 0 ? cube_size : cube_size++;
// cube_size = 50;

var tmp_adj = (map_size / cube_size) * 12.66;
// console.log(tmp_adj);

var origin = [0,tmp_adj];

var terrain = new Terrain('main', resolution);
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
};

function get_map_data(){
	var map_params = {cube_size: cube_size, map_size: map_size, resolution: resolution, origin: origin};
	ws.send( get_json({type:'get_map_data', map_params:map_params}) );
}

function make_building(){
	ws.send( get_json({type:'save_thing_at_location', coords:[5,5,map_size]}) )
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
			tmp_adj = (map_size / cube_size) * 12.66;
			origin = [0,tmp_adj];
			do_update = true;
		} else if(e.keyCode == 189){ // Minus
			map_size *= 0.9;
			tmp_adj = (map_size / cube_size) * 12.66;
			origin = [0,tmp_adj];
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
	this.rot_radians = 45*Math.PI/180;

	this.tile_width = resolution;
	this.tile_spacer = 0.5;

	this.translation = [0,0];

	this.terrain_ctx.fillStyle = 'red';

	this.needs_update = false;

	this.draw_tilemap = function(tilemap){
		var cube_size = Math.sqrt(tilemap.length);

		var start_x = -(cube_size/2);
		var start_y = -(cube_size/2);
		var end_x = (cube_size * 0.5);
		var end_y = (cube_size * 0.5);

		this.clear_map();
		this.start_path();

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
			this.start_path();

			current_height++;
		}

	}

	this.draw_tile = function(x, y){
		x += this.translation[0];
		y += this.translation[1];
		this.terrain_ctx.rect(x, y, this.tile_width - this.tile_spacer, this.tile_width - this.tile_spacer);
	}

	this.update_fill = function(new_fill_style){
		if(this.terrain_ctx.fillStyle != new_fill_style){
			this.terrain_ctx.fillStyle = new_fill_style;
		}
	}

	this.translate_map = function(difference_x, difference_y){
		this.translation[0] += difference_x;
		this.translation[1] += difference_y;
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

	this.start_path = function(){
		this.terrain_ctx.beginPath();
	}

	this.fill = function(){
		this.terrain_ctx.fill();
	}

	this.stroke = function(){
		this.terrain_ctx.stroke();
	}

	this.clear_map = function(){
		this.terrain_ctx.restore();

		// this.terrain_ctx.rect( 0, 0, doc_width, doc_height- );
		this.terrain_ctx.clearRect( 0, 0, doc_width, doc_height );
		this.terrain_ctx.save();

		this.terrain_ctx.translate(doc_width/2, doc_height/2)
		this.terrain_ctx.scale(1, 0.5);
		this.terrain_ctx.rotate(this.rot_radians);
	}

}

function UI(ui_canvas_id){
	this.ui_id = ui_canvas_id;
	this.ui_canvas = document.getElementById(ui_canvas_id);
	this.ui_ctx = this.ui_canvas.getContext('2d');
	this.rot_radians = 45*Math.PI/180;

	this.window_width = $(window).width();
	this.window_height = $(window).height();

	this.last_page_x;
	this.last_page_y;
	this.mouse_is_down = false;

	this.last_x;
	this.last_y;

	var self = this;

	this.pan_listener = function(){
		$('#'+this.ui_id).mousemove(function(e){
			if(self.mouse_is_down){
				var mouse_coords = self.iso_to_cartesian([e.pageX, e.pageY]);
				var tmp_difference_x = mouse_coords[0] - self.last_x;
				var tmp_difference_y = mouse_coords[1] - self.last_y;

				terrain.translate_map(tmp_difference_x, tmp_difference_y);

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
		var tmp_fill_style = this.ui_ctx.fillStyle;
		this.ui_ctx.restore();

		this.ui_ctx.clearRect( 0, 0, doc_width, doc_height );
		this.ui_ctx.save();

		this.ui_ctx.translate(doc_width/2, doc_height/2)
		this.ui_ctx.scale(1, 0.5);
		this.ui_ctx.rotate(this.rot_radians);
		this.ui_ctx.fillStyle = tmp_fill_style;
	}

	this.highlight_tile = function(){
		// self.ui_ctx.fillStyle = 'rgba(0,100,0,0.5)';
		// self.ui_ctx.fillStyle = 'red';

		$('#'+this.ui_id).mousemove(function(e){
			if(!self.mouse_is_down){

				self.clear_ui();

				var iso_coords = self.iso_to_cartesian( [e.pageX, e.pageY], true );


				iso_coords[0] = Math.floor(iso_coords[0] / terrain.tile_width) * terrain.tile_width;
				iso_coords[1] = Math.floor(iso_coords[1] / terrain.tile_width) * terrain.tile_width;

				iso_coords[0] += (terrain.translation[0] % terrain.tile_width);
				iso_coords[1] += (terrain.translation[1] % terrain.tile_width);
// console.log( terrain.translation[0] % terrain.tile_width );
				// var tmp_translation = Array();
				// tmp_translation[0] = terrain.translation[0] % terrain.tile_width;
				// tmp_translation[1] = terrain.translation[1] % terrain.tile_width;

				self.ui_ctx.fillStyle = 'rgba(0,100,0,0.5)';
				self.ui_ctx.beginPath();
				// self.ui_ctx.rect( iso_coords[0] + tmp_translation[0], iso_coords[1] + tmp_translation[1], terrain.tile_width - terrain.tile_spacer, terrain.tile_width - terrain.tile_spacer);
				self.ui_ctx.rect( iso_coords[0], iso_coords[1], terrain.tile_width - terrain.tile_spacer, terrain.tile_width - terrain.tile_spacer);
				self.ui_ctx.fill();

				var true_coords = Array();
				true_coords[0] = (iso_coords[0]/terrain.tile_width) + (cube_size/2) + origin[0];
				true_coords[1] = (iso_coords[1]/terrain.tile_width) + (cube_size/2) + origin[1];

				// console.log( true_coords );
				// console.log( origin );

			}
		});

	}

	this.iso_to_cartesian = function(coords, use_translation){
		var angle = -45 * Math.PI / 180;
		var x = coords[0] - (doc_width/2);
		var y = (coords[1] - (doc_height/2)) * 2;

		var cos = Math.cos(angle);
		var sin = Math.sin(angle);

		var new_x = x*cos - y*sin; // + obj.left;
		var new_y = x*sin + y*cos; // + obj.top;

		// if(use_translation){
		// 	new_x += terrain.translation[0];
		// 	new_y += terrain.translation[1];
		// }
		return [Math.round(new_x), Math.round(new_y)];
	}

	// this.cartesian_to_iso = function(input_x, input_y){
	// 	var pt_x = (input_x - input_y);
	// 	var pt_y = ((input_x + input_y) / 2);

	// 	pt_x += (this.window_width/2);
	// 	pt_y += (this.window_height/2);
	// 	return( [pt_x, pt_y] );
	// }

	// this.iso_to_cartesian = function(input_x, input_y){
	// 	input_x -= this.window_width/2;
	// 	input_y -= this.window_height/2;
	// 	// var cart_x = (2 * input_y + input_x) / 2;
	// 	// var cart_y = (2 * input_y - input_x) / 2;
	// 	var cart_x = (2 * input_y + input_x) / 2;
	// 	var cart_y = (2 * input_y - input_x) / 2;
	// 	return( [cart_x, cart_y] );
	// }
}