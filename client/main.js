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
// cube_size = 30;

var tmp_adj = (map_size / cube_size) * 12.5;
// console.log(tmp_adj);

var origin = [0,tmp_adj];

var terrain = new Terrain('main', resolution);
var ui = new UI('ui');
var needs_update = false;

var tilemap;

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


function make_building(){
	ws.send( get_json({type:'save_thing_at_location', coords:[5,5,map_size]}) )
}

$(document).ready(function(){

	ws.onopen = function(){
		// console.log('connected');
		get_map_data();
	};

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

	ws.onclose = function(){
		console.log( 'WebSocket Connection closed');
	};


	function get_map_data(){
		var map_params = {cube_size: cube_size, map_size: map_size, resolution: resolution, origin: origin};
		ws.send( get_json({type:'get_map_data', map_params:map_params}) );
	}


	$('.canvas').each(function(){
		$(this).attr('width', doc_width);
		$(this).attr('height', doc_height);
	});


	ui.click_listener();
	ui.pan_listener();
	ui.highlight_tile();

	terrain.start_path();

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
		}

		if(do_update){
			get_map_data();
		}

	});

	setInterval(function(){
		if(needs_update){

			terrain.draw_tilemap(tilemap);

		}
		needs_update = false;
	}, 10);

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


function Terrain(terrain_canvas_id, resolution){

	this.terrain_canvas = document.getElementById(terrain_canvas_id);
	this.terrain_ctx = this.terrain_canvas.getContext('2d');

	this.window_width = $(window).width();
	this.window_height = $(window).height();
	this.tile_width = resolution;

	this.translation = [0,0];

	this.terrain_ctx.fillStyle = 'red';

	this.draw_tilemap = function(tilemap){
// var start = new Date().getTime();
		var cube_size = Math.sqrt(tilemap.length);

		var start_x = -(cube_size/2);
		var start_y = -(cube_size/2);
		var end_x = (cube_size * 0.5);
		var end_y = (cube_size * 0.5);

		this.clear_map();
		this.start_path();

		this.terrain_ctx.lineWidth = 0;

		for(var ix = start_x; ix < end_x; ix++ ){
			for(var iy = start_y; iy < end_y; iy++ ){

				var tmp_x = ix - start_x;
				var tmp_y = iy - start_y;

				var tmp_i = (tmp_x * cube_size) + tmp_y;

				var height = tilemap[tmp_i].height;

				if(height >= 0.8){
					this.update_fill('#7A8781');
				} else if(height > 0.7){
					this.update_fill('#59842A');
				} else if(height > 0.6){
					this.update_fill('#4C7124');
				} else if(height > 0.57){
					this.update_fill('#326800');
				} else {
					this.update_fill('#254e78');
				}

				this.draw_tile(ix * this.tile_width, iy * this.tile_width);

			}
		}

		this.fill();


		// this.start_path();
		// this.terrain_ctx.strokeStyle = '#fff';
		// this.terrain_ctx.lineWidth = 3;
		// for(var ix = start_x; ix < end_x; ix++ ){
		// 	for(var iy = start_y; iy < end_y; iy++ ){
		// 		this.draw_tile(ix * this.tile_width, iy * this.tile_width);
		// 	}
		// }
		// this.stroke();



		// var end = new Date().getTime();
		// console.log(end - start);
	}

	this.update_fill = function(new_fill_style){
		if(this.terrain_ctx.fillStyle != new_fill_style){
			this.fill();
			this.terrain_ctx.fillStyle = new_fill_style;
			this.start_path();
		}
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
		this.terrain_ctx.clearRect(0, 0, doc_width, doc_height);
	}

	this.draw_tile = function(x, y){
		// Dont draw tiles outside of the screen
		var start_coords = this.cartesian_to_iso(x,y);
		if(start_coords[0] < -this.tile_width || start_coords[1] < -this.tile_width || start_coords[0] > (doc_width + this.tile_width) || start_coords[1] > doc_height){
			return false;
		}

		this.move_to(x, y);
		this.line_to(x+this.tile_width, y);
		this.line_to(x+this.tile_width, y+this.tile_width);
		this.line_to(x, y+this.tile_width);
		this.terrain_ctx.closePath();
	}

	this.cartesian_to_iso = function(input_x, input_y){
		var pt_x = (input_x - input_y);
		var pt_y = ((input_x + input_y) / 2);

		pt_x += (this.window_width/2) + this.translation[0];
		pt_y += (this.window_height/2) + this.translation[1];
		return( [pt_x, pt_y] );
	}

	this.iso_to_cartesian = function(input_x, input_y){
		input_x -= this.window_width/2;
		input_y -= this.window_height/2;
		var cart_x = (2 * input_y + input_x) / 2;
		var cart_y = (2 * input_y - input_x) / 2;
		return( [cart_x, cart_y] );
	}

	this.move_to = function(input_x, input_y){
		var points = this.cartesian_to_iso(input_x, input_y);
		this.terrain_ctx.moveTo(points[0], points[1]);
	}

	this.line_to = function(input_x, input_y){
		var points = this.cartesian_to_iso(input_x, input_y);
		this.terrain_ctx.lineTo(points[0], points[1]);
	}

	this.translate_map = function(difference_x, difference_y){
		this.translation[0] += difference_x;
		this.translation[1] += difference_y;
	}

	this.get_tile_corners = function(canvas_x, canvas_y){
		var bounding_box = new Array();

		canvas_x -= this.translation[0];
		canvas_y -= this.translation[1];

		var coords = this.iso_to_cartesian(canvas_x, canvas_y);

		coords[0] = Math.floor( coords[0] / this.tile_width ) * this.tile_width;
		coords[1] = Math.floor( coords[1] / this.tile_width ) * this.tile_width;

		bounding_box[0] = this.cartesian_to_iso( coords[0], coords[1] );
		bounding_box[1] = this.cartesian_to_iso( coords[0]+this.tile_width, coords[1] );
		bounding_box[2] = this.cartesian_to_iso( coords[0]+this.tile_width, coords[1]+this.tile_width );
		bounding_box[3] = this.cartesian_to_iso( coords[0], coords[1]+this.tile_width );

		return bounding_box;
	}

}

function UI(ui_canvas_id){
	this.ui_id = ui_canvas_id;
	this.ui_canvas = document.getElementById(ui_canvas_id);
	this.ui_ctx = this.ui_canvas.getContext('2d');

	this.last_page_x;
	this.last_page_y;
	this.mouse_is_down = false;

	this.last_x;
	this.last_y;

	var self = this;

	this.pan_listener = function(){
		$('#'+this.ui_id).mousemove(function(e){
			if(self.mouse_is_down){
				var tmp_difference_x = e.pageX - self.last_x;
				var tmp_difference_y = e.pageY - self.last_y;

				terrain.translate_map(tmp_difference_x, tmp_difference_y);

				self.last_x = e.pageX;
				self.last_y = e.pageY;
				needs_update = true;
			}
		});
	}

	this.click_listener = function(){
		$('#'+this.ui_id).mousedown(function(e){
			self.last_x = e.pageX;
			self.last_y = e.pageY;
			self.mouse_is_down = true;
			self.clear_ui();
		});

		$('#'+this.ui_id).mouseup(function(e){
			self.mouse_is_down = false;
		});
	}

	this.clear_ui = function(){
		this.ui_ctx.clearRect(0,0,doc_width,doc_height);
	}

	this.highlight_tile = function(){

		$('#'+this.ui_id).mousemove(function(e){
			if(!self.mouse_is_down){
				self.ui_ctx.fillStyle = 'rgba(0,100,0,0.5)';
				var bounding_box = terrain.get_tile_corners(e.pageX, e.pageY);
				var iso_coords = terrain.iso_to_cartesian(e.pageX - terrain.translation[0], e.pageY - terrain.translation[1]);

				iso_coords[0] = Math.floor(iso_coords[0] / terrain.tile_width);
				iso_coords[1] = Math.floor(iso_coords[1] / terrain.tile_width);

				self.clear_ui();
				self.ui_ctx.beginPath();
				self.ui_ctx.moveTo( bounding_box[0][0], bounding_box[0][1] );
				self.ui_ctx.lineTo( bounding_box[1][0], bounding_box[1][1] );
				self.ui_ctx.lineTo( bounding_box[2][0], bounding_box[2][1] );
				self.ui_ctx.lineTo( bounding_box[3][0], bounding_box[3][1] );
				self.ui_ctx.closePath();
				// self.ui_ctx.stroke();
				self.ui_ctx.fill();

				self.ui_ctx.fillStyle = "#000";

				var true_coords = [(iso_coords[0] + origin[0] + (cube_size/2)), (iso_coords[1] + origin[1] + (cube_size/2))];

				var tmp_iso_display = true_coords[0] + ', ' + true_coords[1];
				self.ui_ctx.fillText(tmp_iso_display, bounding_box[0][0] - 6, bounding_box[0][1] + 20);
			}
		});
	}
}