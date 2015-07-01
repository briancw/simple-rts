var FastSimplexNoise = require('fast-simplex-noise');
var fast_simplex = new FastSimplexNoise({random: random});

var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({ port: 9005 });

function random(){
	// return Math.random();
	return 0.4710536374424983;
}

var fast_simplex = new FastSimplexNoise({random: random});
fast_simplex.octaves = 12;
fast_simplex.frequency = 0.315;
fast_simplex.persistence = 0.5;


wss.on('connection', function connection(ws) {

	ws.on('message', function incoming(message) {

		try {
			var parsed_message = JSON.parse(message);
			var message_type = parsed_message.type;
		} catch(err) {
			console.log('Unkown client request');
			console.log(err);
			return false;
		}

		switch (message_type){

			case 'get_map_data':
				var tilemap = generate_tilemap(parsed_message.map_params);
				send_json( ws, {type:'tilemap', tilemap:tilemap} );
				break;

			default:
				console.log('Unkown client request. Unknown Type.');
				break;

		}

		console.log('received: %s', message);

	});

	// console.log( wss.clients.length );

	// console.log('sending');
	// ws.send( JSON.stringify( ['clients:'+wss.clients.length] ) );
});

	function send_json(ws_client, input){
		try {
			var parsed_message = JSON.stringify(input);
		} catch(err) {
			console.log('Unkown send request');
			console.log(err);
		}

		ws_client.send( parsed_message );
	}



	function generate_tilemap(map_params){
		// console.time('generation');
		var tilemap = Array();

		if( typeof(map_params.cube_size) != 'undefined' ){
			var cube_size = parseInt(map_params.cube_size);
		} else {
			var cube_size = 10;
		}

		if( typeof(map_params.map_size) != 'undefined' ){
			var map_size = parseInt(map_params.map_size);
		} else {
			var map_size = 100;
		}

		if( typeof(map_params.origin) != 'undefined' && map_params.origin.length ){
			var origin = map_params.origin;
		} else {
			var origin = [0,0];
		}

		if(cube_size > 800){
			return false;
		}

		var start_x = parseInt(origin[0],10);
		var start_y = parseInt(origin[1],10);

		// Map size must be set statically if all players are to see the same scale regardless of screen resolution
		// Using this system, adding to x or y will pan the map 1 tile, no matter how many tiles the player sees.

		var scale = cube_size / map_size;

		for(x = start_x; x < cube_size + start_x; x++){
			for(y = start_y; y < cube_size + start_y; y++){

				nx = Math.cos( ((x/cube_size) * scale) * 2 * Math.PI );
				ny = Math.cos( ((y/cube_size) * scale) * 2 * Math.PI );
				nz = Math.sin( ((x/cube_size) * scale) * 2 * Math.PI );
				nw = Math.sin( ((y/cube_size) * scale) * 2 * Math.PI );

				var tmp_elevation = fast_simplex.get4DNoise(nx,ny,nz,nw) + 0.55;
				var tmp_temp = 10;
				if(tmp_elevation <= 0.55){
					tmp_temp -= 5;
				} else {
					// temp drops 3f per 1k ft, based on max elevation of 20k feet
					// tmp_temp -= ((tmp_elevation - .55) * 146);
					// Less intense version assuming max mountain height of 10k, should fix continent rather than this
					tmp_temp -= ((tmp_elevation - .55) * 82);
				}
				var equator_distance = Math.abs( Math.abs( 1 - ((y-start_y)/cube_size*2) ) - 1 );
				tmp_temp += equator_distance * 60;

				tilemap.push( {height: tmp_elevation, temp: tmp_temp  } );
			}
		}

		// console.timeEnd('generation');
		return tilemap;
	}

