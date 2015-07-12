function World(world_canvas_id){

	var self = this;

	this.world_canvas = document.getElementById(world_canvas_id);
	this.world_ctx = this.world_canvas.getContext('2d');

	if(doc_width > doc_height){
		this.smaller_side = doc_height;
		this.offset = (doc_width - doc_height) / 2;
		$('#'+world_canvas_id).css('left', (this.offset));
	} else {
		this.smaller_side = doc_width;
		this.offset = 0;
	}

	this.world_canvas.width = this.smaller_side;
	this.world_canvas.height = this.smaller_side;

	this.tile_width = 4;
	this.zoom_level = 1;
	this.current_origin = [0,0];

	this.initialize_world_viewer = function(){
		this.get_world_map(1);
		this.click_listener();
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

		$(document).click(function(e){
			var clicked_coords = [ Math.round( (e.pageX - self.offset) ), Math.round(e.pageY) ];
			self.zoom_in(clicked_coords);
		});
	}

	this.zoom_in = function(new_coords){

		new_coords[0] += this.current_origin[0] * this.tile_width;
		new_coords[1] += this.current_origin[1] * this.tile_width;

		var abs_coords = [ Math.round(new_coords[0] / (this.smaller_side * this.zoom_level) * map_size), Math.round(new_coords[1] / (this.smaller_side * this.zoom_level) * map_size) ]
		cl(abs_coords);

		var max_zoom = map_size / this.smaller_side;
		if(this.zoom_level * 2 > max_zoom){
			var change_amount = max_zoom / this.zoom_level;
			this.zoom_level = max_zoom;
		} else {
			this.zoom_level *= 2;
			var change_amount = 2;
		}


		new_coords[0] *= change_amount;
		new_coords[1] *= change_amount;

		var new_origin = [ new_coords[0] - (this.smaller_side/2), new_coords[1] - (this.smaller_side/2) ]
		new_origin[0] /= this.tile_width;
		new_origin[1] /= this.tile_width;

		this.current_origin = new_origin;
		this.get_world_map( new_origin );
	}

}