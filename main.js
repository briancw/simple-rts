var doc_width = $(window).width();
var doc_height = $(window).height();
var terrain = new Terrain('main');
var ui = new UI('main');
var needs_update = true;

$(document).ready(function(){

	$('.canvas').each(function(){
		$(this).attr('width', doc_width);
		$(this).attr('height', doc_height);
	});

	var main_ctx = $('#main')[0].getContext('2d');

	ui.click_listener();
	ui.pan_listener();

	terrain.start_path();
	
	setInterval(function(){
		if(needs_update){
			terrain.clear_map();
			terrain.start_path();
			var i = 0;
			while(i < 10){
				terrain.draw_tile(i*51,0);
				
				var i2 = 0;
				while(i2 < 10){
					terrain.draw_tile(i*51,i2*51);
					i2++;
				}
				i++;
			}
			terrain.fill();
		}
		needs_update = false;
	}, 10);

});

function Terrain(terrain_canvas_id){

	this.terrain_canvas = document.getElementById(terrain_canvas_id);
	this.terrain_ctx = this.terrain_canvas.getContext('2d');
	
	this.window_width = $(window).width();
	this.window_height = $(window).height();
	this.tile_width = 50;

	this.start_path = function(){
		this.terrain_ctx.beginPath();
		this.terrain_ctx.fillStyle = '#4C7124';
	}

	this.fill = function(){
		this.terrain_ctx.fill();
	}

	this.clear_map = function(){
		this.terrain_ctx.clearRect(0,0,doc_width, doc_height);
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

		pt_x += (this.window_width/2);
		pt_y += (this.window_height/2);
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

				self.ui_ctx.translate(tmp_difference_x, tmp_difference_y);
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
}