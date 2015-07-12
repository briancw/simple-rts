function World(world_canvas_id){

	var self = this;

	this.world_canvas = $('<canvas>', {
		id: 'world',
		class: 'canvas',
	});
	$('.canvases').append(this.world_canvas);

	if(doc_width > doc_height){
		this.smaller_side = doc_height;
		this.offset = (doc_width - doc_height) / 2;
		$('#'+world_canvas_id).css('left', (this.offset));
	} else {
		this.smaller_side = doc_width;
		this.offset = 0;
	}

	this.world_canvas[0].width = this.smaller_side;
	this.world_canvas[0].height = this.smaller_side;

	this.world_ctx = this.world_canvas[0].getContext('2d');

	this.tile_width = 4;
	this.zoom_level = 1;
	this.zoom_increment = 4;
	this.current_origin = [0,0];
	this.is_fully_zoomed = false;
	this.click_callback = null;

	this.initialize_world_viewer = function(){
		this.get_world_map(1);
		this.click_listener();
	}

	this.hide_world_viewer = function(){
		this.world_canvas.hide();
	}

	this.get_world_map = function(coords){
		var tmp_map_size = Math.round(this.smaller_side * this.zoom_level);
		network.server_call('world_map_data', {map_size: tmp_map_size / this.tile_width, cube_size: this.smaller_side / this.tile_width, origin: coords });
	}

	this.update_worldmap = function(world_tilemap){

		this.clear();

		for(var i in world_tilemap){
			this.update_fill( world_tilemap[i].color );
			this.path();

			for( var i2 in world_tilemap[i].tiles ){
				this.draw_tile( world_tilemap[i].tiles[i2].x, world_tilemap[i].tiles[i2].y);
			}

			this.fill();
		}

		this.world_ctx.fillStyle = 'red';
		this.world_ctx.fillRect(this.smaller_side/2, this.smaller_side/2, 2, 2);
	}

	this.fill = function(){
		this.world_ctx.fill();
	}

	this.draw_tile = function(x, y){
		this.world_ctx.rect(x * this.tile_width, y * this.tile_width, this.tile_width, this.tile_width);
	}

	this.path = function(){
		this.world_ctx.beginPath();
	}

	this.update_fill = function(new_fill_style){
		if(this.world_ctx.fillStyle != new_fill_style){
			this.world_ctx.fillStyle = new_fill_style;
		}
	}

	this.clear = function(){
		this.world_ctx.clearRect(0,0,this.smaller_side,this.smaller_side);
	}

	this.click_listener = function(){

		this.world_canvas.mouseup(function(e){

			var clicked_coords = [ Math.round( (e.pageX - self.offset) ), Math.round(e.pageY) ];

			if(e.which === 1){

				if(typeof(self.click_callback) == 'function'){
					var tmp_coords = [clicked_coords[0] + self.current_origin[0] * self.tile_width, clicked_coords[1] + self.current_origin[1] * self.tile_width];
					var abs_coords = [ Math.round(tmp_coords[0] / (self.smaller_side * self.zoom_level) * map_size), Math.round(tmp_coords[1] / (self.smaller_side * self.zoom_level) * map_size) ];

					self.click_callback(abs_coords);
					self.click_callback = null;
				} else {
					self.zoom_in(clicked_coords);
				}

			} else if( e.which === 3){
				self.zoom_out(clicked_coords);
			}


		});

		$(document).on("contextmenu", function(e){
			e.preventDefault();
		});
	}

	this.zoom_in = function(new_coords){

		new_coords[0] += this.current_origin[0] * this.tile_width;
		new_coords[1] += this.current_origin[1] * this.tile_width;

		var max_zoom = map_size / this.smaller_side;
		if(this.zoom_level * this.zoom_increment > max_zoom){
			var change_amount = max_zoom / this.zoom_level;
			this.closest_zoom_change = change_amount;
			this.zoom_level = max_zoom;
			this.fully_zoomed(true);
		} else {
			this.zoom_level *= this.zoom_increment;
			var change_amount = this.zoom_increment;
		}

		new_coords[0] *= change_amount;
		new_coords[1] *= change_amount;

		var new_origin = [ new_coords[0] - (this.smaller_side/2), new_coords[1] - (this.smaller_side/2) ]
		new_origin[0] /= this.tile_width;
		new_origin[1] /= this.tile_width;

		this.current_origin = new_origin;
		this.get_world_map( new_origin );
	}

	this.zoom_out = function(new_coords){

		new_coords[0] += this.current_origin[0] * this.tile_width;
		new_coords[1] += this.current_origin[1] * this.tile_width;

		if(this.zoom_level == map_size / this.smaller_side){
			this.zoom_level /= this.closest_zoom_change;
			var change_amount = this.closest_zoom_change;
			this.fully_zoomed(false);
		} else if(this.zoom_level > 1) {
			this.zoom_level /= this.zoom_increment;
			var change_amount = this.zoom_increment;
		} else {
			var change_amount = 1;
			this.zoom_level = 1;
		}

		new_coords[0] /= change_amount;
		new_coords[1] /= change_amount;

		var new_origin = [ new_coords[0] - (this.smaller_side/2), new_coords[1] - (this.smaller_side/2) ]
		new_origin[0] /= this.tile_width;
		new_origin[1] /= this.tile_width;

		this.current_origin = new_origin;
		this.get_world_map( new_origin );
	}

	this.fully_zoomed = function(ready){
		if(!ready){
			controls.remove_launch_base_button();
		} else {
			controls.launch_base_button();
		}
	}

}