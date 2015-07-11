function World(world_canvas_id){

	var self = this;

	this.world_canvas = document.getElementById(world_canvas_id);
	this.world_ctx = this.world_canvas.getContext('2d');
	this.world_canvas.width = doc_width;
	this.world_canvas.height = doc_height;
	this.tile_width = 4;

	this.get_world_map = function(){
		// network.server_call('world_map_data', {map_size: Math.floor(Math.sqrt(doc_height)), cube_size: doc_height });
		network.server_call('world_map_data', {map_size: doc_height / this.tile_width, cube_size: doc_height / this.tile_width });
	}

	this.update_worldmap = function(world_tilemap){

		for(var i in world_tilemap){
			this.update_fill( world_tilemap[i].color );
			this.path();

			for( var i2 in world_tilemap[i].tiles ){
				this.draw_tile( world_tilemap[i].tiles[i2].x, world_tilemap[i].tiles[i2].y);
			}

			this.fill();
		}

		this.world_ctx.fillStyle = 'red';
		var tmp_x = origin[0] / 2500000 * doc_height;
		var tmp_y = origin[1] / 2500000 * doc_height;
		this.world_ctx.fillRect( tmp_x, tmp_y, 3, 3 )
		// console.log( origin[0] / 2500000 * doc_width * this.tile_width );

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

	setTimeout(function(){
		self.get_world_map();
	}, 1000)
}