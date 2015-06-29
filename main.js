var doc_width = $(window).width();
var doc_height = $(window).height();
var doc_diagonal = Math.round(Math.sqrt( Math.pow(doc_width,2) + Math.pow(doc_height,2) ));
var resolution = 50;
var cube_size = Math.ceil(doc_diagonal / resolution);
cube_size %2 == 0 ? cube_size : cube_size++;
console.log(cube_size);
// var cube_size = 20;
var origin = [5,5];

console.log( cube_size );

var terrain = new Terrain('main', resolution);
var ui = new UI('ui');
var needs_update = true;

var server_url = 'http://localhost:8080';

$(document).ready(function(){

	$.ajax({
		url: server_url+'/heightmap',
		type : 'POST',
		data: {'cube_size': cube_size},
		dataType: 'JSON',
		success: function(ret){
			if( typeof(ret) !== 'undefined' ){
				if( typeof(ret.heightmap) !== 'undefined' && ret.heightmap.length ){

					// var heightmap = ret.heightmap;
					// draw_heightmap(heightmap);

					terrain.draw_tilemap(ret.heightmap);

				}
			}
		}
	});


	$('.canvas').each(function(){
		$(this).attr('width', doc_width);
		$(this).attr('height', doc_height);
	});

	var main_ctx = $('#main')[0].getContext('2d');

	ui.click_listener();
	ui.pan_listener();
	ui.highlight_tile();

	terrain.start_path();

	// setInterval(function(){
	// 	if(needs_update){
	// 		terrain.clear_map();
	// 		terrain.start_path();
	// 		var i = -9;
	// 		while(i < 10){
	// 			terrain.draw_tile(i*50,0);

	// 			var i2 = -9;
	// 			while(i2 < 10){
	// 				terrain.draw_tile(i*50,i2*50);
	// 				i2++;
	// 			}
	// 			i++;
	// 		}
	// 		terrain.fill();
	// 		terrain.stroke();
	// 	}
	// 	needs_update = false;
	// }, 10);

});

function Terrain(terrain_canvas_id, resolution){

	this.terrain_canvas = document.getElementById(terrain_canvas_id);
	this.terrain_ctx = this.terrain_canvas.getContext('2d');

	this.window_width = $(window).width();
	this.window_height = $(window).height();
	this.tile_width = resolution;

	this.translation = [0,0];

	this.draw_tilemap = function(tilemap){
		var cube_size = Math.sqrt(tilemap.length);

		var start_x = -(cube_size/2) * this.tile_width;
		var start_y = -(cube_size/2) * this.tile_width;
		var end_x = (cube_size * 0.5) * this.tile_width;
		var end_y = (cube_size * 0.5) * this.tile_width;

		for(var ix = start_x; ix < end_x; ix += this.tile_width){
			for(var iy = start_y; iy < end_y; iy += this.tile_width){

				this.draw_tile(ix, iy);

			}
		}

		this.terrain_ctx.fill();

	}

	// this.draw_tilemap = function(tilemap){
	// 	var start_x = (-this.tile_width*18);
	// 	var start_y = (-this.tile_width*18);
	// 	var cube_size = 36;

	// 	for(var ix = start_x; ix < this.tile_width*18; ix+=this.tile_width){
	// 		for(var iy = start_y; iy < this.tile_width*18; iy+=this.tile_width){

	// 			// Toss out tiles outside the window
	// 			if( ((ix + iy) / 2) < -((this.window_height/2)+(this.tile_width*2)) ||
	// 				((ix + iy) / 2) > ((this.window_height/2)+(this.tile_width*2))  ||
	// 				(ix - iy) < -((this.window_width/2)+(this.tile_width*2)) ||
	// 				(ix - iy) > ((this.window_width/2)+(this.tile_width*2))
	// 			){
	// 				continue;
	// 			}

	// 			var tmp_x = ((ix+(this.tile_width*18)) / this.tile_width);
	// 			var tmp_y = ((iy+(this.tile_width*18)) / this.tile_width);
	// 			var tmp_i = (tmp_x*cube_size)+tmp_y;
	// 			var height = heightmap[tmp_i].height;

	// 			if(height > 0.8){
	// 				this.terrain_ctx.fillStyle = luminance('#7A8781', height - 0.8);
	// 			} else if(height > 0.7){
	// 				this.terrain_ctx.fillStyle = luminance('#59842A', height - 0.7);
	// 			} else if(height > 0.6){
	// 				this.terrain_ctx.fillStyle = luminance('#4C7124', height - 0.6);
	// 			} else if(height > 0.57){
	// 				this.terrain_ctx.fillStyle = luminance('#326800', height - 0.57);
	// 			} else {
	// 				this.terrain_ctx.fillStyle = luminance('#254e78', height);
	// 			}

	// 			this.terrain_ctx.beginPath();
	// 			this.draw_tile(ix+this.map_offset[0] ,iy+this.map_offset[1] );
	// 			this.terrain_ctx.fill();
	// 			// this.terrain_ctx.stroke();
	// 		}
	// 	}
	// }

	this.start_path = function(){
		this.terrain_ctx.beginPath();
		this.terrain_ctx.fillStyle = '#4C7124';
		this.terrain_ctx.strokeStyle = '#fff';
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

			var tmp_iso_display = iso_coords[0] + ', ' + iso_coords[1];
			self.ui_ctx.fillText(tmp_iso_display, bounding_box[0][0] - 6, bounding_box[0][1] + 20);

		});
	}
}